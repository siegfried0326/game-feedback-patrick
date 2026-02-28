/**
 * API 라우트 동작 테스트용
 * GET/POST /api/test → { ok: true }
 */
export async function GET() {
  return Response.json({ ok: true, method: "GET", time: new Date().toISOString() })
}

export async function POST() {
  return Response.json({ ok: true, method: "POST", time: new Date().toISOString() })
}
