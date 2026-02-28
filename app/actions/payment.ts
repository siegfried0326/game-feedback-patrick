/**
 * TossPayments 결제 서버 액션
 *
 * 기능:
 * - processSubscriptionPayment(): 구독 결제 전체 흐름 (빌링키→결제→DB 활성화)
 * - validateGamecanvasCode(): 게임캔버스 할인 코드 검증
 *
 * 보안:
 * - TossPayments API 호출 헬퍼(issueBillingKey, approveBillingPayment, deleteBillingKey,
 *   confirmPayment)는 lib/toss-api.ts로 분리하여 HTTP 엔드포인트 노출 방지
 * - processSubscriptionPayment에서 로그인 체크 수행
 *
 * 요금:
 * - monthly: 17,900원/월 (게임캔버스 할인 시 5,900원)
 * - three_month: 49,000원/3개월
 *
 * 환경변수: TOSS_SECRET_KEY, GAMECANVAS_DISCOUNT_CODES
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { issueBillingKey, approveBillingPayment } from "@/lib/toss-api"

/**
 * 게임캔버스 할인 코드 검증
 */
export async function validateGamecanvasCode(code: string) {
  if (!code || !code.trim()) {
    return { valid: false, error: "코드를 입력해 주세요." }
  }

  const trimmedCode = code.trim().toUpperCase()
  const validCodes = (process.env.GAMECANVAS_DISCOUNT_CODES || "")
    .split(",")
    .map(c => c.trim().toUpperCase())
    .filter(c => c.length > 0)

  if (validCodes.length === 0) {
    return { valid: false, error: "할인 코드가 설정되지 않았습니다." }
  }

  if (validCodes.includes(trimmedCode)) {
    return { valid: true }
  }

  return { valid: false, error: "유효하지 않은 할인 코드입니다." }
}

/**
 * 구독 결제 처리 (빌링키 발급 → 첫 결제 → DB 활성화)
 */
export async function processSubscriptionPayment(
  authKey: string,
  customerKey: string,
  plan: "monthly" | "three_month",
  discountCode?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 1. 빌링키 발급
  const billingResult = await issueBillingKey(authKey, customerKey)
  if (billingResult.error) return { error: billingResult.error }

  const billingKey = billingResult.data.billingKey

  // 2. 첫 결제 승인 — 금액 결정
  let amount = plan === "monthly" ? 17900 : 49000
  let orderName = plan === "monthly" ? "디자이닛 월 구독" : "디자이닛 3개월 패스"

  // 게임캔버스 할인 적용 (monthly만)
  if (discountCode && plan === "monthly") {
    const codeResult = await validateGamecanvasCode(discountCode)
    if (codeResult.valid) {
      amount = 5900
      orderName = "디자이닛 월 구독 (게임캔버스)"
    }
  }

  const orderId = `SUB_${plan}_${user.id.slice(0, 8)}_${Date.now()}`

  const paymentResult = await approveBillingPayment(
    billingKey,
    customerKey,
    amount,
    orderId,
    orderName,
  )

  if (paymentResult.error) return { error: paymentResult.error }

  // 3. DB 구독 활성화
  const now = new Date()
  const isTestAccount = user.email === "tossreview@gmail.com"

  // 기존 구독 확인
  const { data: existingSub } = await supabase
    .from("users_subscription")
    .select("expires_at, status")
    .eq("user_id", user.id)
    .single()

  let expiresAt: Date

  if (isTestAccount) {
    // 테스터 계정: 항상 새로 시작 (1개월)
    expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else if (existingSub && existingSub.status === "active" && new Date(existingSub.expires_at) > now) {
    // 기존 활성 구독이 있는 유저: 만료일에서 1개월 연장
    expiresAt = new Date(existingSub.expires_at)
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
    // 신규 또는 만료된 유저: 정상 기간 부여
    expiresAt = new Date(now)
    if (plan === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1)
    } else {
      expiresAt.setMonth(expiresAt.getMonth() + 3)
    }
  }

  const { error: dbError } = await supabase
    .from("users_subscription")
    .upsert({
      user_id: user.id,
      plan,
      status: "active",
      billing_key: billingKey,
      customer_key: customerKey,
      payment_id: paymentResult.data.paymentKey,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })

  if (dbError) return { error: dbError.message }

  return { success: true, paymentKey: paymentResult.data.paymentKey }
}

// 보안: issueBillingKey, approveBillingPayment, deleteBillingKey, confirmPayment는
// lib/toss-api.ts로 이동하여 "use server" 파일의 HTTP 엔드포인트 노출 방지
