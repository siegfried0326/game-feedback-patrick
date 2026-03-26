/**
 * NICEPayments 결제 서버 액션
 *
 * 구독 결제:
 * - processSubscriptionPayment(): tid로 승인 → DB 구독 활성화
 * - validateGamecanvasCode(): 할인 코드 검증
 *
 * 크레딧 결제:
 * - createCreditOrder(): 크레딧 주문 생성
 * - confirmCreditPayment(): tid로 승인 → 크레딧 지급
 *
 * 크레딧 환불:
 * - getCreditOrders(): 환불 가능 크레딧 주문 목록
 * - refundCreditOrder(): 크레딧 환불 처리
 *
 * 요금:
 * - monthly: 13,800원/월 (게임캔버스 할인 시 5,900원)
 * - three_month: 39,000원/3개월
 * - credit_1: 2,900원, credit_5: 7,900원, credit_10: 12,900원
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { approvePayment, cancelPayment } from "@/lib/nice-api"

// 서버 가격표 (클라이언트 조작 방지)
const CREDIT_PRICES: Record<string, { credits: number; amount: number }> = {
  credit_1: { credits: 1, amount: 2900 },
  credit_5: { credits: 5, amount: 7900 },
  credit_10: { credits: 10, amount: 12900 },
}

const SUBSCRIPTION_PRICES: Record<string, number> = {
  monthly: 13800,
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
 * 구독 결제 처리 (나이스 tid로 승인 → DB 활성화)
 *
 * 나이스 Server 승인 모델:
 * 1. 결제창 인증 완료 → callback에서 tid 수신
 * 2. 이 함수에서 tid로 승인 API 호출
 * 3. 승인 성공 → DB 구독 활성화
 */
export async function processSubscriptionPayment(
  tid: string,
  orderId: string,
  amount: number,
  plan: "monthly" | "three_month",
  discountCode?: string,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: "로그인이 필요합니다." }

  // 금액 검증 (서버 가격표 기준)
  let expectedAmount = SUBSCRIPTION_PRICES[plan] || 13800
  if (discountCode && plan === "monthly") {
    const codeResult = await validateGamecanvasCode(discountCode)
    if (codeResult.valid) {
      expectedAmount = 5900
    }
  }

  if (amount !== expectedAmount) {
    return { error: "결제 금액이 올바르지 않습니다." }
  }

  // 나이스페이먼츠 결제 승인 API 호출
  const paymentResult = await approvePayment(tid, amount)
  if (paymentResult.error) return { error: paymentResult.error }

  // DB 구독 활성화
  const now = new Date()
  const isTestAccount = user.email === "tossreview@gmail.com"

  const { data: existingSub } = await supabase
    .from("users_subscription")
    .select("expires_at, status")
    .eq("user_id", user.id)
    .single()

  let expiresAt: Date

  if (isTestAccount) {
    expiresAt = new Date(now)
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else if (existingSub && existingSub.status === "active" && new Date(existingSub.expires_at) > now) {
    expiresAt = new Date(existingSub.expires_at)
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
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
      billing_key: null, // 나이스 단건결제에서는 빌링키 미사용
      customer_key: null,
      payment_id: tid,
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: "user_id" })

  if (dbError) {
    console.error("[payment] 구독 활성화 실패:", dbError.message)
    return { error: "구독 활성화에 실패했습니다." }
  }

  return { success: true, tid }
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
 * 나이스 tid로 승인 API 호출 → 크레딧 지급
 */
export async function confirmCreditPayment(
  tid: string,
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

  // 나이스페이먼츠 결제 승인
  const paymentResult = await approvePayment(tid, amount)
  if (paymentResult.error) return { error: paymentResult.error }

  // 주문 상태 업데이트 (payment_key → tid로 저장)
  await supabase
    .from("credit_orders")
    .update({
      payment_key: tid,
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

// ────────────────────────────────────────────
// 크레딧 환불
// ────────────────────────────────────────────

const CREDIT_UNIT_PRICE = 2900 // 정가 1회당 2,900원

/** 환불 가능한 크레딧 주문 목록 조회 */
export async function getCreditOrders() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다.", orders: [] }

  const { data: orders } = await supabase
    .from("credit_orders")
    .select("id, order_id, package_type, credits, amount, payment_key, payment_status, paid_at, refunded_at, refund_amount")
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .order("paid_at", { ascending: false })

  if (!orders || orders.length === 0) return { orders: [] }

  const { data: sub } = await supabase
    .from("users_subscription")
    .select("analysis_credits")
    .eq("user_id", user.id)
    .single()

  const remainingCredits = sub?.analysis_credits || 0
  const now = new Date()

  const enrichedOrders = orders.map(order => {
    const paidAt = order.paid_at ? new Date(order.paid_at) : null
    const daysSincePaid = paidAt ? (now.getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24) : 999
    const isWithin7Days = daysSincePaid <= 7

    const refundableCredits = Math.min(remainingCredits, order.credits)
    const usedCredits = order.credits - refundableCredits
    const refundAmount = Math.max(0, order.amount - usedCredits * CREDIT_UNIT_PRICE)
    const canRefund = isWithin7Days && refundAmount > 0 && refundableCredits > 0

    const packageLabel = order.package_type === "credit_1" ? "1회권"
      : order.package_type === "credit_5" ? "5회권"
      : order.package_type === "credit_10" ? "10회권"
      : order.package_type

    return {
      ...order,
      packageLabel,
      isWithin7Days,
      refundableCredits,
      usedCredits,
      refundAmount,
      canRefund,
      paidAtFormatted: paidAt ? paidAt.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "",
    }
  })

  return { orders: enrichedOrders }
}

/** 크레딧 환불 처리 */
export async function refundCreditOrder(orderId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "로그인이 필요합니다." }

  const { data: order } = await supabase
    .from("credit_orders")
    .select("*")
    .eq("order_id", orderId)
    .eq("user_id", user.id)
    .eq("payment_status", "paid")
    .single()

  if (!order) return { error: "환불 가능한 주문을 찾을 수 없습니다." }

  const paidAt = order.paid_at ? new Date(order.paid_at) : null
  if (!paidAt) return { error: "결제 정보가 올바르지 않습니다." }
  const daysSincePaid = (new Date().getTime() - paidAt.getTime()) / (1000 * 60 * 60 * 24)
  if (daysSincePaid > 7) return { error: "결제일로부터 7일이 경과하여 환불이 불가합니다." }

  const { data: sub } = await supabase
    .from("users_subscription")
    .select("analysis_credits")
    .eq("user_id", user.id)
    .single()

  const remainingCredits = sub?.analysis_credits || 0
  const refundableCredits = Math.min(remainingCredits, order.credits)
  const usedCredits = order.credits - refundableCredits
  const refundAmount = Math.max(0, order.amount - usedCredits * CREDIT_UNIT_PRICE)

  if (refundAmount <= 0 || refundableCredits <= 0) {
    return { error: "사용한 회차가 많아 환불 가능 금액이 없습니다." }
  }

  // 나이스페이먼츠 환불 API 호출 (payment_key에 tid 저장됨)
  if (!order.payment_key) return { error: "결제 정보가 올바르지 않습니다." }

  const isFullRefund = refundAmount === order.amount
  const cancelResult = await cancelPayment(
    order.payment_key,
    "사용자 직접 환불 요청",
    isFullRefund ? undefined : refundAmount,
  )

  if (cancelResult.error) return { error: cancelResult.error }

  await supabase
    .from("credit_orders")
    .update({
      payment_status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_amount: refundAmount,
    })
    .eq("order_id", orderId)

  await supabase
    .from("users_subscription")
    .update({
      analysis_credits: remainingCredits - refundableCredits,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)

  return {
    success: true,
    refundAmount,
    refundedCredits: refundableCredits,
    remainingCredits: remainingCredits - refundableCredits,
  }
}
