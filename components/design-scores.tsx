import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Gamepad2 } from "lucide-react"

type CategoryData = {
  subject: string
  value: number
  fullMark: number
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
        <div className="space-y-3">
          {designData.map((item, index) => (
            <div key={index}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-slate-300">{item.subject}</span>
                <span className={`text-sm font-semibold ${getScoreColor(item.value)}`}>{item.value}점</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getBarColor(item.value)}`}
                  style={{ width: `${item.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
