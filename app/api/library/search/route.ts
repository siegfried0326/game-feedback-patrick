/**
 * GET /api/library/search?q=...&type=...&domain=...
 *   - 클라이언트 fetch용 키워드 검색 (title/tags/designers/games_referenced)
 *   - vector 검색은 별도 엔드포인트
 */

import { NextRequest, NextResponse } from "next/server"
import { getAllSummaries } from "@/lib/library/loader"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  // 라이브러리 관리자 전용 게이팅
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get("q") || "").trim().toLowerCase()
  const type = searchParams.get("type") || null
  const domain = searchParams.get("domain") || null
  const previewOnly = searchParams.get("preview") === "true"
  const limit = Math.min(Number(searchParams.get("limit") || 50), 200)

  const all = await getAllSummaries()
  const results = all.filter((d) => {
    if (type && d.type !== type) return false
    if (domain && d.domain !== domain) return false
    if (previewOnly && !d.preview) return false
    if (!q) return true
    const hay = [
      d.title,
      d.titleEn,
      d.principleId,
      ...(d.tags || []),
      ...(d.designers || []),
      ...(d.gamesReferenced || []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    return hay.includes(q)
  })

  return NextResponse.json({
    query: q,
    total: results.length,
    results: results.slice(0, limit),
  })
}
