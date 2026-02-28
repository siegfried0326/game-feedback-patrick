/**
 * 강점/약점 피드백 카드 (61줄)
 *
 * AI 분석 결과의 strengths/weaknesses 배열을
 * 초록(강점)/빨강(약점) 카드로 나란히 표시.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
import { ThumbsUp, AlertTriangle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type FeedbackCardsProps = {
  strengths: string[]
  weaknesses: string[]
}

export function FeedbackCards({ strengths, weaknesses }: FeedbackCardsProps) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Strengths */}
      <Card className="bg-slate-900/80 border-emerald-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-400">
            <ThumbsUp className="w-5 h-5" />
            강점 (Strengths)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {strengths.map((strength, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="text-slate-300 text-sm leading-relaxed">
                  {strength}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Weaknesses */}
      <Card className="bg-slate-900/80 border-amber-500/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-5 h-5" />
            보완점 (Weaknesses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {weaknesses.map((weakness, index) => (
              <li key={index} className="flex items-start gap-3">
                <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-sm font-medium shrink-0">
                  {index + 1}
                </span>
                <span className="text-slate-300 text-sm leading-relaxed">
                  {weakness}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
