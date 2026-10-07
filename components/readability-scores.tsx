/**
 * 가독성 10개 항목 점수 (86줄)
 *
 * 텍스트 크기/여백/색상 대비/정보 계층 등 10개 가독성 항목의
 * 점수(10점 만점) + 개별 피드백을 아코디언 형태로 표시.
 * PDF/이미지 업로드 시에만 평가됨 (텍스트 추출 모드에서는 비활성).
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Eye, ChevronDown } from "lucide-react"

type CategoryData = {
  subject: string
  value: number
  fullMark: number
  feedback?: string
}

type ReadabilityScoresProps = {
  data: CategoryData[]
}

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-600"
  if (value >= 60) return "text-cyan-600"
  if (value >= 40) return "text-amber-600"
  return "text-red-600"
}

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 60) return "bg-cyan-500"
  if (value >= 40) return "bg-amber-500"
  return "bg-red-500"
}

export function ReadabilityScores({ data }: ReadabilityScoresProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (!data || data.length === 0) return null

  const avg = Math.round(data.reduce((a, b) => a + b.value, 0) / data.length)

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-600" />
            문서 가독성
          </span>
          <span className={`text-lg ${getScoreColor(avg)}`}>평균 {avg}점</span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">PDF 문서의 시각적 구성을 분석한 결과입니다</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index}>
              <button
                type="button"
                className="w-full text-left cursor-pointer hover:bg-secondary rounded-lg p-2 -m-2 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground/80 flex items-center gap-1">
                    {item.subject}
                    <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`} />
                  </span>
                  <span className={`text-sm font-semibold ${getScoreColor(item.value)}`}>{item.value}점</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(item.value)}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </button>
              {expandedIndex === index && item.feedback && (
                <div className="mt-2 ml-2 p-3 bg-secondary border border-border/50 rounded-lg">
                  <p className="text-sm text-foreground/80 leading-relaxed">{item.feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center">각 항목을 눌러 세부 피드백을 확인하세요</p>
      </CardContent>
    </Card>
  )
}
