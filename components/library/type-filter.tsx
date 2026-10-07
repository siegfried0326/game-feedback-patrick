/**
 * 라이브러리 타입/도메인 필터 — 클라이언트 컴포넌트
 *  - 인덱스 페이지에서 사용
 */
"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  LibrarySummary,
  TYPE_LABELS,
  Domain,
  DOMAIN_COLORS,
} from "@/lib/library/types"
import { DocumentGrid } from "./document-grid"

interface TypeFilterProps {
  documents: LibrarySummary[]
}

const DOMAIN_LIST: Domain[] = ["전투", "시스템", "내러티브", "레벨", "프로덕션"]

export function TypeFilter({ documents }: TypeFilterProps) {
  const [query, setQuery] = useState("")
  const [domain, setDomain] = useState<Domain | "all">("all")
  const [previewOnly, setPreviewOnly] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      if (domain !== "all" && d.domain !== domain) return false
      if (previewOnly && !d.preview) return false
      if (!q) return true
      const hay = [
        d.title,
        d.titleEn,
        ...(d.tags || []),
        ...(d.designers || []),
        ...(d.gamesReferenced || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [documents, query, domain, previewOnly])

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
        <label className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-2 rounded-lg bg-card border border-border cursor-pointer">
          <input
            type="checkbox"
            checked={previewOnly}
            onChange={(e) => setPreviewOnly(e.target.checked)}
            className="accent-[#0046AD]"
          />
          공개 전용
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setDomain("all")}
          className={
            "text-xs px-3 py-1 rounded-full border transition-colors " +
            (domain === "all"
              ? "bg-primary border-primary text-white"
              : "bg-card border-border text-muted-foreground hover:text-foreground")
          }
        >
          전체 ({documents.length})
        </button>
        {DOMAIN_LIST.map((d) => {
          const count = documents.filter((doc) => doc.domain === d).length
          if (count === 0) return null
          const active = domain === d
          return (
            <button
              key={d}
              onClick={() => setDomain(d)}
              className="text-xs px-3 py-1 rounded-full border transition-colors"
              style={
                active
                  ? { background: DOMAIN_COLORS[d], borderColor: DOMAIN_COLORS[d], color: "#fff" }
                  : {
                      background: "#FFFFFF",
                      borderColor: DOMAIN_COLORS[d] + "55",
                      color: DOMAIN_COLORS[d],
                    }
              }
            >
              {d} ({count})
            </button>
          )
        })}
      </div>

      <div className="text-xs text-muted-foreground">{filtered.length}개 문서</div>

      <DocumentGrid documents={filtered.slice(0, 60)} />
      {filtered.length > 60 && (
        <p className="text-center text-xs text-muted-foreground mt-4">
          처음 60개 표시. 더 좁히려면 검색어를 입력하세요.
        </p>
      )}
    </div>
  )
}
