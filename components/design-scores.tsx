/**
 * 항목별 점수와 이유 — 기본 역량 5개 + 게임 디자인 역량 10개
 *
 * 항목마다 점수 막대 아래에 '점수 이유' 한 줄을 늘 보여주고, 누르면 잘한 점·고칠 점이 펼쳐진다.
 * 2026-10-13: 기본 역량(창의성 등)은 레이더 차트에만 있고 이유가 안 보여서 함께 넣었다.
 * 2026-10: 직군별 채점표 도입 — 문서 직군에서 평가하지 않는 항목은
 * value가 null로 오고 "해당 없음"으로 표시된다. 평균도 적용 항목만으로 계산.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { useState, type ReactNode } from "react"
import { GlossaryText, Term } from "@/components/glossary-text"
import { usePrinting } from "@/lib/use-printing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2, ChevronDown, MinusCircle, Brain } from "lucide-react"

type CategoryData = {
  subject: string
  value: number | null
  fullMark: number
  feedback?: string
  applicable?: boolean
}

type DesignScoresProps = {
  data: CategoryData[]
  /** 직군 라벨 (예: "레벨 디자인") — 해당 없음 안내 문구에 사용 */
  domainLabel?: string
}

const BASIC_SUBJECTS = ["논리력", "구체성", "가독성", "기술이해", "창의성"]

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-600"
  if (value >= 60) return "text-primary"
  if (value >= 40) return "text-amber-600"
  return "text-red-600"
}

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 60) return "bg-primary"
  if (value >= 40) return "bg-amber-500"
  return "bg-red-500"
}

function isApplicable(item: CategoryData): item is CategoryData & { value: number } {
  return item.applicable !== false && typeof item.value === "number"
}

export function DesignScores({ data, domainLabel }: DesignScoresProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const printing = usePrinting()

  const basicData = data.filter(d => BASIC_SUBJECTS.includes(d.subject))
  const designData = data.filter(d => !BASIC_SUBJECTS.includes(d.subject))
  if (data.length === 0) return null

  const naItems = designData.filter(d => !isApplicable(d))

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-foreground">항목별 점수와 이유</CardTitle>
        <p className="text-xs text-muted-foreground">항목을 누르면 잘한 점과 고칠 점이 펼쳐져요</p>
      </CardHeader>
      <CardContent className="space-y-8">
        {basicData.length > 0 && (
          <ScoreGroup
            title="기본 역량"
            icon={<Brain className="w-4 h-4 text-primary" />}
            items={basicData}
            expanded={expanded}
            onToggle={k => setExpanded(expanded === k ? null : k)}
            printing={printing}
          />
        )}
        {designData.length > 0 && (
          <ScoreGroup
            title="게임 디자인 역량"
            icon={<Gamepad2 className="w-4 h-4 text-purple-600" />}
            items={designData}
            expanded={expanded}
            onToggle={k => setExpanded(expanded === k ? null : k)}
            printing={printing}
          />
        )}
        {/* 직군에서 평가하지 않는 항목 — 목록 사이에 끼우지 않고 아래에 한 줄로 */}
        {naItems.length > 0 && (
          <div className="pt-4 border-t border-border flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <MinusCircle className="w-3.5 h-3.5" />
              {domainLabel ? `${domainLabel} 문서라 평가하지 않은 항목` : "평가하지 않은 항목"}
            </span>
            {naItems.map(d => (
              <span key={d.subject} className="text-xs text-muted-foreground bg-secondary rounded-full px-2.5 py-0.5">{d.subject}</span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** feedback 문자열을 [점수 이유] / [강점] / [보완] 줄로 나눈다. 태그 없는 줄은 앞 줄에 붙인다 */
function splitFeedback(feedback: string) {
  const reason: string[] = []
  const lines: { kind: "good" | "fix" | "plain"; text: string }[] = []
  for (const raw of feedback.split("\n")) {
    const t = raw.trim()
    if (!t) continue
    const m = t.match(/^\[(점수 이유|강점|보완)\]\s*(.*)$/)
    if (m?.[1] === "점수 이유") reason.push(m[2])
    else if (m?.[1] === "강점") lines.push({ kind: "good", text: m[2] })
    else if (m?.[1] === "보완") lines.push({ kind: "fix", text: m[2] })
    else lines.push({ kind: "plain", text: t })
  }
  return { reason: reason.join(" "), lines }
}

function ScoreGroup({ title, icon, items, expanded, onToggle, printing }: {
  title: string
  icon: ReactNode
  items: CategoryData[]
  expanded: string | null
  onToggle: (key: string) => void
  printing: boolean
}) {
  const applicable = items.filter(isApplicable)
  if (applicable.length === 0) return null
  const avg = Math.round(applicable.reduce((a, b) => a + b.value, 0) / applicable.length)

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <p className="flex items-center gap-2 text-sm font-bold text-foreground">{icon}{title}</p>
        <span className={`text-sm font-semibold ${getScoreColor(avg)}`}>평균 {avg}점</span>
      </div>
      <div className="space-y-5">
        {applicable.map(item => {
          const open = expanded === item.subject || printing
          const { reason, lines } = splitFeedback(item.feedback ?? "")
          return (
            <div key={item.subject} className="break-inside-avoid">
              <button
                type="button"
                className="w-full text-left cursor-pointer hover:bg-secondary rounded-lg p-2 -m-2 transition-colors"
                onClick={() => onToggle(item.subject)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground/80 flex items-center gap-1">
                    <Term term={item.subject} />
                    {lines.length > 0 && (
                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform print:hidden ${open ? "rotate-180" : ""}`} />
                    )}
                  </span>
                  <span className={`text-sm font-semibold ${getScoreColor(item.value)}`}>{item.value}점</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(item.value)}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
                {reason && (
                  <p className="mt-1.5 text-[13px] text-foreground/75 leading-relaxed">
                    <span className="font-semibold text-foreground">이 점수인 이유 </span>
                    <GlossaryText text={reason} />
                  </p>
                )}
              </button>
              {open && lines.length > 0 && (
                <div className="mt-2 ml-2 p-3 bg-secondary border border-border/50 rounded-lg space-y-2">
                  {lines.map((l, i) => (
                    <p key={i} className={`text-sm leading-relaxed ${l.kind === "good" ? "text-emerald-700" : l.kind === "fix" ? "text-amber-700" : "text-foreground/80"}`}>
                      {l.kind !== "plain" && <span className="font-semibold">{l.kind === "good" ? "잘한 점 " : "고칠 점 "}</span>}
                      <GlossaryText text={l.text} />
                    </p>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
