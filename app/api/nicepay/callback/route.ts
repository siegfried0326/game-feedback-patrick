/**
 * NICEPayments 결제 인증 결과 수신 (Server 승인 모델)
 *
 * 나이스페이먼츠는 결제 인증 완료 후 returnUrl로 POST 요청을 보낸다.
 * (토스페이먼츠는 GET redirect)
 *
 * 흐름:
 * 1. 결제창에서 카드 인증 완료
 * 2. 나이스가 이 URL로 POST (tid, authResultCode, amount 등)
 * 3. 서명 검증 후 → 프론트엔드 성공/실패 페이지로 redirect
 * 4. 프론트에서 tid로 서버 액션 호출 → 승인 API 호출
 *
 * 경로: /api/nicepay/callback
 */
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const authResultCode = formData.get("authResultCode") as string
    const authResultMsg = formData.get("authResultMsg") as string
    const tid = formData.get("tid") as string
    const orderId = formData.get("orderId") as string
    const amount = formData.get("amount") as string
    const mallReserved = formData.get("mallReserved") as string
    const signature = formData.get("signature") as string
    const authToken = formData.get("authToken") as string

    // mallReserved에서 원래 목적(credits/billing)과 기타 정보 파싱
    let callbackType = "credits"
    let plan = ""
    let discountCode = ""
    try {
      const reserved = JSON.parse(mallReserved || "{}")
      callbackType = reserved.type || "credits"
      plan = reserved.plan || ""
      discountCode = reserved.discountCode || ""
    } catch {
      // mallReserved 파싱 실패 시 기본값 사용
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    // 인증 실패
    if (authResultCode !== "0000") {
      const failUrl = callbackType === "billing"
        ? `${baseUrl}/payment/billing/fail?code=${authResultCode}&message=${encodeURIComponent(authResultMsg || "결제 인증 실패")}`
        : `${baseUrl}/payment/credits/fail?code=${authResultCode}&message=${encodeURIComponent(authResultMsg || "결제 인증 실패")}`
      return NextResponse.redirect(failUrl, { status: 303 })
    }

    // 인증 성공 → 프론트엔드 성공 페이지로 redirect (tid, orderId, amount 전달)
    if (callbackType === "billing") {
      const successUrl = `${baseUrl}/payment/billing/success?tid=${tid}&orderId=${orderId}&amount=${amount}&plan=${plan}&discountCode=${encodeURIComponent(discountCode)}`
      return NextResponse.redirect(successUrl, { status: 303 })
    } else {
      const successUrl = `${baseUrl}/payment/credits/success?tid=${tid}&orderId=${orderId}&amount=${amount}`
      return NextResponse.redirect(successUrl, { status: 303 })
    }
  } catch (error) {
    console.error("[nicepay-callback] 처리 오류:", error)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return NextResponse.redirect(
      `${baseUrl}/payment/credits/fail?code=CALLBACK_ERROR&message=${encodeURIComponent("결제 처리 중 오류가 발생했습니다.")}`,
      { status: 303 },
    )
  }
}
