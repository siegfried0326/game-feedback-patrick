/**
 * NICEPayments 결제 인증 결과 수신 (Server 승인 모델)
 *
 * 나이스 결제창(iframe/popup)에서 결제 완료 후 이 URL로 POST.
 * cross-origin iframe에서 window.top 접근이 안 될 수 있으므로,
 * form target="_top" 자동 제출 방식으로 부모 창 이동.
 *
 * 경로: /api/nicepay/callback
 *
 * 보안: signature 검증으로 위조된 결제 완료 콜백을 차단한다.
 * 서명 공식: SHA256(authToken + clientId + amount + SecretKey)
 */
import { NextRequest, NextResponse } from "next/server"
import { verifySignature } from "@/lib/nice-api"

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
    const authToken = formData.get("authToken") as string
    const signature = formData.get("signature") as string
    const clientIdFromForm = formData.get("clientId") as string

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
    const failPath = callbackType === "billing" ? "billing" : "credits"

    // 인증 실패
    if (authResultCode !== "0000") {
      const failUrl = `${baseUrl}/payment/${failPath}/fail?code=${encodeURIComponent(authResultCode || "UNKNOWN")}&message=${encodeURIComponent(authResultMsg || "결제 인증 실패")}`
      console.log("[nicepay-callback] 인증 실패 → redirect:", failUrl)
      return redirectTop(failUrl)
    }

    // 서명 검증 (위조 방지): 인증 성공일 때만 수행
    // NICEPay V2 공식: signature = SHA256(authToken + clientId + amount + SecretKey)
    // 필수 파라미터 누락 시 즉시 차단
    if (!authToken || !signature || !amount) {
      console.error("[nicepay-callback] 필수 서명 파라미터 누락:", { hasAuthToken: !!authToken, hasSignature: !!signature, hasAmount: !!amount })
      return redirectTop(
        `${baseUrl}/payment/${failPath}/fail?code=INVALID_SIGNATURE&message=${encodeURIComponent("결제 검증 정보가 누락되었습니다.")}`,
      )
    }

    const expectedClientId = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID || ""
    // 콜백으로 들어온 clientId가 있으면 우리 clientId와 일치하는지도 확인
    if (clientIdFromForm && clientIdFromForm !== expectedClientId) {
      console.error("[nicepay-callback] clientId 불일치:", { received: clientIdFromForm, expected: expectedClientId })
      return redirectTop(
        `${baseUrl}/payment/${failPath}/fail?code=CLIENT_ID_MISMATCH&message=${encodeURIComponent("결제 검증에 실패했습니다.")}`,
      )
    }

    try {
      const expectedSignature = verifySignature(authToken, expectedClientId, amount)
      if (signature !== expectedSignature) {
        console.error("[nicepay-callback] 서명 불일치 — 위조된 콜백 의심", { orderId, tid })
        return redirectTop(
          `${baseUrl}/payment/${failPath}/fail?code=SIGNATURE_MISMATCH&message=${encodeURIComponent("결제 검증에 실패했습니다.")}`,
        )
      }
    } catch (sigErr) {
      console.error("[nicepay-callback] 서명 검증 중 오류:", sigErr)
      return redirectTop(
        `${baseUrl}/payment/${failPath}/fail?code=SIGNATURE_ERROR&message=${encodeURIComponent("결제 검증 중 오류가 발생했습니다.")}`,
      )
    }

    // 서명 검증 통과 → 인증 성공 URL로 이동
    let successUrl: string
    if (callbackType === "billing") {
      successUrl = `${baseUrl}/payment/billing/success?tid=${encodeURIComponent(tid)}&orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}&plan=${encodeURIComponent(plan)}&discountCode=${encodeURIComponent(discountCode)}`
    } else {
      successUrl = `${baseUrl}/payment/credits/success?tid=${encodeURIComponent(tid)}&orderId=${encodeURIComponent(orderId)}&amount=${encodeURIComponent(amount)}`
    }

    console.log("[nicepay-callback] 서명 검증 성공 → redirect:", successUrl)
    return redirectTop(successUrl)
  } catch (error) {
    console.error("[nicepay-callback] 처리 오류:", error)
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin
    return redirectTop(
      `${baseUrl}/payment/credits/fail?code=CALLBACK_ERROR&message=${encodeURIComponent("결제 처리 중 오류가 발생했습니다.")}`,
    )
  }
}
