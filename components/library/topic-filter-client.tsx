/**
 * 토픽 페이지 클라이언트 필터 — 타입·검색 보강
 */
"use client"

import { useMemo, useState } from "react"
import {
  LibrarySummary,
  LibraryType,
  TYPE_LABELS,
  TYPE_COLORS,
} from "@/lib/library/types"
import { DocumentGrid } from "./document-grid"

const TYPE_OPTIONS: LibraryType[] = [
  "principle", "designer", "pattern", "antipattern",
  "learning_path", "lineage", "genre_guide", "core_rule",
]

export function TopicFilterClient({ documents }: { documents: LibrarySummary[] }) {
  const [query, setQuery] = useState("")
  const [type, setType] = useState<LibraryType | "all">("all")

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      if (type !== "all" && d.type !== type) return false
      if (!q) return true
      const hay = [
        d.title, d.titleEn, ...(d.tags || []), ...(d.designers || []), ...(d.gamesReferenced || []),
      ].filter(Boolean).join(" ").toLowerCase()
      return hay.includes(q)
    })
  }, [documents, query, type])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="제목·태그·디자이너·게임 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] bg-slate-900/80 border border-[#1e3a5f] rounded-lg px-4 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:border-[#5B8DEF] focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setType("all")}
          className={
            "text-xs px-3 py-1 rounded-full border " +
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
              className="text-xs px-3 py-1 rounded-full border"
              style={
                active
                  ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: "#fff" }
                  : { background: "rgba(15,23,42,0.6)", borderColor: TYPE_COLORS[t] + "55", color: TYPE_COLORS[t] }
              }
            >
              {TYPE_LABELS[t]} ({c})
            </button>
          )
        })}
      </div>

      <div className="text-xs text-slate-500">{filtered.length}건</div>

      <DocumentGrid documents={filtered.slice(0, 80)} />
      {filtered.length > 80 && (
        <p className="text-center text-xs text-slate-500">처음 80개 표시.</p>
      )}
    </div>
  )
}
