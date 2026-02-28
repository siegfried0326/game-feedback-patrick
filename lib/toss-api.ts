/**
 * TossPayments API 호출 헬퍼 (서버 전용)
 *
 * "use server" 파일이 아니므로 HTTP 엔드포인트로 노출되지 않음.
 * 결제 관련 서버 액션(payment.ts, tutoring.ts, subscription.ts)에서 import하여 사용.
 *
 * 환경변수: TOSS_SECRET_KEY
 */

const TOSS_API_BASE = "https://api.tosspayments.com/v1"

function getAuthHeader() {
  const key = process.env.TOSS_SECRET_KEY
  if (!key) throw new Error("TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.")
  const encoded = Buffer.from(`${key}:`).toString("base64")
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
