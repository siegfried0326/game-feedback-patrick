/**
 * 분석 설정 창의 단계 상자 — ① 문서 분야 → ② 문서 형식 → ③ 지원 회사 → ④ 분석 깊이
 *
 * 지금 골라야 할 단계만 코발트 테두리로 띄우고, 아직 차례가 안 된 단계는 흐리게·누를 수 없게 둔다.
 * 끝난 단계는 체크 표시와 함께 그대로 보이고 언제든 다시 바꿀 수 있다.
 * 사용: components/analyze-dashboard.tsx 분석 설정 창
 */
"use client"

import type { ReactNode } from "react"
import { Check } from "lucide-react"

export type StepState = "done" | "current" | "todo"

export function StepBox({ n, title, state, aside, children }: {
  n: number
  title: string
  state: StepState
  /** 제목 오른쪽 작은 안내 (예: 자동으로 골랐어요) */
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-current={state === "current" ? "step" : undefined}
      aria-disabled={state === "todo" || undefined}
      className={`rounded-xl p-3.5 transition-all ${
        state === "current"
          ? "border-2 border-primary bg-accent/30 shadow-[0_8px_24px_-16px_rgba(0,70,173,0.6)]"
          : state === "done"
            ? "border border-border"
            : "border border-border opacity-35 pointer-events-none select-none"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        <span
          className={`flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-bold shrink-0 ${
            state === "todo" ? "bg-secondary text-muted-foreground border border-border" : "bg-primary text-white"
          }`}
        >
          {state === "done" ? <Check className="w-3 h-3" strokeWidth={3} /> : n}
        </span>
        <p className={`text-sm font-bold ${state === "todo" ? "text-muted-foreground" : "text-foreground"}`}>{title}</p>
        {aside && <span className="ml-auto">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/** 창 위쪽의 1-2-3-4 진행 표시 */
export function StepTrail({ labels, current, done }: { labels: string[]; current: number; done: boolean[] }) {
  return (
    <ol className="flex items-center justify-center gap-1.5 mb-4">
      {labels.map((label, i) => (
        <li key={label} className="flex items-center gap-1.5">
          <span
            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              i === current
                ? "bg-primary text-white"
                : done[i]
                  ? "bg-accent text-primary"
                  : "bg-secondary text-muted-foreground"
            }`}
          >
            {done[i] && i !== current ? <Check className="w-3 h-3" strokeWidth={3} /> : <span>{i + 1}</span>}
            {label}
          </span>
          {i < labels.length - 1 && <span className="w-2 h-px bg-border" aria-hidden />}
        </li>
      ))}
    </ol>
  )
}
