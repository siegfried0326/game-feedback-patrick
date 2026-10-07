/**
 * 레이아웃 개선 제안 (122줄)
 *
 * AI가 분석한 문서 레이아웃 개선점을 섹션별로 표시.
 * 각 섹션: 현재 상태(before) → 개선안(after) 형태.
 * PDF/이미지 업로드 시에만 평가됨 (텍스트 추출 모드에서는 비활성).
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { useState } from "react"
import { usePrinting } from "@/lib/use-printing"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Layout, ChevronDown, ArrowRight } from "lucide-react"

type LayoutSection = {
  label: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

type LayoutRecommendation = {
  pageOrSection: string
  currentDescription: string
  recommendedDescription: string
  currentLayout: { sections: LayoutSection[] }
  recommendedLayout: { sections: LayoutSection[] }
}

type LayoutRecommendationsProps = {
  data: LayoutRecommendation[]
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function LayoutPreview({ sections }: { sections: LayoutSection[] }) {
  return (
    <div className="relative bg-background border border-border rounded-lg overflow-hidden" style={{ aspectRatio: "210/297", width: "100%" }}>
      {sections.map((section, i) => {
        // 좌표 보정: 영역 밖으로 나가지 않게
        const x = clamp(section.x, 0, 95)
        const y = clamp(section.y, 0, 95)
        const w = clamp(section.w, 5, 100 - x)
        const h = clamp(section.h, 3, 100 - y)
        return (
          <div
            key={i}
            className="absolute flex items-center justify-center text-[10px] font-medium text-foreground/90 rounded-sm overflow-hidden"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${w}%`,
              height: `${h}%`,
              backgroundColor: section.color + "33",
              border: `1.5px solid ${section.color}`,
            }}
          >
            <span className="truncate px-1">{section.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function LayoutRecommendations({ data }: LayoutRecommendationsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)
  const printing = usePrinting()

  if (!data || data.length === 0) return null

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Layout className="w-5 h-5 text-orange-600" />
          레이아웃 개선 제안
        </CardTitle>
        <p className="text-xs text-muted-foreground">개선이 가장 필요한 페이지 {data.length}곳의 수정 전후 비교입니다</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full text-left p-3 hover:bg-secondary transition-colors flex items-center justify-between"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <span className="text-sm text-foreground font-medium">{item.pageOrSection}</span>
              <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`} />
            </button>
            {(expandedIndex === index || printing) && (
              <div className="px-3 pb-4 space-y-4">
                {/* 텍스트 설명 */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-600 font-semibold mb-1">현재 상태</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.currentDescription}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-600 font-semibold mb-1">개선 제안</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{item.recommendedDescription}</p>
                  </div>
                </div>

                {/* 시각적 비교 */}
                {item.currentLayout?.sections && item.recommendedLayout?.sections && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-red-600 text-center mb-2">수정 전</p>
                      <LayoutPreview sections={item.currentLayout.sections} />
                    </div>
                    <ArrowRight className="w-6 h-6 text-muted-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-600 text-center mb-2">수정 후</p>
                      <LayoutPreview sections={item.recommendedLayout.sections} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
