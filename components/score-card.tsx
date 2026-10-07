/**
 * 종합 점수 카드
 *
 * 종합 점수(100점 만점) + 합격 문서 기준 등급 하나 (lib/analysis/grade.ts).
 * 합격 문서끼리의 순위는 보여주지 않는다.
 * 사용: analyze-dashboard.tsx 결과 화면, 프로젝트 분석 상세
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { gradeOf } from "@/lib/analysis/grade"

type ScoreCardProps = {
  score: number
  /** 호환용 — 더 이상 표시하지 않는다 */
  ranking?: unknown
}

export function ScoreCard({ score }: ScoreCardProps) {
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference
  const grade = gradeOf(score)

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-foreground">종합 점수</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-8 flex-1">
        <div className="relative w-40 h-40">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#E3E8EF" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke={grade.ring}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-foreground">{score}</span>
            <span className="text-sm text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="mt-6 text-center">
          <span className="inline-block px-4 py-1.5 rounded-full text-sm font-bold text-white" style={{ backgroundColor: grade.ring }}>
            {grade.label}
          </span>
          <p className="mt-2 text-sm text-muted-foreground">{grade.desc}</p>
        </div>
      </CardContent>
    </Card>
  )
}
