/**
 * 라이브러리 문서 카드 — 목록/그리드 공용
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  LibrarySummary,
  TYPE_LABELS,
  DOMAIN_COLORS,
  TYPE_COLORS,
} from "@/lib/library/types"
import { getDocumentUrl } from "@/lib/library/routes"

interface DocumentCardProps {
  doc: LibrarySummary
  showType?: boolean
  compact?: boolean
}

export function DocumentCard({ doc, showType = true, compact = false }: DocumentCardProps) {
  const accent = doc.domain ? DOMAIN_COLORS[doc.domain] : TYPE_COLORS[doc.type] || "#0046AD"
  const url = getDocumentUrl(doc.type, doc.slug)

  return (
    <Link
      href={url}
      className="group block rounded-2xl border border-border bg-card hover:bg-card hover:border-primary/40 transition-all p-5"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {showType && (
            <span
              className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
              style={{
                borderColor: accent + "55",
                color: accent,
                background: accent + "11",
              }}
            >
              {TYPE_LABELS[doc.type] || doc.type}
            </span>
          )}
          {doc.domain && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full border"
              style={{
                borderColor: DOMAIN_COLORS[doc.domain] + "55",
                color: DOMAIN_COLORS[doc.domain],
                background: DOMAIN_COLORS[doc.domain] + "11",
              }}
            >
              {doc.domain}
            </span>
          )}
          {doc.preview && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600">
              공개
            </span>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
      </div>

      <h3 className="text-base font-semibold text-foreground leading-snug mb-1.5 line-clamp-2">
        {doc.title}
      </h3>

      {!compact && doc.titleEn && (
        <p className="text-xs text-muted-foreground font-mono mb-2 line-clamp-1">{doc.titleEn}</p>
      )}

      {!compact && doc.designers.length > 0 && (
        <p className="text-xs text-muted-foreground line-clamp-1">
          {doc.designers.slice(0, 3).join(" · ")}
          {doc.designers.length > 3 ? ` +${doc.designers.length - 3}` : ""}
        </p>
      )}

      {!compact && doc.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {doc.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[10px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
