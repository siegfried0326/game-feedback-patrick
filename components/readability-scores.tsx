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
  if (value >= 80) return "text-emerald-400"
  if (value >= 60) return "text-cyan-400"
  if (value >= 40) return "text-amber-400"
  return "text-red-400"
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
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-cyan-400" />
            문서 가독성
          </span>
          <span className={`text-lg ${getScoreColor(avg)}`}>평균 {avg}점</span>
        </CardTitle>
        <p className="text-xs text-slate-500">PDF 문서의 시각적 구성을 분석한 결과입니다</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index}>
              <button
                type="button"
                className="w-full text-left cursor-pointer hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-slate-300 flex items-center gap-1">
                    {item.subject}
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`} />
                  </span>
                  <span className={`text-sm font-semibold ${getScoreColor(item.value)}`}>{item.value}점</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getBarColor(item.value)}`}
                    style={{ width: `${item.value}%` }}
                  />
                </div>
              </button>
              {expandedIndex === index && item.feedback && (
                <div className="mt-2 ml-2 p-3 bg-slate-800/60 border border-[#1e3a5f]/50 rounded-lg">
                  <p className="text-sm text-slate-300 leading-relaxed">{item.feedback}</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">각 항목을 눌러 세부 피드백을 확인하세요</p>
      </CardContent>
    </Card>
  )
}
