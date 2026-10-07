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
          className="flex-1 min-w-[200px] bg-card border border-border rounded-lg px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setType("all")}
          className={
            "text-xs px-3 py-1 rounded-full border " +
            (type === "all"
              ? "bg-primary border-primary text-white"
              : "bg-card border-border text-muted-foreground hover:text-foreground")
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
                  : { background: "#FFFFFF", borderColor: TYPE_COLORS[t] + "55", color: TYPE_COLORS[t] }
              }
            >
              {TYPE_LABELS[t]} ({c})
            </button>
          )
        })}
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length}건</div>

      <DocumentGrid documents={filtered.slice(0, 80)} />
      {filtered.length > 80 && (
        <p className="text-center text-xs text-muted-foreground">처음 80개 표시.</p>
      )}
    </div>
  )
}
