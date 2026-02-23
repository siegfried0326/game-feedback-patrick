"use client"

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface AnalysisItem {
  id: string
  file_name: string
  overall_score: number
  categories: Array<{
    name: string
    score: number
  }>
  analyzed_at: string
}

interface VersionComparisonProps {
  analyses: AnalysisItem[]
}

const CATEGORY_COLORS: Record<string, string> = {
  "논리력": "#5B8DEF",
  "구체성": "#10B981",
  "가독성": "#F59E0B",
  "기술이해": "#8B5CF6",
  "창의성": "#EF4444",
}

export function VersionComparison({ analyses }: VersionComparisonProps) {
  if (analyses.length < 2) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-400 text-sm">분석 결과가 2개 이상이어야 버전 비교가 가능합니다.</p>
        <p className="text-slate-500 text-xs mt-1">문서를 수정하고 다시 분석해 보세요.</p>
      </div>
    )
  }

  // 시간순 정렬 (오래된 것부터)
  const sorted = [...analyses].sort(
    (a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime()
  )

  // 차트 데이터 변환
  const chartData = sorted.map((item, idx) => {
    const date = new Date(item.analyzed_at)
    const label = `v${idx + 1}`
    const entry: Record<string, string | number> = {
      name: label,
      fullName: item.file_name.replace(/\.[^/.]+$/, ""),
      date: `${date.getMonth() + 1}/${date.getDate()}`,
      종합: item.overall_score,
    }
    if (item.categories && Array.isArray(item.categories)) {
      item.categories.forEach((cat) => {
        entry[cat.name] = cat.score
      })
    }
    return entry
  })

  // 모든 버전에서 카테고리 이름 통합 추출 (순서 유지)
  const categoryNameSet = new Set<string>()
  sorted.forEach((item) => {
    item.categories?.forEach((c) => categoryNameSet.add(c.name))
  })
  const categoryNames = Array.from(categoryNameSet)

  // 최신 vs 이전 비교
  const latest = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  const scoreDiff = latest.overall_score - previous.overall_score

  return (
    <div className="space-y-6">
      {/* 점수 변화 요약 */}
      <div className="flex items-center justify-between bg-slate-800/50 rounded-xl p-4">
        <div>
          <p className="text-xs text-slate-400">최신 버전 점수 변화</p>
          <p className="text-white font-bold text-lg">
            {previous.overall_score}점 → {latest.overall_score}점
          </p>
        </div>
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-bold ${
          scoreDiff > 0 ? "bg-emerald-500/10 text-emerald-400" :
          scoreDiff < 0 ? "bg-red-500/10 text-red-400" :
          "bg-slate-700 text-slate-400"
        }`}>
          {scoreDiff > 0 ? <TrendingUp className="w-4 h-4" /> :
           scoreDiff < 0 ? <TrendingDown className="w-4 h-4" /> :
           <Minus className="w-4 h-4" />}
          {scoreDiff > 0 ? "+" : ""}{scoreDiff}점
        </div>
      </div>

      {/* 종합 점수 라인 차트 */}
      <div>
        <p className="text-sm text-slate-400 mb-3">종합 점수 변화</p>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f1d32",
                  border: "1px solid #1e3a5f",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                labelFormatter={(label, payload) => {
                  const item = payload?.[0]?.payload
                  return item ? `${label} (${item.fullName}) - ${item.date}` : label
                }}
              />
              <Line
                type="monotone"
                dataKey="종합"
                stroke="#5B8DEF"
                strokeWidth={2}
                dot={{ fill: "#5B8DEF", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 카테고리별 점수 변화 */}
      {categoryNames.length > 0 && (
        <div>
          <p className="text-sm text-slate-400 mb-3">영역별 점수 변화</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0f1d32",
                    border: "1px solid #1e3a5f",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                {categoryNames.map((name) => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={CATEGORY_COLORS[name] || "#5B8DEF"}
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 버전별 점수 테이블 */}
      <div>
        <p className="text-sm text-slate-400 mb-3">버전별 상세</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 py-2 pr-4">영역</th>
                {sorted.map((item, idx) => (
                  <th key={item.id} className="text-center text-slate-400 py-2 px-2">
                    v{idx + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-800">
                <td className="text-white font-medium py-2 pr-4">종합</td>
                {sorted.map((item, idx) => {
                  const prev = idx > 0 ? sorted[idx - 1].overall_score : null
                  const diff = prev !== null ? item.overall_score - prev : null
                  return (
                    <td key={item.id} className="text-center py-2 px-2">
                      <span className="text-white">{item.overall_score}</span>
                      {diff !== null && diff !== 0 && (
                        <span className={`text-xs ml-1 ${diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {diff > 0 ? "+" : ""}{diff}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
              {categoryNames.map((catName) => (
                <tr key={catName} className="border-b border-slate-800/50">
                  <td className="text-slate-300 py-2 pr-4">{catName}</td>
                  {sorted.map((item, idx) => {
                    const cat = item.categories?.find((c) => c.name === catName)
                    const score = cat?.score
                    const prevCat = idx > 0 ? sorted[idx - 1].categories?.find((c) => c.name === catName) : null
                    const prevScore = prevCat?.score
                    const diff = score != null && prevScore != null ? score - prevScore : null
                    return (
                      <td key={item.id} className="text-center py-2 px-2">
                        {score != null ? (
                          <>
                            <span className="text-slate-300">{score}</span>
                            {diff !== null && diff !== 0 && (
                              <span className={`text-xs ml-1 ${diff > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {diff > 0 ? "+" : ""}{diff}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
