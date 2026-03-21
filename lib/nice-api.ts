/**
 * NICEPayments API 호출 헬퍼 (서버 전용)
 *
 * "use server" 파일이 아니므로 HTTP 엔드포인트로 노출되지 않음.
 * 결제 관련 서버 액션(payment.ts, subscription.ts)에서 import하여 사용.
 *
 * 환경변수: NEXT_PUBLIC_NICEPAY_CLIENT_ID, NICEPAY_SECRET_KEY
 *
 * API 문서: https://github.com/nicepayments/nicepay-manual
 */

import crypto from "crypto"

const NICE_API_BASE = "https://api.nicepay.co.kr/v1"

function getClientId() {
  const id = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID
  if (!id) throw new Error("NEXT_PUBLIC_NICEPAY_CLIENT_ID 환경변수가 설정되지 않았습니다.")
  return id
}

function getSecretKey() {
  const key = process.env.NICEPAY_SECRET_KEY
  if (!key) throw new Error("NICEPAY_SECRET_KEY 환경변수가 설정되지 않았습니다.")
  return key
}

/**
 * Basic 인증 헤더 생성
 * 나이스: base64(clientId:secretKey) — 토스와 다름!
 */
function getAuthHeader() {
  const clientId = getClientId()
  const secretKey = getSecretKey()
  const encoded = Buffer.from(`${clientId}:${secretKey}`).toString("base64")
  return `Basic ${encoded}`
}

/**
 * 서명 데이터 생성 (위변조 검증용)
 */
export function createSignData(...values: string[]) {
  const raw = values.join("")
  return crypto.createHash("sha256").update(raw).digest("hex")
}

/**
 * 결제 승인 (Server 승인 모델)
 * 결제창 인증 후 returnUrl로 받은 tid로 승인 요청
 */
export async function approvePayment(tid: string, amount: number) {
  const response = await fetch(`${NICE_API_BASE}/payments/${tid}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  })

  const data = await response.json()

  if (data.resultCode !== "0000") {
    return { error: data.resultMsg || "결제 승인에 실패했습니다." }
  }

  return { data }
}

/**
 * 결제 취소 (환불)
 * - cancelAmt가 없으면 전액 환불
 * - cancelAmt가 있으면 부분 환불
 */
export async function cancelPayment(
  tid: string,
  reason: string,
  cancelAmt?: number,
) {
  const body: Record<string, unknown> = {
    reason,
    orderId: `CANCEL_${Date.now()}`,
  }
  if (cancelAmt !== undefined) {
    body.cancelAmt = cancelAmt
  }

  const response = await fetch(`${NICE_API_BASE}/payments/${tid}/cancel`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  const data = await response.json()

  if (data.resultCode !== "0000") {
    return { error: data.resultMsg || "환불 처리에 실패했습니다." }
  }

  return { data }
}

/**
 * 빌링키 발급 (구독용 — 카드 정보 암호화 후 등록)
 * 나이스는 카드 정보를 AES 암호화하여 직접 전송
 * 결제창 방식이 아닌 API 직접 방식
 */
export async function issueBillingKey(encData: string, orderId: string) {
  const response = await fetch(`${NICE_API_BASE}/subscribe/regist`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ encData, orderId }),
  })

  const data = await response.json()

  if (data.resultCode !== "0000") {
    return { error: data.resultMsg || "빌링키 발급에 실패했습니다." }
  }

  return { data }
}

/**
 * 빌링키로 자동결제 승인
 */
export async function approveBillingPayment(
  bid: string,
  orderId: string,
  amount: number,
  goodsName: string,
) {
  const response = await fetch(`${NICE_API_BASE}/subscribe/${bid}/payments`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      orderId,
      amount,
      goodsName,
      cardQuota: "0",
      useShopInterest: false,
    }),
  })

  const data = await response.json()

  if (data.resultCode !== "0000") {
    return { error: data.resultMsg || "결제 승인에 실패했습니다." }
  }

  return { data }
}

/**
 * 빌링키 삭제 (구독 해지 시)
 */
export async function deleteBillingKey(bid: string) {
  const orderId = `DEL_${Date.now()}`
  const response = await fetch(`${NICE_API_BASE}/subscribe/${bid}/expire`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orderId }),
  })

  const data = await response.json()

  if (data.resultCode !== "0000") {
    return { error: data.resultMsg || "빌링키 삭제에 실패했습니다." }
  }

  return { success: true }
}

/**
 * 인증 결과 서명 검증 (returnUrl로 받은 데이터 위변조 확인)
 */
export function verifySignature(
  authToken: string,
  clientId: string,
  amount: string,
): string {
  const secretKey = getSecretKey()
  return createSignData(authToken, clientId, amount, secretKey)
}
