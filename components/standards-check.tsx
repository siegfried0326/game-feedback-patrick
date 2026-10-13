/**
 * 합격작 공통 요소 대조표 + 다음에 할 일
 *
 * 같은 직군 합격 문서의 기준 카드에서 뽑은 공통 요소(평면도, 루트도, 구간별 의도 등)를
 * 사용자 문서가 갖췄는지 보여준다. 저장값 있음/부분/없음 → 화면 표기 갖춤/보강 필요/빠짐 (2026-10-13). (lib/analysis/reference.ts → standardsCheck)
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { GlossaryText } from "@/components/glossary-text"
import { ClipboardCheck, ListOrdered } from "lucide-react"

type StandardsCheckItem = {
  element: string
  status: "있음" | "부분" | "없음"
  note: string
}

type StandardsCheckProps = {
  items: StandardsCheckItem[]
  nextSteps?: string[]
  domainLabel?: string
}

// 저장값(있음/부분/없음)은 그대로 두고 화면에는 뜻이 분명한 말로 보여준다
const STATUS_LABEL: Record<StandardsCheckItem["status"], { label: string; desc: string; style: string }> = {
  있음: { label: "갖춤", desc: "합격 문서 수준으로 들어 있어요", style: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" },
  부분: { label: "보강 필요", desc: "있지만 합격 문서보다 부족해요 — 빠진 것을 채우면 '갖춤'", style: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  없음: { label: "빠짐", desc: "문서에 없어요 — 새로 넣어야 해요", style: "bg-red-500/15 text-red-600 border-red-500/30" },
}

/** "있는 것: … / 빠진 것: …" 형식이면 두 줄로 나눠 보여준다 */
function Note({ text }: { text: string }) {
  const m = text.match(/있는\s*것\s*[:：]\s*(.+?)\s*\/\s*빠진\s*것\s*[:：]\s*(.+)/)
  if (!m) return <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed"><GlossaryText text={text} /></p>
  return (
    <div className="mt-1 space-y-0.5 text-xs leading-relaxed">
      <p className="text-muted-foreground"><span className="font-semibold text-emerald-700">있는 것</span> <GlossaryText text={m[1]} /></p>
      <p className="text-muted-foreground"><span className="font-semibold text-amber-700">빠진 것</span> <GlossaryText text={m[2]} /></p>
    </div>
  )
}

export function StandardsCheck({ items, nextSteps, domainLabel }: StandardsCheckProps) {
  if (items.length === 0 && (!nextSteps || nextSteps.length === 0)) return null

  const have = items.filter(i => i.status === "있음").length

  return (
    <Card className="bg-card border-border">
      {items.length > 0 && (
        <>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-foreground">
              <span className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                {domainLabel ? `${domainLabel} 합격 문서 공통 요소` : "합격 문서 공통 요소"}
              </span>
              <span className="text-sm text-muted-foreground">{have} / {items.length} 갖춤</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {/* 판정 뜻 안내 */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-[11px] text-muted-foreground">
              {(["있음", "부분", "없음"] as const).map(k => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-px rounded-full border ${STATUS_LABEL[k].style}`}>{STATUS_LABEL[k].label}</span>
                  {STATUS_LABEL[k].desc}
                </span>
              ))}
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary">
                <span className={`shrink-0 whitespace-nowrap text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_LABEL[item.status].style}`}>
                  {STATUS_LABEL[item.status].label}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground"><GlossaryText text={item.element} /></p>
                  {item.note && <Note text={item.note} />}
                </div>
              </div>
            ))}
          </CardContent>
        </>
      )}

      {nextSteps && nextSteps.length > 0 && (
        <CardContent className={items.length > 0 ? "pt-0" : "pt-6"}>
          <div className="border-t border-border pt-4">
            <p className="flex items-center gap-2 text-foreground font-semibold mb-3">
              <ListOrdered className="w-4 h-4 text-amber-600" />
              다음에 할 일
            </p>
            <ol className="space-y-2">
              {nextSteps.map((step, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-foreground/80 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-amber-500/20 text-amber-600 text-xs flex items-center justify-center">{i + 1}</span>
                  <span><GlossaryText text={step} /></span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
