/**
 * 라이브러리 그래프 뷰 — Obsidian 풍 force graph
 *
 *  - react-force-graph-2d (canvas 기반)
 *  - 도메인/타입 색상, 노드 크기 = 연결도
 *  - 드래그·줌·필터·노드 클릭 → 우측 패널
 */
"use client"

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { Loader2, X } from "lucide-react"
import {
  LibraryGraph,
  LibraryGraphNode,
  LibraryType,
  TYPE_LABELS,
  TYPE_COLORS,
  Domain,
  DOMAIN_COLORS,
} from "@/lib/library/types"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
})

const TYPE_OPTIONS: LibraryType[] = [
  "principle",
  "designer",
  "pattern",
  "antipattern",
  "learning_path",
  "lineage",
  "genre_guide",
  "core_rule",
  "source",
  "gdc_talk",
  "level_design_supplement",
]

const DOMAIN_OPTIONS: Domain[] = ["전투", "시스템", "내러티브", "레벨", "프로덕션"]

export function GraphView() {
  const [graph, setGraph] = useState<LibraryGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<LibraryGraphNode | null>(null)
  const [typeFilter, setTypeFilter] = useState<Set<LibraryType>>(
    new Set(["principle", "designer", "pattern", "antipattern", "learning_path", "lineage", "genre_guide", "core_rule"])
  )
  const [domainFilter, setDomainFilter] = useState<Set<Domain>>(new Set(DOMAIN_OPTIONS))
  const [query, setQuery] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })

  // 초기 로드
  useEffect(() => {
    fetch("/api/library/graph")
      .then((r) => r.json())
      .then((data) => {
        setGraph(data)
        setLoading(false)
      })
      .catch((err) => {
        console.error(err)
        setLoading(false)
      })
  }, [])

  // 컨테이너 크기 추적
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) {
        setDimensions({ width: e.contentRect.width, height: e.contentRect.height })
      }
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const filtered = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }
    const q = query.trim().toLowerCase()
    const visibleNodes = graph.nodes.filter((n) => {
      if (!typeFilter.has(n.type)) return false
      if (n.type === "principle" && n.domain && !domainFilter.has(n.domain)) return false
      if (q && !n.title.toLowerCase().includes(q)) return false
      return true
    })
    const ids = new Set(visibleNodes.map((n) => n.id))
    const visibleLinks = graph.links
      .filter((l) => ids.has(l.source as string) && ids.has(l.target as string))
      .map((l) => ({ ...l }))
    return { nodes: visibleNodes.map((n) => ({ ...n })), links: visibleLinks }
  }, [graph, typeFilter, domainFilter, query])

  // 연결도 카운트
  const linkCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of filtered.links) {
      counts[l.source as string] = (counts[l.source as string] || 0) + 1
      counts[l.target as string] = (counts[l.target as string] || 0) + 1
    }
    return counts
  }, [filtered.links])

  function toggleType(t: LibraryType) {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  function toggleDomain(d: Domain) {
    setDomainFilter((prev) => {
      const next = new Set(prev)
      if (next.has(d)) next.delete(d)
      else next.add(d)
      return next
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4 h-[calc(100vh-180px)]">
      {/* 좌측 필터 */}
      <aside className="overflow-y-auto rounded-2xl border border-[#1e3a5f] bg-slate-900/60 p-4 space-y-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">검색</label>
          <input
            type="text"
            placeholder="노드 제목 필터"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-slate-950/60 border border-[#1e3a5f] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-[#5B8DEF] focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">타입</label>
          <div className="space-y-1">
            {TYPE_OPTIONS.map((t) => {
              const active = typeFilter.has(t)
              const count = graph?.nodes.filter((n) => n.type === t).length || 0
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={
                    "w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border transition-colors " +
                    (active
                      ? "bg-slate-800/60 border-[#1e3a5f] text-slate-200"
                      : "bg-transparent border-transparent text-slate-600 hover:text-slate-400")
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: TYPE_COLORS[t] }}
                    />
                    {TYPE_LABELS[t]}
                  </span>
                  <span className="text-slate-600 text-[10px]">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 block">도메인 (원칙)</label>
          <div className="space-y-1">
            {DOMAIN_OPTIONS.map((d) => {
              const active = domainFilter.has(d)
              const count = graph?.nodes.filter((n) => n.type === "principle" && n.domain === d).length || 0
              return (
                <button
                  key={d}
                  onClick={() => toggleDomain(d)}
                  className={
                    "w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border transition-colors " +
                    (active
                      ? "bg-slate-800/60 border-[#1e3a5f] text-slate-200"
                      : "bg-transparent border-transparent text-slate-600 hover:text-slate-400")
                  }
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ background: DOMAIN_COLORS[d] }}
                    />
                    {d}
                  </span>
                  <span className="text-slate-600 text-[10px]">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-[#1e3a5f] text-[11px] text-slate-500 space-y-0.5">
          <div>표시: 노드 {filtered.nodes.length} · 엣지 {filtered.links.length}</div>
          <div>전체: 노드 {graph?.nodes.length || 0} · 엣지 {graph?.links.length || 0}</div>
        </div>
      </aside>

      {/* 그래프 캔버스 */}
      <div
        ref={containerRef}
        className="rounded-2xl border border-[#1e3a5f] bg-[#050d1f] overflow-hidden relative"
      >
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs">{graph ? "필터 적용 중" : "그래프 로드 중"}</p>
          </div>
        ) : (
          <ForceGraph2D
            graphData={filtered}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#050d1f"
            nodeRelSize={3}
            nodeVal={(n) => {
              const id = (n as LibraryGraphNode).id
              return 1 + (linkCount[id] || 0) * 0.5
            }}
            nodeColor={(n) => (n as LibraryGraphNode).color}
            nodeLabel={(n) => (n as LibraryGraphNode).title}
            linkColor={() => "rgba(91,141,239,0.18)"}
            linkWidth={0.6}
            linkDirectionalParticles={0}
            cooldownTime={4000}
            warmupTicks={50}
            onNodeClick={(n) => setSelected(n as LibraryGraphNode)}
            nodeCanvasObjectMode={() => "after"}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const n = node as LibraryGraphNode & { x?: number; y?: number }
              if (globalScale < 1.5) return
              if (typeof n.x !== "number" || typeof n.y !== "number") return
              const fontSize = 10 / globalScale
              ctx.font = `${fontSize}px sans-serif`
              ctx.textAlign = "center"
              ctx.textBaseline = "middle"
              ctx.fillStyle = "rgba(226,232,240,0.85)"
              const label = n.label
              const yOffset = 4 + (linkCount[n.id] || 0) * 0.2
              ctx.fillText(label, n.x, n.y + yOffset)
            }}
          />
        )}
      </div>

      {/* 우측 상세 */}
      <aside className="rounded-2xl border border-[#1e3a5f] bg-slate-900/60 p-4 overflow-y-auto">
        {selected ? (
          <div className="space-y-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <span
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
                style={{
                  borderColor: selected.color + "55",
                  color: selected.color,
                  background: selected.color + "11",
                }}
              >
                {TYPE_LABELS[selected.type]}
                {selected.domain ? ` · ${selected.domain}` : ""}
              </span>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 className="text-base font-semibold text-white leading-snug">
              {selected.title}
            </h3>
            <div className="text-xs text-slate-500 space-y-0.5">
              <div>연결: {linkCount[selected.id] || 0}개</div>
              {selected.status && <div>상태: {selected.status}</div>}
              {selected.preview && <div className="text-emerald-400">공개 (preview: true)</div>}
            </div>
            <Link
              href={`/library/${typeToRouteUrl(selected.type)}/${encodeURIComponent(selected.slug)}`}
              className="inline-flex items-center gap-1.5 text-xs bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              상세 보기 →
            </Link>
          </div>
        ) : (
          <div className="text-xs text-slate-500 space-y-2">
            <p>노드를 클릭해 상세 정보를 보세요.</p>
            <p className="text-slate-600 leading-relaxed">
              · 마우스 휠: 확대/축소<br />
              · 드래그: 이동<br />
              · 좌측 필터: 타입·도메인 토글
            </p>
          </div>
        )}
      </aside>
    </div>
  )
}

// 그래프 → URL 변환 (loader의 typeToRoute와 동일 로직, 클라이언트 분리)
const TYPE_ROUTE_INLINE: Record<LibraryType, string> = {
  principle: "principles",
  designer: "designers",
  pattern: "patterns",
  antipattern: "antipatterns",
  learning_path: "paths",
  lineage: "lineage",
  genre_guide: "genres",
  core_rule: "core",
  source: "sources",
  gdc_talk: "gdc",
  level_design_supplement: "level-design",
  index: "index",
  meta: "meta",
  other: "other",
}

function typeToRouteUrl(t: LibraryType) {
  return TYPE_ROUTE_INLINE[t]
}
