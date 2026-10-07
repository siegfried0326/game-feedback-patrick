/**
 * 용어 툴팁 — 글 속 어려운 단어(lib/glossary.ts)에 점선 밑줄을 긋고, 마우스를 올리거나 누르면 설명을 띄운다
 * 같은 글 안에서는 단어마다 처음 한 번만 표시해 밑줄이 너무 많아지지 않게 한다.
 */
"use client"

import { Fragment, type ReactNode } from "react"
import { GLOSSARY, GLOSSARY_RX } from "@/lib/glossary"

export function Term({ term, children }: { term: string; children?: ReactNode }) {
  const desc = GLOSSARY[term]
  if (!desc) return <>{children ?? term}</>
  return (
    <span
      tabIndex={0}
      className="group/term relative cursor-help underline decoration-dotted decoration-primary/60 underline-offset-[3px] outline-none print:no-underline"
    >
      {children ?? term}
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 bottom-full z-50 mb-2 w-64 -translate-x-1/2 rounded-lg bg-brand-ink px-3 py-2 text-left text-xs font-normal leading-relaxed text-white no-underline opacity-0 shadow-lg transition-opacity group-hover/term:visible group-hover/term:opacity-100 group-focus/term:visible group-focus/term:opacity-100 print:hidden"
      >
        <span className="block font-bold mb-0.5">{term}</span>
        {desc}
      </span>
    </span>
  )
}

export function GlossaryText({ text }: { text: string }) {
  if (!text) return null
  const seen = new Set<string>()
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(GLOSSARY_RX)) {
    const term = m[0]
    const i = m.index ?? 0
    if (seen.has(term)) continue
    seen.add(term)
    if (i > last) out.push(text.slice(last, i))
    out.push(<Term key={`${term}-${i}`} term={term} />)
    last = i + term.length
  }
  if (last < text.length) out.push(text.slice(last))
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>
}
