"use client"

import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type RadarChartProps = {
  data: {
    subject: string
    value: number
    fullMark: number
  }[]
}

export function RadarChartComponent({ data }: RadarChartProps) {
  return (
    <Card className="bg-slate-900/80 border-[#1e3a5f]">
      <CardHeader>
        <CardTitle className="text-white">역량 분석</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
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
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{item.subject}</span>
              <span className="font-medium text-white">{item.value}점</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
