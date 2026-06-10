/**
 * /library/search — 라이브러리 통합 검색
 */

import type { Metadata } from "next"
import { getAllSummaries } from "@/lib/library/loader"
import { SearchClient } from "@/components/library/search-client"

export const metadata: Metadata = {
  title: "검색 | 라이브러리 | Archive187",
}

export default async function SearchPage() {
  const all = await getAllSummaries()
  // 클라이언트에 요약만 전달 (본문 X)
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-2xl font-bold text-white">검색</h1>
        <p className="text-sm text-slate-400">
          제목·태그·디자이너·게임명·원칙 ID로 라이브러리 전체 문서 {all.length}편을 탐색.
        </p>
      </header>
      <SearchClient documents={all} />
    </div>
  )
}
