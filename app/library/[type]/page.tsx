/**
 * /library/[type]
 *   - principles, designers, patterns, antipatterns, paths, lineage, genres, core,
 *     gdc, sources, level-design
 *   - 타입별 전체 목록 + 검색·도메인 필터
 */

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { getAllSummaries, getLibraryStats } from "@/lib/library/loader"
import { TYPE_LABELS, LibraryType } from "@/lib/library/types"
import { routeToType, ALL_TYPE_ROUTES } from "@/lib/library/routes"
import { TypeFilter } from "@/components/library/type-filter"

interface Props {
  params: Promise<{ type: string }>
}

export async function generateStaticParams() {
  return ALL_TYPE_ROUTES.map((type) => ({ type }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type: route } = await params
  const type = routeToType(route)
  if (!type) return { title: "Not found" }
  return {
    title: `${TYPE_LABELS[type]} | 라이브러리 | Archive187`,
  }
}

export default async function TypeIndexPage({ params }: Props) {
  const { type: route } = await params
  const type = routeToType(route)
  if (!type) notFound()

  const all = await getAllSummaries()
  const docs = all.filter((d) => d.type === type)
  const stats = await getLibraryStats()

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="text-xs text-slate-500">라이브러리</div>
        <h1 className="text-3xl font-bold text-white">{TYPE_LABELS[type as LibraryType]}</h1>
        <p className="text-sm text-slate-400">
          총 {docs.length}편 · 전체 라이브러리 {stats.totalDocuments}편 중
        </p>
      </header>

      <TypeFilter documents={docs} />
    </div>
  )
}
