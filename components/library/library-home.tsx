/**
 * 라이브러리 홈 — Obsidian 풍 메인:
 *   - 풀스크린 그래프 (1,243 노드)
 *   - 상단 인스턴트 검색바 (드롭다운 결과)
 *   - 좌측 토픽·도메인·타입 필터
 *   - 우측 디자이너 TOP + 통계
 *   - 클릭한 노드 → 우측 상세 패널
 */
"use client"

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import {
  Loader2,
  Search,
  X,
  ArrowUpRight,
  Network,
  Sparkles,
} from "lucide-react"
import {
  LibrarySummary,
  LibraryGraph,
  LibraryGraphNode,
  LibraryType,
  TYPE_LABELS,
  TYPE_COLORS,
  Domain,
  DOMAIN_COLORS,
  Topic,
  TOPIC_LABELS,
  TOPIC_COLORS,
  TOPIC_ORDER,
  LibraryStats,
} from "@/lib/library/types"
import { getDocumentUrl } from "@/lib/library/routes"

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center text-slate-500">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
})

const DOMAIN_LIST: Domain[] = ["전투", "시스템", "내러티브", "레벨", "프로덕션"]
const TYPE_LIST: LibraryType[] = [
  "principle", "designer", "pattern", "antipattern",
  "learning_path", "lineage", "genre_guide", "core_rule",
  "source", "gdc_talk", "level_design_supplement",
]

interface Props {
  summaries: LibrarySummary[]
  stats: LibraryStats
}

export function LibraryHome({ summaries, stats }: Props) {
  const [graph, setGraph] = useState<LibraryGraph | null>(null)
  const [graphLoading, setGraphLoading] = useState(true)
  const [selected, setSelected] = useState<LibraryGraphNode | null>(null)
  const [topicFilter, setTopicFilter] = useState<Set<Topic>>(new Set())
  const [domainFilter, setDomainFilter] = useState<Set<Domain>>(new Set())
  const [typeFilter, setTypeFilter] = useState<Set<LibraryType>>(
    new Set([
      "principle", "designer", "pattern", "antipattern",
      "learning_path", "lineage", "genre_guide", "core_rule",
    ])
  )

  const [searchQuery, setSearchQuery] = useState("")
  const deferredSearch = useDeferredValue(searchQuery)
  const [searchOpen, setSearchOpen] = useState(false)

  // 검색 → 라이브러리 메타에서 상위 8개
  const searchResults = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase()
    if (!q) return []
    const matches = summaries.filter((d) => {
      const hay = [
        d.title,
        d.titleEn,
        d.principleId,
        ...(d.tags || []),
        ...(d.designers || []),
        ...(d.gamesReferenced || []),
      ].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })
    return matches.slice(0, 10)
  }, [summaries, deferredSearch])

  // 그래프 fetch
  useEffect(() => {
    fetch("/api/library/graph")
      .then((r) => r.json())
      .then((data) => {
        setGraph(data)
        setGraphLoading(false)
      })
      .catch((e) => {
        console.error(e)
        setGraphLoading(false)
      })
  }, [])

  // 그래프 필터링
  const filteredGraph = useMemo(() => {
    if (!graph) return { nodes: [], links: [] }
    const q = deferredSearch.trim().toLowerCase()
    const visibleNodes = graph.nodes.filter((n) => {
      if (typeFilter.size > 0 && !typeFilter.has(n.type)) return false
      if (domainFilter.size > 0 && (!n.domain || !domainFilter.has(n.domain))) return false
      if (topicFilter.size > 0) {
        const hits = (n.topics || []).some((t) => topicFilter.has(t as Topic))
        if (!hits) return false
      }
      if (q && !n.title.toLowerCase().includes(q)) return false
      return true
    })
    const ids = new Set(visibleNodes.map((n) => n.id))
    const visibleLinks = graph.links
      .filter((l) => ids.has(l.source as string) && ids.has(l.target as string))
      .map((l) => ({ ...l }))
    return { nodes: visibleNodes.map((n) => ({ ...n })), links: visibleLinks }
  }, [graph, typeFilter, domainFilter, topicFilter, deferredSearch])

  // 그래프 컨테이너 크기
  const canvasRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  useEffect(() => {
    if (!canvasRef.current) return
    const ro = new ResizeObserver((entries) => {
      const e = entries[0]
      if (e) setDimensions({ width: e.contentRect.width, height: e.contentRect.height })
    })
    ro.observe(canvasRef.current)
    return () => ro.disconnect()
  }, [])

  // 연결도
  const linkCount = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of filteredGraph.links) {
      counts[l.source as string] = (counts[l.source as string] || 0) + 1
      counts[l.target as string] = (counts[l.target as string] || 0) + 1
    }
    return counts
  }, [filteredGraph.links])

  // 디자이너 TOP 15
  const topDesigners = useMemo(() => {
    return Object.entries(stats.byDesigner || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
  }, [stats])

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setter(next)
  }

  return (
    <div className="space-y-4">
      {/* 상단 검색 + 통계 헤더 */}
      <div className="rounded-2xl border border-[#1e3a5f] bg-gradient-to-br from-[#0d1f3c] via-[#0a1628] to-[#0d1f3c] p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-5 h-5 text-[#5B8DEF]" />
              <span className="text-xs uppercase tracking-wider text-[#5B8DEF]">GameDesignLibrary</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">
              {stats.totalDocuments.toLocaleString()}편의 게임 디자인 자료
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              80+ 디자이너 · {stats.totalEdges.toLocaleString()}개 위키링크 · 주제·계보·장르별 큐레이션
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            <Stat label="원칙" value={stats.byType.principle} color="#5B8DEF" />
            <Stat label="디자이너" value={stats.byType.designer} color="#facc15" />
            <Stat label="패턴" value={stats.byType.pattern} color="#06b6d4" />
            <Stat label="안티" value={stats.byType.antipattern} color="#f87171" />
            <Stat label="GDC" value={stats.byType.gdc_talk} color="#64748b" />
          </div>
        </div>

        {/* 인스턴트 검색 */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="원칙·디자이너·게임명·태그 검색"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            className="w-full bg-slate-950/60 border border-[#1e3a5f] rounded-xl pl-11 pr-10 py-3 text-slate-200 placeholder:text-slate-500 focus:border-[#5B8DEF] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("")
                setSearchOpen(false)
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-2 z-50 rounded-xl border border-[#1e3a5f] bg-slate-950/95 backdrop-blur-md shadow-2xl overflow-hidden">
              {searchResults.map((d) => (
                <Link
                  key={d.id}
                  href={getDocumentUrl(d.type, d.slug)}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-900 border-b border-[#1e3a5f]/50 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="text-sm text-slate-200 truncate">{d.title}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-2">
                      <span style={{ color: TYPE_COLORS[d.type] }}>{TYPE_LABELS[d.type]}</span>
                      {d.domain && <span>· {d.domain}</span>}
                      {d.designers?.[0] && <span>· {d.designers[0]}</span>}
                    </div>
                  </div>
                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                </Link>
              ))}
              <div className="px-4 py-2 text-[11px] text-slate-500 bg-slate-900/50">
                ↵ Enter · 더 보려면 <Link href={`/library/search?q=${encodeURIComponent(searchQuery)}`} className="text-[#5B8DEF] hover:underline">전체 검색 결과 →</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 메인: 좌(필터) + 가운데(그래프) + 우(사이드) */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4 h-[calc(100vh-280px)] min-h-[600px]">
        {/* 좌측 필터 */}
        <aside className="overflow-y-auto rounded-2xl border border-[#1e3a5f] bg-slate-900/60 p-4 space-y-5">
          <FilterBlock title="주제별">
            {TOPIC_ORDER.map((t) => {
              const count = stats.byTopic?.[t] || 0
              if (count === 0) return null
              const active = topicFilter.has(t)
              return (
                <FilterChip
                  key={t}
                  label={TOPIC_LABELS[t]}
                  count={count}
                  active={active}
                  color={TOPIC_COLORS[t]}
                  onClick={() => toggle(topicFilter, t, setTopicFilter)}
                />
              )
            })}
            <Link
              href="/library/topics"
              className="block text-[11px] text-slate-500 hover:text-[#5B8DEF] pt-2 border-t border-[#1e3a5f]"
            >
              모든 주제 보기 →
            </Link>
          </FilterBlock>

          <FilterBlock title="도메인">
            {DOMAIN_LIST.map((d) => {
              const count = stats.byDomain?.[d] || 0
              if (count === 0) return null
              return (
                <FilterChip
                  key={d}
                  label={d}
                  count={count}
                  active={domainFilter.has(d)}
                  color={DOMAIN_COLORS[d]}
                  onClick={() => toggle(domainFilter, d, setDomainFilter)}
                />
              )
            })}
          </FilterBlock>

          <FilterBlock title="타입">
            {TYPE_LIST.map((t) => {
              const count = stats.byType?.[t] || 0
              if (count === 0) return null
              return (
                <FilterChip
                  key={t}
                  label={TYPE_LABELS[t]}
                  count={count}
                  active={typeFilter.has(t)}
                  color={TYPE_COLORS[t]}
                  onClick={() => toggle(typeFilter, t, setTypeFilter)}
                />
              )
            })}
          </FilterBlock>

          <div className="pt-2 border-t border-[#1e3a5f] text-[11px] text-slate-500 space-y-0.5">
            <div>표시: 노드 {filteredGraph.nodes.length}</div>
            <div>엣지: {filteredGraph.links.length}</div>
            <div>전체: {graph?.nodes.length || 0} 노드</div>
          </div>
        </aside>

        {/* 그래프 캔버스 */}
        <div
          ref={canvasRef}
          className="rounded-2xl border border-[#1e3a5f] bg-[#050d1f] overflow-hidden relative"
        >
          {graphLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-xs">그래프 로드 중…</p>
            </div>
          ) : (
            <ForceGraph2D
              graphData={filteredGraph}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="#050d1f"
              nodeRelSize={3}
              nodeVal={(n) => 1 + (linkCount[(n as LibraryGraphNode).id] || 0) * 0.5}
              nodeColor={(n) => (n as LibraryGraphNode).color}
              nodeLabel={(n) => (n as LibraryGraphNode).title}
              linkColor={() => "rgba(91,141,239,0.16)"}
              linkWidth={0.5}
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
                ctx.fillText(n.label, n.x, n.y + 4 + (linkCount[n.id] || 0) * 0.2)
              }}
            />
          )}
        </div>

        {/* 우측 사이드 */}
        <aside className="overflow-y-auto rounded-2xl border border-[#1e3a5f] bg-slate-900/60 p-4 space-y-5">
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
                  {TYPE_LABELS[selected.type]}{selected.domain ? ` · ${selected.domain}` : ""}
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
                {selected.preview && <div className="text-emerald-400">공개 (preview: true)</div>}
              </div>
              <Link
                href={getDocumentUrl(selected.type, selected.slug)}
                className="inline-flex items-center gap-1.5 text-xs bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                상세 보기 <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
          ) : (
            <>
              <div className="text-xs text-slate-500 leading-relaxed border-b border-[#1e3a5f] pb-3">
                <p className="font-medium text-slate-300 mb-1">사용법</p>
                · 좌측 필터로 주제/도메인/타입 토글<br />
                · 위 검색바에 입력하면 그래프도 축소<br />
                · 노드 클릭 → 상세 패널<br />
                · 휠 줌, 드래그 이동
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex justify-between">
                  <span>디자이너 TOP 15</span>
                  <Link href="/library/by-designer" className="text-slate-600 hover:text-[#5B8DEF]">
                    전체 →
                  </Link>
                </div>
                <div className="space-y-0.5">
                  {topDesigners.map(([name, count]) => (
                    <Link
                      key={name}
                      href={`/library/designers/${encodeURIComponent(name)}`}
                      className="flex justify-between items-center text-xs px-2 py-1 rounded hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="text-slate-300 truncate">{name}</span>
                      <span className="text-slate-600 text-[10px]">{count}편</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">바로가기</div>
                <div className="space-y-1.5">
                  <SideLink href="/library/topics" icon={<Sparkles className="w-3 h-3" />} label="주제별 모음" />
                  <SideLink href="/library/by-designer" label="디자이너별 모음" />
                  <SideLink href="/library/all" label="전체 1,243편 목록" />
                  <SideLink href="/library/paths" label="학습 경로 13개" />
                  <SideLink href="/library/lineage" label="사상 계보 10개" />
                  <SideLink href="/library/genres" label="장르 가이드 10개" />
                  <SideLink href="/library/gdc" label={`GDC 강연 ${stats.byType.gdc_talk}편`} />
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: number | undefined; color: string }) {
  return (
    <div className="px-3 py-1.5 rounded-lg border bg-slate-950/60" style={{ borderColor: color + "33" }}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-base font-bold" style={{ color }}>{(value || 0).toLocaleString()}</div>
    </div>
  )
}

function FilterBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function FilterChip({
  label, count, active, color, onClick,
}: { label: string; count: number; active: boolean; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded border transition-colors " +
        (active
          ? "bg-slate-800/60 border-[#1e3a5f] text-slate-200"
          : "bg-transparent border-transparent text-slate-500 hover:text-slate-300")
      }
    >
      <span className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </span>
      <span className="text-slate-600 text-[10px]">{count}</span>
    </button>
  )
}

function SideLink({ href, label, icon }: { href: string; label: string; icon?: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#5B8DEF] hover:bg-slate-800/40 px-2 py-1 rounded transition-colors"
    >
      {icon}
      {label}
    </Link>
  )
}
