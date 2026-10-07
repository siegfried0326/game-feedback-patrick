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
  if (value >= 80) return "text-emerald-600"
  if (value >= 60) return "text-primary"
  if (value >= 40) return "text-amber-600"
  return "text-red-600"
}

function getBarColor(value: number): string {
  if (value >= 80) return "bg-emerald-500"
  if (value >= 60) return "bg-primary"
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
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground">
          <span className="flex items-center gap-2">
            <Gamepad2 className="w-5 h-5 text-purple-600" />
            게임 디자인 역량
          </span>
          <span className={`text-lg ${getScoreColor(avg)}`}>평균 {avg}점</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {designData.map((item, index) => {
            if (!isApplicable(item)) return null
            return (
              <div key={index}>
                <button
                  type="button"
                  className="w-full text-left cursor-pointer hover:bg-secondary rounded-lg p-2 -m-2 transition-colors"
                  onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-foreground/80 flex items-center gap-1">
                      {item.subject}
                      <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedIndex === index ? "rotate-180" : ""}`} />
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
                  <div className="mt-2 ml-2 p-3 bg-secondary border border-border/50 rounded-lg space-y-2">
                    {item.feedback.split("\n").map((line, i) => {
                      const trimmed = line.trim()
                      if (!trimmed) return null
                      if (trimmed.startsWith("[강점]")) {
                        return <p key={i} className="text-sm leading-relaxed text-emerald-600">{trimmed}</p>
                      }
                      if (trimmed.startsWith("[보완]")) {
                        return <p key={i} className="text-sm leading-relaxed text-amber-600">{trimmed}</p>
                      }
                      return <p key={i} className="text-sm text-foreground/80 leading-relaxed">{trimmed}</p>
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        {/* 직군에서 평가하지 않는 항목 — 목록 사이에 끼우지 않고 아래에 한 줄로 */}
        {naCount > 0 && (
          <div className="mt-6 pt-4 border-t border-border flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1 flex items-center gap-1">
              <MinusCircle className="w-3.5 h-3.5" />
              {domainLabel ? `${domainLabel} 문서라 평가하지 않은 항목` : "평가하지 않은 항목"}
            </span>
            {designData.filter(d => !isApplicable(d)).map(d => (
              <span key={d.subject} className="text-xs text-muted-foreground bg-secondary rounded-full px-2.5 py-0.5">{d.subject}</span>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-4 text-center">각 항목을 눌러 세부 피드백을 확인하세요</p>
      </CardContent>
    </Card>
  )
}
