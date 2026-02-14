"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type ScoreCardProps = {
  score: number
}

export function ScoreCard({ score }: ScoreCardProps) {
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

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="text-white">종합 점수 (AI Score)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#1e3a5f"
              strokeWidth="8"
            />
            {/* Progress circle */}
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
          <p className="text-sm text-slate-400 mt-3">
            상위 {Math.max(5, 100 - score + Math.floor(Math.random() * 10))}% 수준의 문서입니다
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
