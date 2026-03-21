/**
 * NICEPayments 결제 인증 결과 수신 (Server 승인 모델)
 *
 * PC에서는 결제창이 팝업/iframe으로 열리므로,
 * NextResponse.redirect()가 팝업 안에서만 작동한다.
 * → HTML 응답으로 부모 창(window.top)을 이동시켜야 함.
 *
 * 경로: /api/nicepay/callback
 */
import { NextRequest, NextResponse } from "next/server"

/** 부모 창을 redirectUrl로 이동시키는 HTML 반환 */
function redirectParent(redirectUrl: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body>
<script>
  if (window.top) {
    window.top.location.href = "${redirectUrl}";
  } else if (window.opener) {
    window.opener.location.href = "${redirectUrl}";
    window.close();
  } else {
    window.location.href = "${redirectUrl}";
  }
</script>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    const authResultCode = formData.get("authResultCode") as string
    const authResultMsg = formData.get("authResultMsg") as string
    const tid = formData.get("tid") as string
    const orderId = formData.get("orderId") as string
    const amount = formData.get("amount") as string
    const mallReserved = formData.get("mallReserved") as string

    // mallReserved에서 결제 유형 파싱
    let callbackType = "credits"
    let plan = ""
    let discountCode = ""
    try {
      const reserved = JSON.parse(mallReserved || "{}")
      callbackType = reserved.type || "credits"
      plan = reserved.plan || ""
      discountCode = reserved.discountCode || ""
    } catch {
      // 파싱 실패 시 기본값
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    // 인증 실패
    if (authResultCode !== "0000") {
      const failPath = callbackType === "billing" ? "billing" : "credits"
      const failUrl = `${baseUrl}/payment/${failPath}/fail?code=${authResultCode}&message=${encodeURIComponent(authResultMsg || "결제 인증 실패")}`
      return redirectParent(failUrl)
    }

    // 인증 성공 → 성공 페이지로 이동 (tid 전달)
    if (callbackType === "billing") {
      const successUrl = `${baseUrl}/payment/billing/success?tid=${tid}&orderId=${orderId}&amount=${amount}&plan=${plan}&discountCode=${encodeURIComponent(discountCode)}`
      return redirectParent(successUrl)
    } else {
      const successUrl = `${baseUrl}/payment/credits/success?tid=${tid}&orderId=${orderId}&amount=${amount}`
      return redirectParent(successUrl)
    }
  } catch (error) {
    console.error("[nicepay-callback] 처리 오류:", error)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return redirectParent(
      `${baseUrl}/payment/credits/fail?code=CALLBACK_ERROR&message=${encodeURIComponent("결제 처리 중 오류가 발생했습니다.")}`,
    )
  }
}
