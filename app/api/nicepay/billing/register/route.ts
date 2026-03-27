/**
 * 빌링키 등록 + 첫 결제 API Route
 *
 * 카드 정보를 AES-128-ECB 암호화 → 나이스 빌링키 발급 → 첫 결제 승인 → DB 저장
 *
 * POST /api/nicepay/billing/register
 * Body: { cardNo, expYear, expMonth, idNo, cardPw, plan }
 */
import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"
import { createClient } from "@/lib/supabase/server"
import { issueBillingKey, approveBillingPayment } from "@/lib/nice-api"

const PLAN_CONFIG = {
  monthly:     { amount: 13800, name: "아카이브 187 월 무제한",  months: 1 },
  three_month: { amount: 39000, name: "아카이브 187 3개월 무제한", months: 3 },
} as const

/**
 * 카드 정보를 AES-128-ECB + PKCS7 패딩으로 암호화
 * 키: NICEPAY_SECRET_KEY 앞 16바이트
 */
function encryptCardData(plainText: string): string {
  const secretKey = process.env.NICEPAY_SECRET_KEY!
  const key = Buffer.from(secretKey.slice(0, 16), "utf8")
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null)
  cipher.setAutoPadding(true)
  return cipher.update(plainText, "utf8", "hex") + cipher.final("hex")
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
    }

    const body = await request.json()
    const { cardNo, expYear, expMonth, idNo, cardPw, plan } = body as {
      cardNo: string
      expYear: string
      expMonth: string
      idNo: string
      cardPw: string
      plan: keyof typeof PLAN_CONFIG
    }

    // 입력 검증
    if (!cardNo || !expYear || !expMonth || !idNo || !cardPw || !plan) {
      return NextResponse.json({ error: "필수 정보를 모두 입력해주세요." }, { status: 400 })
    }
    if (!PLAN_CONFIG[plan]) {
      return NextResponse.json({ error: "잘못된 플랜입니다." }, { status: 400 })
    }
    const cardNoClean = cardNo.replace(/\s/g, "")
    if (!/^\d{15,16}$/.test(cardNoClean)) {
      return NextResponse.json({ error: "카드번호가 올바르지 않습니다." }, { status: 400 })
    }
    if (!/^\d{2}$/.test(expYear) || !/^\d{2}$/.test(expMonth)) {
      return NextResponse.json({ error: "유효기간이 올바르지 않습니다." }, { status: 400 })
    }
    if (!/^\d{2}$/.test(cardPw)) {
      return NextResponse.json({ error: "비밀번호 앞 2자리를 입력해주세요." }, { status: 400 })
    }
    if (!/^\d{6}$|^\d{10}$/.test(idNo)) {
      return NextResponse.json({ error: "생년월일 6자리 또는 사업자번호 10자리를 입력해주세요." }, { status: 400 })
    }

    const planConfig = PLAN_CONFIG[plan]
    const ts = Date.now()
    const userPrefix = user.id.slice(0, 8)
    const registOrderId = `REG_${plan}_${userPrefix}_${ts}`

    // 카드 데이터 AES-128-ECB 암호화
    const plainText = `cardNo=${cardNoClean}&expYear=${expYear}&expMonth=${expMonth}&idNo=${idNo}&cardPw=${cardPw}`
    const encData = encryptCardData(plainText)

    console.log(`[billing-register] 빌링키 발급 시작 userId=${user.id} plan=${plan}`)

    // 1) 빌링키 발급
    const billingResult = await issueBillingKey(encData, registOrderId)
    if (billingResult.error) {
      console.error("[billing-register] 빌링키 발급 실패:", billingResult.error)
      return NextResponse.json({ error: billingResult.error }, { status: 400 })
    }

    const bid = billingResult.data?.bid
    if (!bid) {
      return NextResponse.json({ error: "빌링키 발급에 실패했습니다." }, { status: 400 })
    }

    console.log(`[billing-register] 빌링키 발급 성공 bid=${bid.slice(0, 8)}...`)

    // 2) 첫 결제
    const payOrderId = `PAY_${plan}_${userPrefix}_${ts + 1}`
    const payResult = await approveBillingPayment(bid, payOrderId, planConfig.amount, planConfig.name)
    if (payResult.error) {
      console.error("[billing-register] 첫 결제 실패:", payResult.error)
      return NextResponse.json({ error: `결제 실패: ${payResult.error}` }, { status: 400 })
    }

    console.log(`[billing-register] 첫 결제 성공 tid=${payResult.data?.tid}`)

    // 3) DB 구독 활성화
    const now = new Date()
    const expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + planConfig.months)

    const { error: dbError } = await supabase
      .from("users_subscription")
      .upsert({
        user_id: user.id,
        plan,
        status: "active",
        billing_key: bid,
        customer_key: null,
        payment_id: payResult.data?.tid || payOrderId,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        auto_renewal: true,
        renewal_failed_at: null,
        renewal_fail_count: 0,
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" })

    if (dbError) {
      console.error("[billing-register] DB 저장 실패:", dbError.message)
      return NextResponse.json({ error: "구독 활성화에 실패했습니다. 고객센터에 문의해주세요." }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      plan,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error("[billing-register] 예외:", error)
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 })
  }
}
