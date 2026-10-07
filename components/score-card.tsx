/**
 * 종합 점수 카드 (113줄)
 *
 * 분석 결과의 종합 점수(100점 만점)를 큰 숫자로 표시.
 * 학습 데이터 기반 랭킹 정보: 상위 N%, 총 N명 중 순위.
 * 점수 구간별 색상: 80+ 초록, 60+ 노랑, 그 외 빨강.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Trophy } from "lucide-react"

type ScoreCardProps = {
  score: number
  ranking?: {
    total: number
    percentile: number
    rank?: number
    companyComparison?: {
      company: string
      avgScore: number
      userScore: number
      sampleCount?: number
    }[]
  }
}

export function ScoreCard({ score, ranking }: ScoreCardProps) {
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#22c55e"
    if (score >= 60) return "#0046AD"
    if (score >= 40) return "#f59e0b"
    return "#ef4444"
  }

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "탁월함"
    if (score >= 80) return "우수"
    if (score >= 70) return "양호"
    if (score >= 60) return "보통"
    if (score >= 50) return "개선 필요"
    return "보완 필요"
  }

  // 점수 기반 5단계 등급 (부등호 표시)
  const getRankGrade = (score: number): { label: string; color: string; emoji: string } => {
    if (score >= 90) return { label: "합격 가능", color: "text-purple-600", emoji: "🏆" }
    if (score >= 80) return { label: "경쟁력 있음", color: "text-emerald-600", emoji: "✅" }
    if (score >= 70) return { label: "보완 필요", color: "text-primary", emoji: "📝" }
    if (score >= 60) return { label: "개선 필요", color: "text-amber-600", emoji: "⚠️" }
    return { label: "재작성 권장", color: "text-red-600", emoji: "🔄" }
  }

  const rankGrade = getRankGrade(score)

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-foreground">종합 점수 (AI Score)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8 flex-1">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#E3E8EF"
              strokeWidth="8"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={getScoreColor(score)}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-foreground">{score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-medium text-foreground"
            style={{ backgroundColor: getScoreColor(score) }}
          >
            {getScoreLabel(score)}
          </span>
          {ranking && ranking.total > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-600" />
                <p className="text-sm text-foreground/80">
                  합격 포트폴리오 <span className="text-foreground font-semibold">{ranking.total}개</span> 기준
                </p>
              </div>
              <p className={`text-lg font-bold ${rankGrade.color}`}>
                {rankGrade.emoji} {rankGrade.label}
              </p>
              <p className="text-xs text-muted-foreground">
                재작성 권장 &lt; 개선 필요 &lt; 보완 필요 &lt; 경쟁력 있음 &lt; 합격 가능
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
