/**
 * /library/by-designer — 디자이너별 그룹 인덱스
 *   - 100명 디자이너를 작품 수 내림차순으로 표시
 *   - 각 디자이너 카드 → 해당 디자이너 문서 모음
 */

import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { getAllSummaries, getLibraryStats } from "@/lib/library/loader"

export const metadata: Metadata = {
  title: "디자이너별 분류 | 라이브러리 | Archive187",
}

export default async function ByDesignerPage() {
  const [summaries, stats] = await Promise.all([
    getAllSummaries(),
    getLibraryStats(),
  ])

  // 디자이너별 카운트 + 도메인 분포
  const designerSummary = new Map<string, { count: number; types: Record<string, number> }>()
  for (const doc of summaries) {
    for (const d of doc.designers || []) {
      if (!d) continue
      if (!designerSummary.has(d)) designerSummary.set(d, { count: 0, types: {} })
      const meta = designerSummary.get(d)!
      meta.count += 1
      meta.types[doc.type] = (meta.types[doc.type] || 0) + 1
    }
  }

  const sorted = Array.from(designerSummary.entries()).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-3xl font-bold text-white">디자이너별 분류</h1>
        <p className="text-sm text-slate-400">
          {sorted.length}명 디자이너 · 작품 수 내림차순. 한 원칙·패턴이 여러 디자이너에게 연결될 수 있음.
        </p>
        <p className="text-xs text-slate-500">
          전체 디자이너 인물 문서 {stats.byType.designer || 0}편 별도. {" "}
          <Link href="/library/designers" className="text-[#5B8DEF] hover:underline">인물 문서 목록 →</Link>
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {sorted.map(([name, meta]) => (
          <Link
            key={name}
            href={`/library/designers/${encodeURIComponent(name)}`}
            className="group flex items-start justify-between gap-2 rounded-xl border border-[#1e3a5f] bg-slate-900/60 hover:bg-slate-900/80 hover:border-[#5B8DEF]/40 p-4 transition-all"
          >
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-white truncate">{name}</h3>
              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap gap-1.5">
                {Object.entries(meta.types).map(([t, c]) => (
                  <span key={t} className="px-1.5 py-0.5 rounded bg-slate-800/60">
                    {t} {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl font-bold text-[#5B8DEF]">{meta.count}</div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#5B8DEF] ml-auto mt-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
