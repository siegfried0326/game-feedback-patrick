/**
 * /library/all — 모든 라이브러리 문서 통합 목록 (1,243편)
 *   - 검색 + 타입 + 도메인 + 토픽 필터
 *   - 페이지네이션 (검색 결과 80개 단위)
 */

import type { Metadata } from "next"
import { getAllSummaries, getLibraryStats } from "@/lib/library/loader"
import { AllDocsClient } from "@/components/library/all-docs-client"

export const metadata: Metadata = {
  title: "전체 문서 | 라이브러리 | Archive187",
}

export default async function AllDocsPage() {
  const [summaries, stats] = await Promise.all([
    getAllSummaries(),
    getLibraryStats(),
  ])
  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-3xl font-bold text-white">전체 문서</h1>
        <p className="text-sm text-slate-400">{stats.totalDocuments.toLocaleString()}편 · 검색·필터로 좁히기</p>
      </header>
      <AllDocsClient documents={summaries} />
    </div>
  )
}
