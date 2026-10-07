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
  /** 직군 기준 '해당 없음' 항목은 null (기본 5개 역량은 항상 숫자) */
  value: number | null
  fullMark: number
}

type RadarChartProps = {
  data: CategoryData[]
}

const BASIC_SUBJECTS = ["논리력", "구체성", "가독성", "기술이해", "창의성"]

function getScoreColor(value: number): string {
  if (value >= 80) return "text-emerald-600"
  if (value >= 60) return "text-primary"
  if (value >= 40) return "text-amber-600"
  return "text-red-600"
}

export function RadarChartComponent({ data }: RadarChartProps) {
  const numeric = data
    .filter((d): d is CategoryData & { value: number } => typeof d.value === "number")
  const basicData = numeric.filter(d => BASIC_SUBJECTS.includes(d.subject))
  const chartData = basicData.length > 0 ? basicData : numeric.slice(0, 5)

  return (
    <Card className="bg-card border-border h-full flex flex-col">
      <CardHeader>
        <CardTitle className="text-foreground">기본 역량 분석</CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="#E3E8EF" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#5B6472", fontSize: 12 }}
                tickLine={false}
              />
              <Radar
                name="역량"
                dataKey="value"
                stroke="#0046AD"
                fill="#0046AD"
                fillOpacity={0.3}
                strokeWidth={2}
                // 애니메이션 중 컨테이너 크기가 바뀌면 다각형이 옛 중심에 남는 문제가 있어 끈다
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {chartData.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{item.subject}</span>
              <span className={`font-medium ${getScoreColor(item.value)}`}>{item.value}점</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
