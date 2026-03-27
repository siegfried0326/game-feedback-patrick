/**
 * 구독 자동 갱신 Cron Job
 *
 * Vercel Cron이 매일 오전 2시(KST) 호출.
 * 만료일이 오늘~내일인 유료 구독 중 billing_key가 있는 것들을 자동 결제 처리.
 *
 * 보안: CRON_SECRET 환경변수로 무단 호출 방지.
 * 설정: vercel.json crons 참고.
 */
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { approveBillingPayment, deleteBillingKey } from "@/lib/nice-api"

const PLAN_CONFIG = {
  monthly:     { amount: 13800, name: "디자이닛 월 무제한",    months: 1 },
  three_month: { amount: 39000, name: "디자이닛 3개월 무제한", months: 3 },
} as const

const MAX_FAIL_COUNT = 3 // 3회 실패 시 구독 만료 처리

export async function GET(request: NextRequest) {
  // 보안: Authorization 헤더 검증
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.warn("[cron] 인증 실패 - 무단 호출 시도")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const now = new Date()
  // 만료일이 지금으로부터 25시간 이내인 구독 (하루치 여유)
  const renewBefore = new Date(now.getTime() + 25 * 60 * 60 * 1000)

  console.log(`[cron] 자동 갱신 시작 ${now.toISOString()} / renewBefore=${renewBefore.toISOString()}`)

  const supabase = await createClient()

  // 갱신 대상 조회
  const { data: subscriptions, error: fetchError } = await supabase
    .from("users_subscription")
    .select("user_id, plan, billing_key, expires_at, renewal_fail_count")
    .eq("status", "active")
    .eq("auto_renewal", true)
    .not("billing_key", "is", null)
    .lte("expires_at", renewBefore.toISOString())
    .gt("expires_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()) // 너무 오래된 건 제외

  if (fetchError) {
    console.error("[cron] 구독 조회 실패:", fetchError.message)
    return NextResponse.json({ error: "구독 조회 실패" }, { status: 500 })
  }

  if (!subscriptions || subscriptions.length === 0) {
    console.log("[cron] 갱신 대상 없음")
    return NextResponse.json({ success: true, renewed: 0, failed: 0 })
  }

  console.log(`[cron] 갱신 대상 ${subscriptions.length}건`)

  let renewed = 0
  let failed = 0

  for (const sub of subscriptions) {
    const planConfig = PLAN_CONFIG[sub.plan as keyof typeof PLAN_CONFIG]
    if (!planConfig) {
      console.warn(`[cron] 알 수 없는 플랜: ${sub.plan} userId=${sub.user_id}`)
      continue
    }

    const orderId = `RENEW_${sub.plan}_${sub.user_id.slice(0, 8)}_${Date.now()}`

    try {
      const payResult = await approveBillingPayment(
        sub.billing_key,
        orderId,
        planConfig.amount,
        planConfig.name,
      )

      if (payResult.error) {
        throw new Error(payResult.error)
      }

      // 성공: expires_at 연장
      const newExpiresAt = new Date(sub.expires_at)
      newExpiresAt.setMonth(newExpiresAt.getMonth() + planConfig.months)

      await supabase
        .from("users_subscription")
        .update({
          status: "active",
          expires_at: newExpiresAt.toISOString(),
          payment_id: payResult.data?.tid || orderId,
          renewal_failed_at: null,
          renewal_fail_count: 0,
          updated_at: now.toISOString(),
        })
        .eq("user_id", sub.user_id)

      console.log(`[cron] ✅ 갱신 성공 userId=${sub.user_id} newExpiry=${newExpiresAt.toISOString()}`)
      renewed++
    } catch (err) {
      const failCount = (sub.renewal_fail_count || 0) + 1
      console.error(`[cron] ❌ 갱신 실패 userId=${sub.user_id} failCount=${failCount}:`, err)

      if (failCount >= MAX_FAIL_COUNT) {
        // 3회 실패 → 빌링키 삭제 + 구독 만료
        console.warn(`[cron] 🚫 ${MAX_FAIL_COUNT}회 실패 → 구독 만료 처리 userId=${sub.user_id}`)
        await deleteBillingKey(sub.billing_key).catch(() => {})
        await supabase
          .from("users_subscription")
          .update({
            status: "expired",
            billing_key: null,
            auto_renewal: false,
            renewal_failed_at: now.toISOString(),
            renewal_fail_count: failCount,
            updated_at: now.toISOString(),
          })
          .eq("user_id", sub.user_id)
      } else {
        // 실패 횟수만 기록
        await supabase
          .from("users_subscription")
          .update({
            renewal_failed_at: now.toISOString(),
            renewal_fail_count: failCount,
            updated_at: now.toISOString(),
          })
          .eq("user_id", sub.user_id)
      }

      failed++
    }
  }

  console.log(`[cron] 완료 renewed=${renewed} failed=${failed}`)
  return NextResponse.json({ success: true, renewed, failed, total: subscriptions.length })
}
