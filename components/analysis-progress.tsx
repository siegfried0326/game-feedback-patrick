/**
 * 분석 중 화면 — 지금 어느 단계인지 + 회사별 합격 문서와 비교하는 모습을 하나씩 흘려 보여준다
 * 실제 모델 호출은 한 번이라 단계는 경과 시간 기준의 안내다.
 */
"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { COMPANY_TRAITS, TARGET_COMPANIES } from "@/lib/analysis/companies"

const STEPS = ["문서 읽기", "직군 채점표 적용", "같은 직군 합격 문서와 비교", "회사별 합격 경향 비교", "점수·피드백 정리"]

export function AnalysisProgress({ progress, targetCompany }: { progress: number; targetCompany?: string | null }) {
  const companies = targetCompany && (TARGET_COMPANIES as readonly string[]).includes(targetCompany)
    ? [targetCompany, ...TARGET_COMPANIES.filter(c => c !== targetCompany)]
    : [...TARGET_COMPANIES]
  const [shown, setShown] = useState(1)
  useEffect(() => {
    const t = setInterval(() => setShown(n => Math.min(n + 1, companies.length)), 2800)
    return () => clearInterval(t)
  }, [companies.length])

  const stepIndex = Math.min(STEPS.length - 1, Math.floor((progress / 100) * STEPS.length))

  return (
    <div className="mt-6 grid gap-4 md:grid-cols-[220px_1fr]">
      <ol className="space-y-2">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-2 text-sm ${i < stepIndex ? "text-muted-foreground" : i === stepIndex ? "text-primary font-semibold" : "text-muted-foreground/60"}`}>
            {i < stepIndex ? <Check className="w-4 h-4" /> : i === stepIndex ? <Loader2 className="w-4 h-4 animate-spin" /> : <span className="w-4 h-4 rounded-full border border-border" />}
            {s}
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-border bg-card p-4 max-h-72 overflow-hidden">
        <p className="text-xs font-semibold text-muted-foreground mb-3">회사별 합격 문서 경향과 비교하는 중</p>
        <ul className="space-y-2.5">
          {companies.slice(0, shown).map((c, i) => (
            <li key={c} className="flex gap-2 text-sm animate-in fade-in slide-in-from-bottom-1 duration-500">
              <span className={`shrink-0 font-bold ${c === targetCompany ? "text-primary" : "text-foreground"}`}>{c}</span>
              <span className="text-muted-foreground">{COMPANY_TRAITS[c as keyof typeof COMPANY_TRAITS]}</span>
              {i === shown - 1 && shown < companies.length && <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-primary mt-0.5" />}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
