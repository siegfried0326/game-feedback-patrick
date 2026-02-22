"use client"

import { useState } from "react"
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

function LayoutPreview({ sections }: { sections: LayoutSection[] }) {
  return (
    <div className="relative bg-slate-950 border border-slate-700 rounded-lg overflow-hidden" style={{ aspectRatio: "210/297", width: "100%" }}>
      {sections.map((section, i) => (
        <div
          key={i}
          className="absolute flex items-center justify-center text-[10px] font-medium text-white/90 rounded-sm overflow-hidden"
          style={{
            left: `${section.x}%`,
            top: `${section.y}%`,
            width: `${section.w}%`,
            height: `${section.h}%`,
            backgroundColor: section.color + "33",
            border: `1.5px solid ${section.color}`,
          }}
        >
          <span className="truncate px-1">{section.label}</span>
        </div>
      ))}
    </div>
  )
}

export function LayoutRecommendations({ data }: LayoutRecommendationsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0)

  if (!data || data.length === 0) return null

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Layout className="w-5 h-5 text-orange-400" />
          레이아웃 개선 제안
        </CardTitle>
        <p className="text-xs text-slate-500">개선이 가장 필요한 페이지 {data.length}곳의 수정 전후 비교입니다</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item, index) => (
          <div key={index} className="border border-[#1e3a5f]/50 rounded-lg overflow-hidden">
            <button
              type="button"
              className="w-full text-left p-3 hover:bg-slate-800/50 transition-colors flex items-center justify-between"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
            >
              <span className="text-sm text-white font-medium">{item.pageOrSection}</span>
              <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedIndex === index ? 'rotate-180' : ''}`} />
            </button>
            {expandedIndex === index && (
              <div className="px-3 pb-4 space-y-4">
                {/* 텍스트 설명 */}
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                    <p className="text-xs text-red-400 font-semibold mb-1">현재 상태</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.currentDescription}</p>
                  </div>
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                    <p className="text-xs text-emerald-400 font-semibold mb-1">개선 제안</p>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.recommendedDescription}</p>
                  </div>
                </div>

                {/* 시각적 비교 */}
                {item.currentLayout?.sections && item.recommendedLayout?.sections && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-red-400 text-center mb-2">수정 전</p>
                      <LayoutPreview sections={item.currentLayout.sections} />
                    </div>
                    <ArrowRight className="w-6 h-6 text-slate-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs text-emerald-400 text-center mb-2">수정 후</p>
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
