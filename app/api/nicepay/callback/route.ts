/**
 * NICEPayments 결제 인증 결과 수신 (Server 승인 모델)
 *
 * 나이스 결제창(iframe/popup)에서 결제 완료 후 이 URL로 POST.
 * cross-origin iframe에서 window.top 접근이 안 될 수 있으므로,
 * form target="_top" 자동 제출 방식으로 부모 창 이동.
 *
 * 경로: /api/nicepay/callback
 */
import { NextRequest, NextResponse } from "next/server"

/** target="_top" form 자동 제출로 부모 창 이동 */
function redirectTop(url: string, params: Record<string, string> = {}) {
  const hiddenInputs = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${v}" />`)
    .join("\n")

  // GET 방식으로 성공 페이지 이동 (query params으로 전달)
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>결제 처리 중...</title></head>
<body>
<p>결제 처리 중입니다. 잠시만 기다려주세요...</p>
<script>
  // 방법 1: top frame 직접 이동 시도
  try { window.top.location.href = "${url}"; } catch(e) {
    // 방법 2: opener (팝업인 경우)
    try {
      if (window.opener) { window.opener.location.href = "${url}"; window.close(); }
      else { window.location.href = "${url}"; }
    } catch(e2) {
      // 방법 3: 현재 창에서 이동
      window.location.href = "${url}";
    }
  }
</script>
<noscript>
  <meta http-equiv="refresh" content="0;url=${url}" />
</noscript>
</body></html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Frame-Options": "ALLOWALL",
    },
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

    console.log("[nicepay-callback] 수신:", { authResultCode, tid, orderId, amount, mallReserved })

    let callbackType = "credits"
    let plan = ""
    let discountCode = ""
    try {
      const reserved = JSON.parse(mallReserved || "{}")
      callbackType = reserved.type || "credits"
      plan = reserved.plan || ""
      discountCode = reserved.discountCode || ""
    } catch {
      // 파싱 실패
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin

    // 인증 실패
    if (authResultCode !== "0000") {
      const failPath = callbackType === "billing" ? "billing" : "credits"
      const failUrl = `${baseUrl}/payment/${failPath}/fail?code=${encodeURIComponent(authResultCode || "UNKNOWN")}&message=${encodeURIComponent(authResultMsg || "결제 인증 실패")}`
      console.log("[nicepay-callback] 인증 실패 → redirect:", failUrl)
      return redirectTop(failUrl)
    }

    // 인증 성공
    let successUrl: string
    if (callbackType === "billing") {
      successUrl = `${baseUrl}/payment/billing/success?tid=${encodeURIComponent(tid)}&orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}&plan=${encodeURIComponent(plan)}&discountCode=${encodeURIComponent(discountCode)}`
    } else {
      successUrl = `${baseUrl}/payment/credits/success?tid=${encodeURIComponent(tid)}&orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}`
    }

    console.log("[nicepay-callback] 인증 성공 → redirect:", successUrl)
    return redirectTop(successUrl)
  } catch (error) {
    console.error("[nicepay-callback] 처리 오류:", error)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return redirectTop(
      `${baseUrl}/payment/credits/fail?code=CALLBACK_ERROR&message=${encodeURIComponent("결제 처리 중 오류가 발생했습니다.")}`,
    )
  }
}
