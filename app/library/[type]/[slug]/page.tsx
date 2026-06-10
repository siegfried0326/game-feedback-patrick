/**
 * /library/[type]/[slug] — 라이브러리 문서 상세
 *   - 본문 마크다운(위키링크 변환) + 메타 사이드바 + 백링크
 */

import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"
import {
  getBacklinks,
  getDocument,
  getOutlinks,
} from "@/lib/library/loader"
import { expandWikilinks } from "@/lib/library/markdown"
import { routeToType } from "@/lib/library/routes"
import { MarkdownRenderer } from "@/components/library/markdown-renderer"
import { DocumentMeta } from "@/components/library/document-meta"
import { TYPE_LABELS, DOMAIN_COLORS, TYPE_COLORS } from "@/lib/library/types"

interface Props {
  params: Promise<{ type: string; slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type: route, slug } = await params
  const type = routeToType(route)
  if (!type) return { title: "Not found" }
  const doc = await getDocument(type, decodeURIComponent(slug))
  if (!doc) return { title: "Not found" }
  return {
    title: `${doc.title} | 라이브러리 | Archive187`,
    description: doc.body.slice(0, 160).replace(/\n+/g, " "),
  }
}

export default async function DocumentDetailPage({ params }: Props) {
  const { type: route, slug } = await params
  const type = routeToType(route)
  if (!type) notFound()
  const decoded = decodeURIComponent(slug)
  const doc = await getDocument(type, decoded)
  if (!doc) notFound()

  const [body, backlinks, outlinks] = await Promise.all([
    expandWikilinks(doc.body),
    getBacklinks(doc.id),
    getOutlinks(doc.id),
  ])

  const accent = doc.domain ? DOMAIN_COLORS[doc.domain] : TYPE_COLORS[doc.type]

  return (
    <div className="space-y-6">
      <Link
        href={`/library/${route}`}
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-[#5B8DEF] transition-colors"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        {TYPE_LABELS[type]} 목록
      </Link>

      <header className="space-y-3 pb-6 border-b border-[#1e3a5f]">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border"
            style={{
              borderColor: accent + "55",
              color: accent,
              background: accent + "11",
            }}
          >
            {TYPE_LABELS[doc.type]}
          </span>
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
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              공개
            </span>
          )}
          {doc.status && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
              {doc.status}
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white text-balance">{doc.title}</h1>
        {doc.titleEn && (
          <p className="text-sm text-slate-500 font-mono">{doc.titleEn}</p>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-8">
        <article className="min-w-0">
          <MarkdownRenderer source={body} />
        </article>
        <DocumentMeta doc={doc} backlinks={backlinks} outlinks={outlinks} />
      </div>
    </div>
  )
}
