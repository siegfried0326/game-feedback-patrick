/**
 * 전역 에러 핸들러 (루트 레이아웃 포함) — app/global-error.tsx
 *
 * app/layout.tsx 자체에서 에러가 발생할 때 표시.
 * html, body 태그를 직접 포함해야 함.
 */
"use client"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="ko">
      <body style={{ backgroundColor: "#0d1b2a", margin: 0 }}>
        <main style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <h1 style={{ color: "white", fontSize: "24px", marginBottom: "12px" }}>
              문제가 발생했습니다
            </h1>
            <p style={{ color: "#94a3b8", marginBottom: "24px", lineHeight: 1.6 }}>
              페이지를 불러오는 중 오류가 발생했습니다.
              <br />
              잠시 후 다시 시도해 주세요.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "10px 24px",
                borderRadius: "12px",
                backgroundColor: "#5B8DEF",
                color: "white",
                border: "none",
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              다시 시도
            </button>
          </div>
        </main>
      </body>
    </html>
  )
}
