/**
 * 이전 버전 대비 — 같은 프로젝트·같은 문서의 직전 분석과 점수·항목별 변화를 보여준다
 * 결과 화면 맨 위(점수 카드 앞)에 놓는다. 직전 버전이 없으면 아무것도 그리지 않는다.
 */
"use client"

import { TrendingUp, TrendingDown, Minus } from "lucide-react"

type Cat = { subject: string; value: number | null }

export function VersionDelta({
  prevScore, prevCategories, score, categories, versionNumber,
}: { prevScore: number; prevCategories: Cat[]; score: number; categories: Cat[]; versionNumber?: number }) {
  const diff = score - prevScore
  const prev = new Map(prevCategories.filter(c => typeof c.value === "number").map(c => [c.subject, c.value as number]))
  const changes = categories
    .filter(c => typeof c.value === "number" && prev.has(c.subject))
    .map(c => ({ subject: c.subject, delta: (c.value as number) - (prev.get(c.subject) as number) }))
    .filter(c => c.delta !== 0)
  const ups = changes.filter(c => c.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 4)
  const downs = changes.filter(c => c.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3)

  const tone = diff > 0
    ? { box: "border-emerald-500/30 bg-emerald-500/5", text: "text-emerald-700", Icon: TrendingUp, msg: `이전 버전보다 ${diff}점 올랐어요` }
    : diff < 0
      ? { box: "border-red-500/30 bg-red-500/5", text: "text-red-600", Icon: TrendingDown, msg: `이전 버전보다 ${-diff}점 내려갔어요` }
      : { box: "border-border bg-secondary", text: "text-foreground", Icon: Minus, msg: "이전 버전과 종합 점수가 같아요" }

  return (
    <div className={`rounded-xl border p-5 ${tone.box}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`flex items-center gap-2 text-base font-bold ${tone.text}`}>
          <tone.Icon className="w-5 h-5" /> {tone.msg}
        </p>
        <p className="text-sm text-muted-foreground">
          {versionNumber ? `v${versionNumber - 1} ` : "이전 "}<span className="font-semibold text-foreground">{prevScore}점</span>
          {" → "}{versionNumber ? `v${versionNumber} ` : "지금 "}<span className="font-bold text-foreground">{score}점</span>
        </p>
      </div>
      {(ups.length > 0 || downs.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {ups.map(c => (
            <span key={c.subject} className="text-xs rounded-full bg-emerald-500/10 text-emerald-700 px-2.5 py-1">{c.subject} +{c.delta}</span>
          ))}
          {downs.map(c => (
            <span key={c.subject} className="text-xs rounded-full bg-red-500/10 text-red-600 px-2.5 py-1">{c.subject} {c.delta}</span>
          ))}
        </div>
      )}
    </div>
  )
}
