"use client"

import { useState } from "react"
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
  const hasDesignCategories = data.length > 5
  const [activeTab, setActiveTab] = useState<"basic" | "design">("basic")

  const basicData = data.filter(d => BASIC_SUBJECTS.includes(d.subject))
  const designData = data.filter(d => !BASIC_SUBJECTS.includes(d.subject))

  const chartData = hasDesignCategories
    ? (activeTab === "basic" ? basicData : designData)
    : data

  const basicAvg = basicData.length > 0
    ? Math.round(basicData.reduce((a, b) => a + b.value, 0) / basicData.length)
    : 0
  const designAvg = designData.length > 0
    ? Math.round(designData.reduce((a, b) => a + b.value, 0) / designData.length)
    : 0

  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="text-white">역량 분석</CardTitle>
        {hasDesignCategories && (
          <div className="flex gap-1 mt-2 bg-slate-800/50 rounded-lg p-1">
            <button
              onClick={() => setActiveTab("basic")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "basic"
                  ? "bg-[#5B8DEF] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              기본 역량 ({basicAvg}점)
            </button>
            <button
              onClick={() => setActiveTab("design")}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === "design"
                  ? "bg-[#5B8DEF] text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              게임디자인 ({designAvg}점)
            </button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
              <PolarGrid stroke="#1e3a5f" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: "#94a3b8", fontSize: chartData.length > 7 ? 10 : 12 }}
                tickLine={false}
              />
              <Radar
                name="역량"
                dataKey="value"
                stroke={activeTab === "basic" ? "#5B8DEF" : "#a78bfa"}
                fill={activeTab === "basic" ? "#5B8DEF" : "#a78bfa"}
                fillOpacity={0.3}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className={`mt-4 grid gap-2 ${chartData.length > 5 ? "grid-cols-2" : "grid-cols-2"}`}>
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
