/**
 * 게임디자인 10개 카테고리 점수
 *
 * 10개 전문 항목의 점수(100점 만점) + 개별 피드백을 아코디언 형태로 표시.
 * 2026-10: 직군별 채점표 도입 — 문서 직군에서 평가하지 않는 항목은
 * value가 null로 오고 "해당 없음"으로 표시된다. 평균도 적용 항목만으로 계산.
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2, ChevronDown, MinusCircle } from "lucide-react"

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

function isApplicable(item: CategoryData): item is CategoryData & { value: number } {
  return item.applicable !== false && typeof item.value === "number"
}

export function DesignScores({ data, domainLabel }: DesignScoresProps) {
  const designData = data.filter(d => !BASIC_SUBJECTS.includes(d.subject))
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  if (designData.length === 0) return null

  const applicable = designData.filter(isApplicable)
  const naCount = designData.length - applicable.length
  const avg = applicable.length > 0
    ? Math.round(applicable.reduce((a, b) => a + b.value, 0) / applicable.length)
    : 0

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
        {naCount > 0 && (
          <p className="text-xs text-slate-500 mt-1">
            {domainLabel ? `${domainLabel} 문서 기준으로 ` : ""}{naCount}개 항목은 평가 대상이 아니라 점수에서 제외했어요.
          </p>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {designData.map((item, index) => {
            if (!isApplicable(item)) {
              return (
                <div key={index} className="flex items-center justify-between p-2 -m-2 mb-0 rounded-lg opacity-60">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5">
                    <MinusCircle className="w-3.5 h-3.5" />
                    {item.subject}
                  </span>
                  <span className="text-xs text-slate-500 border border-slate-700 rounded-full px-2 py-0.5">해당 없음</span>
                </div>
              )
            }
            return (
              <div key={index}>
                <button
                  type="button"
                  className="w-full text-left cursor-pointer hover:bg-slate-800/50 rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-slate-300 flex items-center gap-1">
                      {item.subject}
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${expandedIndex === index ? "rotate-180" : ""}`} />
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
                    {item.feedback.split("\n").map((line, i) => {
                      const trimmed = line.trim()
                      if (!trimmed) return null
                      if (trimmed.startsWith("[강점]")) {
                        return <p key={i} className="text-sm leading-relaxed text-emerald-400">{trimmed}</p>
                      }
                      if (trimmed.startsWith("[보완]")) {
                        return <p key={i} className="text-sm leading-relaxed text-amber-400">{trimmed}</p>
                      }
                      return <p key={i} className="text-sm text-slate-300 leading-relaxed">{trimmed}</p>
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-xs text-slate-500 mt-4 text-center">각 항목을 눌러 세부 피드백을 확인하세요</p>
      </CardContent>
    </Card>
  )
}
