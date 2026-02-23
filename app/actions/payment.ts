"use server"

import { createClient } from "@/lib/supabase/server"

const TOSS_SECRET_KEY = process.env.TOSS_SECRET_KEY || "test_sk_XjExPeJWYVQR12P55agr49R5gvNL"
const TOSS_API_BASE = "https://api.tosspayments.com/v1"

function getAuthHeader() {
  const encoded = Buffer.from(`${TOSS_SECRET_KEY}:`).toString("base64")
  return `Basic ${encoded}`
}

/**
 * 빌링키 발급 (카드 등록 후 authKey로 빌링키 발급)
 */
export async function issueBillingKey(authKey: string, customerKey: string) {
  const response = await fetch(`${TOSS_API_BASE}/billing/authorizations/issue`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ authKey, customerKey }),
  })

  const data = await response.json()

  if (!response.ok) {
    return { error: data.message || "빌링키 발급에 실패했습니다." }
  }

  return { data }
}

/**
 * 빌링키로 자동결제 승인
 */
export async function approveBillingPayment(
  billingKey: string,
  customerKey: string,
  amount: number,
  orderId: string,
  orderName: string,
) {
  const response = await fetch(`${TOSS_API_BASE}/billing/${billingKey}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customerKey,
      amount,
      orderId,
      orderName,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    return { error: data.message || "결제 승인에 실패했습니다." }
  }

  return { data }
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
  const expiresAt = new Date(now)
  if (plan === "monthly") {
    expiresAt.setMonth(expiresAt.getMonth() + 1)
  } else {
    expiresAt.setMonth(expiresAt.getMonth() + 3)
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
      discount_code: discountCode || null,
    }, { onConflict: "user_id" })

  if (dbError) return { error: dbError.message }

  return { success: true, paymentKey: paymentResult.data.paymentKey }
}

/**
 * 빌링키 삭제 (구독 해지 시)
 */
export async function deleteBillingKey(billingKey: string) {
  const response = await fetch(`${TOSS_API_BASE}/billing/${billingKey}`, {
    method: "DELETE",
    headers: {
      Authorization: getAuthHeader(),
    },
  })

  if (!response.ok) {
    const data = await response.json()
    return { error: data.message || "빌링키 삭제에 실패했습니다." }
  }

  return { success: true }
}

/**
 * 일반결제 확인 (컨설팅 결제용)
 */
export async function confirmPayment(paymentKey: string, orderId: string, amount: number) {
  const response = await fetch(`${TOSS_API_BASE}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  })

  const data = await response.json()

  if (!response.ok) {
    return { error: data.message || "결제 확인에 실패했습니다." }
  }

  return { data }
}
