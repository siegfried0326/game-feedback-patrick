/**
 * 문라이트 아카이브 로고 — 문라이트 커리어랩 M 심볼 + 워드마크
 *
 * 심볼은 로고 시안(2026-10)의 각진 M을 코발트→스카이 그라디언트로 옮긴 것.
 * 워드마크 구성은 시안의 "MOONLIGHT / C A R E E R  L A B"을 따라 "MOONLIGHT / A R C H I V E".
 */
import { useId } from "react"

export function MoonlightMark({ className = "w-7 h-7" }: { className?: string }) {
  const id = useId()
  return (
    <svg viewBox="0 0 140 125" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-m`} x1="0" y1="0" x2="1" y2="0.35">
          <stop offset="0" stopColor="#0046AD" />
          <stop offset="0.5" stopColor="#5F97E0" />
          <stop offset="1" stopColor="#0046AD" />
        </linearGradient>
      </defs>
      <polygon
        points="0,0 70,47 140,0 140,125 112,104 112,40 70,68 28,40 28,104 0,125"
        fill={`url(#${id}-m)`}
      />
    </svg>
  )
}

export function BrandLogo({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const mark = size === "lg" ? "w-11 h-10" : size === "sm" ? "w-6 h-5" : "w-8 h-7"
  const title = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base"
  const sub = size === "lg" ? "text-[11px]" : "text-[8.5px]"
  return (
    <span className="inline-flex items-center gap-2.5">
      <MoonlightMark className={mark} />
      <span className="flex flex-col leading-none">
        <span className={`${title} font-extrabold tracking-tight text-foreground`}>MOONLIGHT</span>
        <span className={`${sub} mt-1 font-semibold tracking-[0.42em] text-muted-foreground`}>ARCHIVE</span>
      </span>
      <span className="sr-only">문라이트 아카이브</span>
    </span>
  )
}
