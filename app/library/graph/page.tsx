/**
 * /library/graph — Obsidian 풍 그래프 뷰
 */

import type { Metadata } from "next"
import { GraphView } from "@/components/library/graph-view"

export const metadata: Metadata = {
  title: "그래프 뷰 | 라이브러리 | Archive187",
  description: "원칙·디자이너·패턴 사이의 모든 위키링크 망을 한눈에",
}

export default function GraphPage() {
  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-2xl font-bold text-white">그래프 뷰</h1>
        <p className="text-sm text-slate-400">
          모든 문서가 위키링크로 연결된 망. 좌측에서 표시할 타입/도메인을 선택하세요.
        </p>
      </header>
      <GraphView />
    </div>
  )
}
