/**
 * 합격 문서 기준 위치 — 5단계 등급 막대 위에 내 점수를 표시한다 (순위 없음)
 */
import { GRADES, gradeOf } from "@/lib/analysis/grade"

export function GradeScale({ score }: { score: number }) {
  const current = gradeOf(score)
  return (
    <div>
      <div className="flex gap-1">
        {GRADES.map(g => {
          const active = g.key === current.key
          return (
            <div
              key={g.key}
              className={`flex-1 h-11 rounded flex flex-col items-center justify-center text-[11px] leading-tight ${g.bar} ${g.text} ${
                active ? "ring-2 ring-primary ring-offset-2 ring-offset-background font-bold" : ""
              }`}
            >
              <span className="hidden sm:inline">{g.label}</span>
              <span className="opacity-70">{g.range}</span>
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2 text-center">
        내 점수 <span className="font-semibold text-foreground">{score}점</span> · {current.desc}
      </p>
    </div>
  )
}
