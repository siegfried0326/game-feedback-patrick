/**
 * 합격작 공통 요소 대조표 + 다음에 할 일
 *
 * 같은 직군 합격 문서의 기준 카드에서 뽑은 공통 요소(평면도, 루트도, 구간별 의도 등)를
 * 사용자 문서가 갖췄는지 있음/부분/없음으로 보여준다. (lib/analysis/reference.ts → standardsCheck)
 * 사용: analyze-dashboard.tsx 결과 화면
 */
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

const STATUS_STYLE: Record<StandardsCheckItem["status"], string> = {
  있음: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  부분: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  없음: "bg-red-500/15 text-red-600 border-red-500/30",
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
            {items.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary">
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_STYLE[item.status]}`}>
                  {item.status}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{item.element}</p>
                  {item.note && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.note}</p>}
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
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
