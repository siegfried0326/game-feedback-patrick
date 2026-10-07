/**
 * 마케팅 구분선 — 섹션 간 강조 문구
 *
 * 랜딩 페이지 섹션 사이에 배치되는 한 줄 강조 문구.
 * 문라이트 로고 시안(2026-10)의 두 배경을 따른다:
 *   blue  — 코발트→스카이 그라디언트 + 흰 글자
 *   white — 블랙 바탕 + 스카이 사선 띠 + 흰 글자
 *   red   — (호환용) blue와 같음
 * 사용: app/page.tsx
 */
interface MarketingBreakProps {
  headline: string
  sub?: string
  accent?: "blue" | "red" | "white"
}

export function MarketingBreak({ headline, sub, accent = "white" }: MarketingBreakProps) {
  const dark = accent === "white"

  return (
    <section className={`relative overflow-hidden py-20 md:py-28 ${dark ? "bg-brand-ink" : "bg-brand-gradient"}`}>
      {dark ? (
        <>
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-1/2 h-[220%] w-20 md:w-28 -rotate-[58deg] origin-top bg-gradient-to-b from-[#9BC8F8] to-[#2F6CC8] opacity-90" />
          <div aria-hidden className="pointer-events-none absolute right-[8%] -bottom-1/2 h-[200%] w-10 md:w-14 rotate-[50deg] bg-[#9BC8F8]" />
        </>
      ) : (
        <div aria-hidden className="pointer-events-none absolute right-[10%] -top-1/2 h-[200%] w-32 rotate-[35deg] bg-white/10" />
      )}
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <p className="text-3xl md:text-4xl lg:text-5xl font-black leading-tight tracking-tight text-white">
          {headline}
        </p>
        {sub && (
          <p className="text-lg md:text-xl text-white/70 mt-6 leading-relaxed">
            {sub}
          </p>
        )}
      </div>
    </section>
  )
}
