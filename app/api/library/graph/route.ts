/**
 * GET /api/library/graph — 라이브러리 그래프 노드/엣지 JSON
 *  - 클라이언트 그래프 컴포넌트가 비동기로 로드
 *  - filter: ?types=principle,designer&domains=전투,시스템
 */

import { NextRequest, NextResponse } from "next/server"
import { getGraph } from "@/lib/library/loader"
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
  const typesParam = searchParams.get("types")
  const domainsParam = searchParams.get("domains")
  const includeKinds = searchParams.get("kinds")

  const types = typesParam ? new Set(typesParam.split(",")) : null
  const domains = domainsParam ? new Set(domainsParam.split(",")) : null
  const kinds = includeKinds ? new Set(includeKinds.split(",")) : null

  const graph = await getGraph()

  const filteredNodes = graph.nodes.filter((n) => {
    if (types && !types.has(n.type)) return false
    if (domains && (!n.domain || !domains.has(n.domain))) return false
    return true
  })
  const nodeIds = new Set(filteredNodes.map((n) => n.id))

  const filteredLinks = graph.links.filter((l) => {
    if (!nodeIds.has(l.source) || !nodeIds.has(l.target)) return false
    if (kinds && !kinds.has(l.kind)) return false
    return true
  })

  return NextResponse.json({
    nodes: filteredNodes,
    links: filteredLinks,
    stats: {
      nodeCount: filteredNodes.length,
      linkCount: filteredLinks.length,
    },
  })
}
