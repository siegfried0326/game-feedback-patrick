/**
 * 레이더 차트 — 기본 5개 카테고리 (66줄)
 *
 * 논리력/구체성/가독성/기술이해/창의성 5개 기본 카테고리를
 * 오각형 레이더 차트로 시각화.
 * 사용: analyze-dashboard.tsx 결과 화면
 * 의존: recharts (RadarChart, PolarGrid)
 */
"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type CategoryData = {
  subject: string
  value: number
  fullMark: number
}

type RadarChartProps = {
  data: CategoryData[]
}

const BASIC_SUBJECTS = ["논리력", "구체성", "가독성", "기술이해", "창의성"]

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-400"
  if (value >= 60) return "text-[#5B8DEF]"
  if (value >= 40) return "text-amber-400"
  return "text-red-400"
}

export function RadarChartComponent({ data }: RadarChartProps) {
  const basicData = data.filter(d => BASIC_SUBJECTS.includes(d.subject))
  const chartData = basicData.length > 0 ? basicData : data.slice(0, 5)

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f] h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-white">기본 역량 분석</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="#1e3a5f" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                tickLine={false}
              />
              <Radar
                name="역량"
                dataKey="value"
                stroke="#5B8DEF"
                fill="#5B8DEF"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{item.subject}</span>
              <span className={`font-medium ${getScoreColor(item.value)}`}>{item.value}점</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
