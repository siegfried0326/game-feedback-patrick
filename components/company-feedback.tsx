/**
 * 회사별 분석 — 지원 회사를 골랐으면 그 회사를 맨 앞에 크게, 나머지는 "다른 회사 참고"로 접어 둔다
 * 회사 무관이면 회사별 특징을 나란히 보여준다. (분석 결과 화면 · 프로젝트 분석 상세 공용)
 */
"use client"

import { useState } from "react"
import { usePrinting } from "@/lib/use-printing"
import { ChevronDown, Target } from "lucide-react"
import { splitCompanyFeedback } from "@/lib/analysis/companies"
import { GlossaryText } from "@/components/glossary-text"

function Emphasized({ text }: { text: string }) {
  const parts = text.split(/\*\*(.*?)\*\*/)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <span key={i} className="text-primary font-semibold">{part}</span> : <span key={i}><GlossaryText text={part} /></span>
      )}
    </>
  )
}

export function CompanyFeedback({ feedback, targetCompany }: { feedback: string; targetCompany?: string | null }) {
  const [showOthers, setShowOthers] = useState(false)
  const printing = usePrinting()
  const paragraphs = splitCompanyFeedback(feedback)
  if (paragraphs.length === 0) return null

  const target = targetCompany ? paragraphs.find(p => p.company === targetCompany) : undefined
  const others = target ? paragraphs.filter(p => p !== target) : paragraphs

  return (
    <div>
      {target ? (
        <>
          <div className="rounded-xl border-2 border-primary/40 bg-accent/40 p-5">
            <p className="text-sm font-bold text-primary mb-2 flex items-center gap-1.5">
              <Target className="w-4 h-4" /> {targetCompany} 맞춤 분석
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              <Emphasized text={target.body} />
            </p>
          </div>

          {others.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowOthers(v => !v)}
                className="w-full flex items-center justify-between text-sm font-semibold text-foreground px-1 py-2"
              >
                <span>다른 회사 참고 <span className="text-muted-foreground font-medium">{others.length}곳</span></span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showOthers ? "rotate-180" : ""}`} />
              </button>
              {(showOthers || printing) && (
                <div className="space-y-2">
                  {others.map((p, i) => (
                    <div key={i} className="p-3 bg-secondary border border-border/50 rounded-xl">
                      <p className="text-sm text-foreground/80 leading-relaxed"><Emphasized text={p.body} /></p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-foreground font-semibold text-base mb-4">회사별 합격 포트폴리오 특징 비교</p>
          <div className="space-y-3">
            {others.map((p, i) => (
              <div key={i} className="p-4 bg-secondary border border-border/50 rounded-xl">
                <p className="text-sm text-foreground/80 leading-relaxed"><Emphasized text={p.body} /></p>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="text-xs text-muted-foreground mt-4 text-center">
        * 회사별 합격 포트폴리오의 경향을 참고한 분석입니다 · 데이터는 계속 업데이트됩니다
      </p>
    </div>
  )
}
