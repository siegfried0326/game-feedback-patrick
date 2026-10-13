/**
 * 강점/보완점 피드백 카드
 *
 * AI 분석 결과의 strengths/weaknesses 배열을 강점 → 보완점 순서로 표시.
 * 2026-10-13: 보완점은 "[문제] … [위치] … [고치는 법] … [수정 예시] …" 형식으로 오고,
 * 칸을 나눠 보여준다. 태그가 없는 예전 결과는 한 문단 그대로.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
import { ThumbsUp, AlertTriangle, FileText } from "lucide-react"
import { GlossaryText } from "@/components/glossary-text"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FeedbackCardsProps = {
  strengths: string[]
  weaknesses: string[]
}

export function FeedbackCards({ strengths, weaknesses }: FeedbackCardsProps) {
  return (
    <div className="space-y-6">
      {/* Strengths */}
      <Card className="bg-card border-emerald-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-600">
            <ThumbsUp className="w-5 h-5" />
            강점 (Strengths)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="text-foreground/80 text-sm leading-relaxed">
                  <GlossaryText text={strength} />
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Weaknesses */}
      <Card className="bg-card border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            보완점 (Weaknesses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-5">
            {weaknesses.map((weakness, index) => (
              <li key={index} className="flex items-start gap-3 break-inside-avoid">
                <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </span>
                <Weakness text={weakness} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}

const WEAKNESS_TAG = /\[(문제|위치|고치는 법|수정 예시)\]/

/** 보완점 한 개 — 태그별로 나눠 문제 / 위치 / 고치는 법 / 수정 예시 칸으로 보여준다 */
function Weakness({ text }: { text: string }) {
  if (!WEAKNESS_TAG.test(text)) {
    return <span className="text-foreground/80 text-sm leading-relaxed"><GlossaryText text={text} /></span>
  }
  const parts: Record<string, string> = {}
  const tokens = text.split(/\[(문제|위치|고치는 법|수정 예시)\]/)
  for (let i = 1; i < tokens.length; i += 2) parts[tokens[i]] = (tokens[i + 1] ?? "").trim()
  const lead = tokens[0].trim()
  const problem = parts["문제"] || lead

  return (
    <div className="min-w-0 flex-1 space-y-2 text-sm leading-relaxed">
      <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
        <p className="font-semibold text-foreground"><GlossaryText text={problem} /></p>
        {parts["위치"] && (
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2 py-0.5 text-xs font-semibold text-foreground/80">
            <FileText className="w-3 h-3" /> {parts["위치"]}
          </span>
        )}
      </div>
      {parts["고치는 법"] && (
        <p className="text-foreground/80">
          <span className="font-semibold text-amber-700">고치는 법 </span>
          <GlossaryText text={parts["고치는 법"]} />
        </p>
      )}
      {parts["수정 예시"] && (
        <div className="rounded-lg border-l-4 border-primary/60 bg-accent/40 px-3 py-2">
          <p className="text-[11px] font-bold tracking-wide text-primary mb-0.5">수정 예시</p>
          <p className="text-foreground/85 whitespace-pre-line"><GlossaryText text={parts["수정 예시"]} /></p>
        </div>
      )}
    </div>
  )
}
