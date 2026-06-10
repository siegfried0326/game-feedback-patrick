/**
 * 라이브러리 검색 클라이언트 컴포넌트
 *  - 키워드 + 타입 + 도메인 + preview 필터
 *  - useDeferredValue로 입력 부드럽게
 */
"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { Search } from "lucide-react"
import {
  LibrarySummary,
  LibraryType,
  TYPE_LABELS,
  Domain,
  DOMAIN_COLORS,
  TYPE_COLORS,
} from "@/lib/library/types"
import { DocumentGrid } from "./document-grid"

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

export function SearchClient({ documents }: { documents: LibrarySummary[] }) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<LibraryType | "all">("all")
  const [domain, setDomain] = useState<Domain | "all">("all")
  const [previewOnly, setPreviewOnly] = useState(false)
  const deferredQuery = useDeferredValue(query)

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    return documents.filter((d) => {
      if (type !== "all" && d.type !== type) return false
      if (domain !== "all" && d.domain !== domain) return false
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
  }, [documents, deferredQuery, type, domain, previewOnly])

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          autoFocus
          type="text"
          placeholder="검색어 입력…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-slate-900/80 border border-[#1e3a5f] rounded-xl pl-11 pr-4 py-3 text-slate-200 placeholder:text-slate-500 focus:border-[#5B8DEF] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setType("all")}
          className={
            "text-xs px-3 py-1 rounded-full border transition-colors " +
            (type === "all"
              ? "bg-[#5B8DEF] border-[#5B8DEF] text-white"
              : "bg-slate-900/60 border-[#1e3a5f] text-slate-400 hover:text-white")
          }
        >
          전체 ({documents.length})
        </button>
        {TYPE_OPTIONS.map((t) => {
          const c = documents.filter((d) => d.type === t).length
          if (c === 0) return null
          const active = type === t
          return (
            <button
              key={t}
              onClick={() => setType(t)}
              className="text-xs px-3 py-1 rounded-full border transition-colors"
              style={
                active
                  ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: "#fff" }
                  : {
                      background: "rgba(15,23,42,0.6)",
                      borderColor: TYPE_COLORS[t] + "55",
                      color: TYPE_COLORS[t],
                    }
              }
            >
              {TYPE_LABELS[t]} ({c})
            </button>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-slate-500 mr-2">도메인</span>
        <button
          onClick={() => setDomain("all")}
          className={
            "text-xs px-3 py-1 rounded-full border " +
            (domain === "all"
              ? "bg-slate-700 border-slate-600 text-white"
              : "bg-slate-900/60 border-[#1e3a5f] text-slate-500 hover:text-slate-300")
          }
        >
          전체
        </button>
        {DOMAIN_OPTIONS.map((d) => {
          const c = documents.filter((doc) => doc.domain === d).length
          if (c === 0) return null
          const active = domain === d
          return (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className="text-xs px-3 py-1 rounded-full border"
              style={
                active
                  ? { background: DOMAIN_COLORS[d], borderColor: DOMAIN_COLORS[d], color: "#fff" }
                  : {
                      background: "rgba(15,23,42,0.6)",
                      borderColor: DOMAIN_COLORS[d] + "55",
                      color: DOMAIN_COLORS[d],
                    }
              }
            >
              {d} ({c})
            </button>
          )
        })}
        <label className="ml-auto flex items-center gap-2 text-xs text-slate-400 px-3 py-1 rounded-full bg-slate-900/60 border border-[#1e3a5f] cursor-pointer">
          <input
            type="checkbox"
            checked={previewOnly}
            onChange={(e) => setPreviewOnly(e.target.checked)}
            className="accent-[#5B8DEF]"
          />
          공개 전용
        </label>
      </div>

      <div className="text-xs text-slate-500">
        {filtered.length}건 / {documents.length}건
      </div>

      <DocumentGrid documents={filtered.slice(0, 80)} compact />
      {filtered.length > 80 && (
        <p className="text-center text-xs text-slate-500">처음 80개 표시.</p>
      )}
    </div>
  )
}
