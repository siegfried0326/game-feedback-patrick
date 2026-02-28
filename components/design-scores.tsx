/**
 * 게임디자인 10개 카테고리 점수 (110줄)
 *
 * 게임 메카닉/시스템/밸런스/UI-UX/레벨디자인 등 10개 전문 항목의
 * 점수(10점 만점) + 개별 피드백을 아코디언 형태로 표시.
 * 접기/펼치기 토글로 상세 피드백 확인 가능.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2, ChevronDown } from "lucide-react"

type CategoryData = {
  subject: string
  value: number
  fullMark: number
  feedback?: string
}

type DesignScoresProps = {
  data: CategoryData[]
}

const BASIC_SUBJECTS = ["논리력", "구체성", "가독성", "기술이해", "창의성"]

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-400"
  if (value >= 60) return "text-[#5B8DEF]"
  if (value >= 40) return "text-amber-400"
  return "text-red-400"
}

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 60) return "bg-[#5B8DEF]"
  if (value >= 40) return "bg-amber-500"
  return "bg-red-500"
}

export function DesignScores({ data }: DesignScoresProps) {
  const designData = data.filter(d => !BASIC_SUBJECTS.includes(d.subject))
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (designData.length === 0) return null

  const avg = Math.round(designData.reduce((a, b) => a + b.value, 0) / designData.length)

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-white">
          <span className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-400" />
            게임 디자인 역량
          </span>
          <span className={`text-lg ${getScoreColor(avg)}`}>평균 {avg}점</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {designData.map((item, index) => (
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
                <div className="mt-2 ml-2 p-3 bg-slate-800/60 border border-[#1e3a5f]/50 rounded-lg space-y-2">
                  {item.feedback.split('\n').map((line, i) => {
                    const trimmed = line.trim()
                    if (!trimmed) return null
                    if (trimmed.startsWith('[강점]')) {
                      return (
                        <p key={i} className="text-sm leading-relaxed text-emerald-400">
                          {trimmed}
                        </p>
                      )
                    }
                    if (trimmed.startsWith('[보완]')) {
                      return (
                        <p key={i} className="text-sm leading-relaxed text-amber-400">
                          {trimmed}
                        </p>
                      )
                    }
                    return (
                      <p key={i} className="text-sm text-slate-300 leading-relaxed">
                        {trimmed}
                      </p>
                    )
                  })}
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
