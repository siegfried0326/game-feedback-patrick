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
    if (score >= 60) return "#5B8DEF"
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
    if (score >= 90) return { label: "합격 가능", color: "text-purple-400", emoji: "🏆" }
    if (score >= 80) return { label: "경쟁력 있음", color: "text-emerald-400", emoji: "✅" }
    if (score >= 70) return { label: "보완 필요", color: "text-[#5B8DEF]", emoji: "📝" }
    if (score >= 60) return { label: "개선 필요", color: "text-amber-400", emoji: "⚠️" }
    return { label: "재작성 권장", color: "text-red-400", emoji: "🔄" }
  }

  const rankGrade = getRankGrade(score)

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="text-white">종합 점수 (AI Score)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#1e3a5f"
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
            <span className="text-4xl font-bold text-white">{score}</span>
            <span className="text-sm text-slate-400">/ 100</span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <span
            className="inline-block px-4 py-1.5 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: getScoreColor(score) }}
          >
            {getScoreLabel(score)}
          </span>
          {ranking && ranking.total > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-400" />
                <p className="text-sm text-slate-300">
                  합격 포트폴리오 <span className="text-white font-semibold">{ranking.total}개</span> 기준
                </p>
              </div>
              <p className={`text-lg font-bold ${rankGrade.color}`}>
                {rankGrade.emoji} {rankGrade.label}
              </p>
              <p className="text-xs text-slate-500">
                재작성 권장 &lt; 개선 필요 &lt; 보완 필요 &lt; 경쟁력 있음 &lt; 합격 가능
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
