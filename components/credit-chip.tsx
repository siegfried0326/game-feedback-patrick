/**
 * 헤더 크레딧 칩 — 사이트 전체에서 크레딧은 여기 한 곳에만 보여준다
 *
 * - "크레딧 N · 충전" — 누르면 크레딧 결제 페이지
 * - 화면에 뜰 때 최신 값을 다시 읽는다 (서버 렌더 값이 오래될 수 있음)
 * - 분석 시작: notifyCreditsPending(n) → 칩 옆에 "−n 차감 예정"이 깜빡인다
 * - 분석 끝: notifyCreditsChanged(남은 값) → 숫자가 줄면서 "−n"이 떠오르는 애니메이션
 */
"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Coins } from "lucide-react"
import { getMyCredits } from "@/app/actions/subscription"

export const CREDITS_EVENT = "credits:update"
export const CREDITS_PENDING_EVENT = "credits:pending"

/** 크레딧 수가 바뀌었을 때 헤더 칩에 알린다 */
export function notifyCreditsChanged(remaining: number) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CREDITS_EVENT, { detail: remaining }))
}

/** 분석 중 차감 예정 크레딧 (끝나면 null) */
export function notifyCreditsPending(amount: number | null) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CREDITS_PENDING_EVENT, { detail: amount }))
}

export function CreditChip({ credits, unlimited }: { credits: number | null; unlimited?: boolean }) {
  const [value, setValue] = useState(credits)
  const [isUnlimited, setIsUnlimited] = useState(!!unlimited)
  const [pending, setPending] = useState<number | null>(null)
  const [drop, setDrop] = useState<{ amount: number; key: number } | null>(null)
  const valueRef = useRef(credits)

  const apply = (next: number) => {
    const prev = valueRef.current
    if (typeof prev === "number" && next < prev) {
      setDrop({ amount: prev - next, key: Date.now() })
      setTimeout(() => setDrop(null), 1800)
    }
    valueRef.current = next
    setValue(next)
  }

  useEffect(() => {
    valueRef.current = credits
    setValue(credits)
  }, [credits])

  // 최신 값 다시 읽기
  useEffect(() => {
    let alive = true
    getMyCredits().then(r => {
      if (!alive || !r) return
      setIsUnlimited(r.unlimited)
      if (typeof r.credits === "number") { valueRef.current = r.credits; setValue(r.credits) }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const n = (e as CustomEvent<number>).detail
      if (typeof n === "number") apply(n)
    }
    const onPending = (e: Event) => setPending((e as CustomEvent<number | null>).detail)
    window.addEventListener(CREDITS_EVENT, onUpdate)
    window.addEventListener(CREDITS_PENDING_EVENT, onPending)
    return () => {
      window.removeEventListener(CREDITS_EVENT, onUpdate)
      window.removeEventListener(CREDITS_PENDING_EVENT, onPending)
    }
  }, [])

  if (isUnlimited) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
        <Coins className="w-3.5 h-3.5 text-primary" /> 크레딧 무제한
      </span>
    )
  }
  if (value === null) return null

  const empty = value <= 0
  return (
    <span className="relative inline-flex items-center gap-1.5">
      <Link
        href="/payment/credits"
        title="크레딧 충전하기"
        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs transition-colors ${
          empty ? "border-primary bg-primary text-white hover:bg-primary/90" : "border-border hover:border-primary/50"
        } ${drop ? "ring-2 ring-red-400/60" : ""}`}
      >
        <Coins className={`w-3.5 h-3.5 ${empty ? "text-white" : "text-primary"}`} />
        <span className={empty ? "font-semibold" : "text-foreground"}>
          <span className="hidden sm:inline">크레딧 </span>
          <span key={value} className={`inline-block font-bold ${drop ? "animate-in zoom-in-50 duration-500 text-red-600" : ""}`}>{value}</span>
        </span>
        <span className={`font-semibold ${empty ? "" : "text-primary"}`}>충전</span>
      </Link>

      {/* 분석 중: 차감 예정 */}
      {pending !== null && pending > 0 && (
        <span className="whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 animate-pulse">
          −{pending} 차감 예정
        </span>
      )}

      {/* 분석 끝: 차감된 만큼 "−n"이 떠오른다 */}
      {drop && (
        <span
          key={drop.key}
          className="pointer-events-none absolute left-1/2 -bottom-6 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow animate-out fade-out slide-out-to-top-4 duration-1000 fill-mode-forwards delay-700"
        >
          −{drop.amount} 크레딧
        </span>
      )}
    </span>
  )
}
