/**
 * 헤더 크레딧 칩 — "내 크레딧 얼마 남았지?" / "결제 어떻게 하지?"에 한 번에 답한다
 *
 * 로그인 사용자에게 항상 "크레딧 N · 충전"을 보여주고, 누르면 크레딧 결제 페이지로 간다.
 * 분석 화면이 크레딧을 쓰면 `credits:update` 이벤트로 숫자를 바로 갱신한다 (notifyCreditsChanged).
 */
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Coins } from "lucide-react"

export const CREDITS_EVENT = "credits:update"

/** 크레딧 수가 바뀌었을 때 헤더 칩에 알린다 */
export function notifyCreditsChanged(remaining: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: remaining }))
}

export function CreditChip({ credits, unlimited }: { credits: number | null; unlimited?: boolean }) {
  const [value, setValue] = useState(credits)

  useEffect(() => setValue(credits), [credits])
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const n = (e as CustomEvent<number>).detail
      if (typeof n === "number") setValue(n)
    }
    window.addEventListener(CREDITS_EVENT, onUpdate)
    return () => window.removeEventListener(CREDITS_EVENT, onUpdate)
  }, [])

  if (unlimited) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        <Coins className="w-3.5 h-3.5 text-primary" /> 크레딧 무제한
      </span>
    )
  }
  if (value === null) return null

  const empty = value <= 0
  return (
    <Link
      href="/payment/credits"
      title="크레딧 충전하기"
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
        empty ? "border-primary bg-primary text-white hover:bg-primary/90" : "border-border hover:border-primary/50"
      }`}
    >
      <Coins className={`w-3.5 h-3.5 ${empty ? "text-white" : "text-primary"}`} />
      <span className={empty ? "font-semibold" : "text-foreground"}>
        <span className="hidden sm:inline">크레딧 </span><span className="font-bold">{value}</span>
      </span>
      <span className={`font-semibold ${empty ? "" : "text-primary"}`}>충전</span>
    </Link>
  )
}
