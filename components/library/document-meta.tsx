/**
 * 라이브러리 문서 메타 사이드바
 *  - frontmatter 핵심 필드(designers, games_referenced, tags, sources, status, preview, created/updated, principleId)
 *  - 백링크 + 정방향 위키링크
 */

import Link from "next/link"
import {
  LibraryDocument,
  LibrarySummary,
  TYPE_LABELS,
  TYPE_COLORS,
  DOMAIN_COLORS,
} from "@/lib/library/types"
import { getDocumentUrl } from "@/lib/library/routes"

interface MetaProps {
  doc: LibraryDocument
  backlinks: LibrarySummary[]
  outlinks: LibrarySummary[]
}

export function DocumentMeta({ doc, backlinks, outlinks }: MetaProps) {
  const accent = doc.domain ? DOMAIN_COLORS[doc.domain] : TYPE_COLORS[doc.type]

  return (
    <aside className="space-y-5 text-sm">
      <div className="rounded-xl border border-[#1e3a5f] bg-slate-900/50 p-4">
        <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">메타</div>
        <dl className="space-y-2 text-slate-300">
          <Row label="타입" value={TYPE_LABELS[doc.type]} valueColor={accent} />
          {doc.domain && <Row label="도메인" value={doc.domain} valueColor={DOMAIN_COLORS[doc.domain]} />}
          {doc.principleId && <Row label="ID" value={<code className="text-xs">{doc.principleId}</code>} />}
          {doc.status && <Row label="상태" value={doc.status} />}
          {doc.sourceConfidence && <Row label="신뢰도" value={doc.sourceConfidence} />}
          {doc.created && <Row label="작성" value={doc.created} />}
          {doc.updated && doc.updated !== doc.created && <Row label="갱신" value={doc.updated} />}
          {doc.year && <Row label="연도" value={doc.year} />}
        </dl>
      </div>

      {doc.designers.length > 0 && (
        <ListBlock title="디자이너" items={doc.designers} />
      )}
      {doc.gamesReferenced.length > 0 && (
        <ListBlock title="언급된 게임" items={doc.gamesReferenced} />
      )}
      {doc.tags.length > 0 && (
        <ListBlock title="태그" items={doc.tags} pill />
      )}
      {doc.notableWorks.length > 0 && (
        <ListBlock title="대표작" items={doc.notableWorks} />
      )}

      {backlinks.length > 0 && (
        <LinkBlock title="이 문서를 참조하는 문서" docs={backlinks} />
      )}
      {outlinks.length > 0 && (
        <LinkBlock title="이 문서가 가리키는 문서" docs={outlinks} />
      )}
    </aside>
  )
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string
  value: React.ReactNode
  valueColor?: string
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-right text-slate-200" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </dd>
    </div>
  )
}

function ListBlock({
  title,
  items,
  pill,
}: {
  title: string
  items: string[]
  pill?: boolean
}) {
  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-slate-900/50 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      <div className={pill ? "flex flex-wrap gap-1.5" : "space-y-1"}>
        {items.map((it) => (
          pill ? (
            <span key={it} className="text-xs px-2 py-0.5 rounded-full bg-slate-800/60 text-slate-300">
              {it}
            </span>
          ) : (
            <div key={it} className="text-slate-300 text-sm leading-snug">{it}</div>
          )
        ))}
      </div>
    </div>
  )
}

function LinkBlock({ title, docs }: { title: string; docs: LibrarySummary[] }) {
  const shown = docs.slice(0, 12)
  return (
    <div className="rounded-xl border border-[#1e3a5f] bg-slate-900/50 p-4">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 flex justify-between">
        <span>{title}</span>
        <span className="text-slate-600">{docs.length}</span>
      </div>
      <ul className="space-y-1.5">
        {shown.map((d) => (
          <li key={d.id}>
            <Link
              href={getDocumentUrl(d.type, d.slug)}
              className="text-slate-300 hover:text-[#5B8DEF] text-sm transition-colors line-clamp-1"
            >
              <span className="text-[10px] text-slate-500 mr-1.5">[{TYPE_LABELS[d.type]}]</span>
              {d.title}
            </Link>
          </li>
        ))}
        {docs.length > shown.length && (
          <li className="text-[11px] text-slate-500">+{docs.length - shown.length}개 더</li>
        )}
      </ul>
    </div>
  )
}
