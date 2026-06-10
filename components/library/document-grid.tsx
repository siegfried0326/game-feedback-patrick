/**
 * 라이브러리 문서 그리드 — 카드들을 반응형으로 배치
 */

import { LibrarySummary } from "@/lib/library/types"
import { DocumentCard } from "./document-card"

interface DocumentGridProps {
  documents: LibrarySummary[]
  showType?: boolean
  compact?: boolean
  emptyMessage?: string
}

export function DocumentGrid({
  documents,
  showType = true,
  compact = false,
  emptyMessage = "문서가 없습니다.",
}: DocumentGridProps) {
  if (documents.length === 0) {
    return (
      <div className="text-center text-slate-500 py-12 border border-dashed border-[#1e3a5f] rounded-2xl">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div
      className={
        compact
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
          : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      }
    >
      {documents.map((doc) => (
        <DocumentCard key={doc.id} doc={doc} showType={showType} compact={compact} />
      ))}
    </div>
  )
}
