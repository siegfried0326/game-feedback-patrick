/**
 * 전체 라이브러리 문서 클라이언트 필터 + 페이지네이션
 *   - 1,243편 전체 노출 (제한 없음, 80개씩 페이지)
 */
"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Search } from "lucide-react"
import {
  LibrarySummary,
  LibraryType,
  Domain,
  Topic,
  TYPE_LABELS,
  TYPE_COLORS,
  DOMAIN_COLORS,
  TOPIC_LABELS,
  TOPIC_COLORS,
  TOPIC_ORDER,
} from "@/lib/library/types"
import { DocumentGrid } from "./document-grid"

const TYPE_LIST: LibraryType[] = [
  "principle", "designer", "pattern", "antipattern",
  "learning_path", "lineage", "genre_guide", "core_rule",
  "source", "gdc_talk", "level_design_supplement",
]
const DOMAIN_LIST: Domain[] = ["전투", "시스템", "내러티브", "레벨", "프로덕션"]
const PAGE_SIZE = 80

export function AllDocsClient({ documents }: { documents: LibrarySummary[] }) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<LibraryType | "all">("all")
  const [domain, setDomain] = useState<Domain | "all">("all")
  const [topic, setTopic] = useState<Topic | "all">("all")
  const [page, setPage] = useState(0)
  const deferred = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase()
    return documents.filter((d) => {
      if (type !== "all" && d.type !== type) return false
      if (domain !== "all" && d.domain !== domain) return false
      if (topic !== "all" && !(d.topics || []).includes(topic)) return false
      if (!q) return true
      const hay = [
        d.title, d.titleEn, d.principleId,
        ...(d.tags || []), ...(d.designers || []), ...(d.gamesReferenced || []),
      ].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [documents, deferred, type, domain, topic])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageDocs = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function setAndResetPage<T>(setter: (v: T) => void, val: T) {
    setter(val)
    setPage(0)
  }

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="제목·태그·디자이너·게임 검색"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0) }}
          className="w-full bg-slate-900/80 border border-[#1e3a5f] rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-[#5B8DEF] focus:outline-none"
        />
      </div>

      <FilterRow
        title="주제"
        items={TOPIC_ORDER.map((t) => ({ value: t, label: TOPIC_LABELS[t], color: TOPIC_COLORS[t] }))}
        value={topic}
        onChange={(v) => setAndResetPage(setTopic, v as Topic | "all")}
        documents={documents}
        countKey={(d, v) => (d.topics || []).includes(v as Topic)}
      />

      <FilterRow
        title="타입"
        items={TYPE_LIST.map((t) => ({ value: t, label: TYPE_LABELS[t], color: TYPE_COLORS[t] }))}
        value={type}
        onChange={(v) => setAndResetPage(setType, v as LibraryType | "all")}
        documents={documents}
        countKey={(d, v) => d.type === v}
      />

      <FilterRow
        title="도메인"
        items={DOMAIN_LIST.map((d) => ({ value: d, label: d, color: DOMAIN_COLORS[d] }))}
        value={domain}
        onChange={(v) => setAndResetPage(setDomain, v as Domain | "all")}
        documents={documents}
        countKey={(d, v) => d.domain === v}
      />

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{filtered.length.toLocaleString()}건 / {documents.length.toLocaleString()}건</span>
        {totalPages > 1 && (
          <span>{page + 1} / {totalPages} 페이지</span>
        )}
      </div>

      <DocumentGrid documents={pageDocs} compact />

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#1e3a5f] text-slate-300 hover:text-white disabled:opacity-30"
          >
            ← 이전
          </button>
          <span className="text-xs text-slate-500 px-2">
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs px-3 py-1.5 rounded-lg border border-[#1e3a5f] text-slate-300 hover:text-white disabled:opacity-30"
          >
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}

function FilterRow<V extends string>({
  title, items, value, onChange, documents, countKey,
}: {
  title: string
  items: { value: V; label: string; color: string }[]
  value: V | "all"
  onChange: (v: V | "all") => void
  documents: LibrarySummary[]
  countKey: (d: LibrarySummary, v: V) => boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-1">{title}</span>
      <button
        onClick={() => onChange("all")}
        className={
          "text-xs px-3 py-1 rounded-full border " +
          (value === "all"
            ? "bg-slate-700 border-slate-600 text-white"
            : "bg-slate-900/60 border-[#1e3a5f] text-slate-500 hover:text-slate-300")
        }
      >
        전체
      </button>
      {items.map((it) => {
        const c = documents.filter((d) => countKey(d, it.value)).length
        if (c === 0) return null
        const active = value === it.value
        return (
          <button
            key={it.value}
            onClick={() => onChange(it.value)}
            className="text-xs px-3 py-1 rounded-full border"
            style={
              active
                ? { background: it.color, borderColor: it.color, color: "#fff" }
                : { background: "rgba(15,23,42,0.6)", borderColor: it.color + "55", color: it.color }
            }
          >
            {it.label} ({c})
          </button>
        )
      })}
    </div>
  )
}
