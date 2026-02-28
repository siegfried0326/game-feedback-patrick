/**
 * TossPayments 결제 서버 액션
 *
 * 구독 결제:
 * - processSubscriptionPayment(): 빌링키→결제→DB 활성화
 * - validateGamecanvasCode(): 할인 코드 검증
 *
 * 크레딧 결제:
 * - createCreditOrder(): 크레딧 주문 생성
 * - confirmCreditPayment(): 결제 확인 + 크레딧 지급
 *
 * 요금:
 * - monthly: 13,900원/월 (게임캔버스 할인 시 5,900원)
 * - three_month: 39,000원/3개월
 * - credit_1: 2,900원, credit_5: 7,900원, credit_10: 12,900원
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { issueBillingKey, approveBillingPayment, confirmPayment } from "@/lib/toss-api"

// 서버 가격표 (클라이언트 조작 방지)
const CREDIT_PRICES: Record<string, { credits: number; amount: number }> = {
  credit_1: { credits: 1, amount: 2900 },
  credit_5: { credits: 5, amount: 7900 },
  credit_10: { credits: 10, amount: 12900 },
}

const SUBSCRIPTION_PRICES: Record<string, number> = {
  monthly: 13900,
  three_month: 39000,
}

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

  // 2. 첫 결제 승인 — 금액은 서버 가격표에서 결정
  let amount = SUBSCRIPTION_PRICES[plan] || 13900
  let orderName = plan === "monthly" ? "디자이닛 월 무제한" : "디자이닛 3개월 무제한"

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

  if (dbError) {
    console.error("[payment] 구독 활성화 실패:", dbError.message)
    return { error: "구독 활성화에 실패했습니다." }
  }

  return { success: true, paymentKey: paymentResult.data.paymentKey }
}

// ========== 크레딧 결제 ==========

/**
 * 크레딧 주문 생성 (결제 전)
 */
export async function createCreditOrder(packageType: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  const pkg = CREDIT_PRICES[packageType]
  if (!pkg) return { error: "잘못된 패키지입니다." }

  const orderId = `CREDIT_${packageType}_${user.id.slice(0, 8)}_${Date.now()}`

  const { error } = await supabase
    .from("credit_orders")
    .insert({
      user_id: user.id,
      package_type: packageType,
      credits: pkg.credits,
      amount: pkg.amount,
      order_id: orderId,
    })

  if (error) {
    console.error("[payment] 크레딧 주문 생성 실패:", error.message)
    return { error: "주문 생성에 실패했습니다." }
  }

  return { orderId, amount: pkg.amount }
}

/**
 * 크레딧 결제 확인 + 크레딧 지급
 */
export async function confirmCreditPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 주문 조회 + 금액 검증
  const { data: order } = await supabase
    .from("credit_orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .single()

  if (!order) return { error: "주문을 찾을 수 없습니다." }
  if (order.payment_status === "paid") return { error: "이미 처리된 주문입니다." }
  if (order.amount !== amount) return { error: "결제 금액이 일치하지 않습니다." }

  // 토스페이먼츠 결제 확인
  const paymentResult = await confirmPayment(paymentKey, orderId, amount)
  if (paymentResult.error) return { error: paymentResult.error }

  // 주문 상태 업데이트
  await supabase
    .from("credit_orders")
    .update({
      payment_key: paymentKey,
      payment_status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)

  // 크레딧 지급
  const { data: subscription } = await supabase
    .from("users_subscription")
    .select("analysis_credits")
    .eq("user_id", user.id)
    .single()

  const currentCredits = subscription?.analysis_credits || 0

  await supabase
    .from("users_subscription")
    .upsert({
      user_id: user.id,
      plan: subscription ? undefined : "free",
      status: subscription ? undefined : "active",
      analysis_credits: currentCredits + order.credits,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })

  return { success: true, credits: currentCredits + order.credits }
}
