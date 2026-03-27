/**
 * 왜 아카이브 187인가 섹션 — 랜딩 페이지 (239줄)
 *
 * 3가지 핵심 차별점 + 미리보기 슬라이드:
 * 1. 학습 데이터 기반 → 미리보기: 종합 점수, 합격자 비교, 맞춤 피드백
 * 2. 정량적 점수 → 자동 슬라이드 전환 (3초)
 * 3. 합격자 비교 → 분석 시작 CTA 버튼
 * 사용: app/(landing)/page.tsx
 */
"use client"

import { useRef, useState, useEffect } from "react"
import { Database, ShieldCheck, BarChart3, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

const PREVIEW_SLIDES = [
  { src: "/preview-score.png", alt: "종합 점수 및 레이더 차트 분석 결과", label: "종합 점수" },
  { src: "/preview-ranking.png", alt: "회사별 합격자 평균 vs 내 점수 비교", label: "합격자 비교" },
  { src: "/preview-feedback.png", alt: "강점, 약점 분석 및 게임 디자인 역량 평가", label: "강점/약점 분석" },
  { src: "/preview-readability.png", alt: "문서 가독성 분석 및 레이아웃 개선 제안", label: "가독성 분석" },
  { src: "/preview-history.png", alt: "버전별 점수 변화 추적 및 비교", label: "점수 변화" },
]

function StickyPreview() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const containerHeight = containerRef.current.offsetHeight
      const viewportHeight = window.innerHeight
      // 컨테이너가 화면 위로 얼마나 지나갔는지 (0 ~ 1)
      const scrolled = -rect.top / (containerHeight - viewportHeight)
      const clamped = Math.max(0, Math.min(1, scrolled))
      const index = Math.min(
        PREVIEW_SLIDES.length - 1,
        Math.floor(clamped * PREVIEW_SLIDES.length)
      )
      setActiveIndex(index)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  return (
    // 외부 컨테이너: 슬라이드 수 × 100dvh로 스크롤 공간 확보 (dvh = 모바일 주소창 대응)
    <div
      ref={containerRef}
      style={{ height: `${PREVIEW_SLIDES.length * 100}dvh` }}
    >
      {/* 고정 뷰포트 */}
      <div className="sticky top-0 flex flex-col items-center justify-center px-4 md:px-6 overflow-hidden" style={{ height: "100dvh" }}>
        {/* 헤더 */}
        <div className="text-center mb-4 md:mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 text-[#5B8DEF] text-xs md:text-sm font-medium mb-3 md:mb-4">
            AI가 이렇게 분석합니다
          </div>
          <h3 className="text-xl md:text-3xl font-bold text-white">
            분석 결과 미리보기
          </h3>
        </div>

        {/* 이미지 영역 */}
        <div className="relative w-full max-w-4xl flex-1 min-h-0 mb-3 md:mb-6">
          {PREVIEW_SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-out"
              style={{
                opacity: i === activeIndex ? 1 : 0,
                transform: i === activeIndex
                  ? "translateY(0) scale(1)"
                  : i < activeIndex
                    ? "translateY(-20px) scale(0.97)"
                    : "translateY(20px) scale(0.97)",
                pointerEvents: i === activeIndex ? "auto" : "none",
              }}
            >
              <div className="relative rounded-xl md:rounded-2xl overflow-hidden border border-[#1e3a5f] w-full max-h-[45dvh] sm:max-h-[55dvh] md:max-h-[65dvh]">
                <Image
                  src={slide.src}
                  alt={slide.alt}
                  width={2178}
                  height={2054}
                  className="w-full h-auto"
                />
              </div>
            </div>
          ))}
        </div>

        {/* 하단 인디케이터 + 레이블 */}
        <div className="flex flex-col items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5 md:gap-2">
            {PREVIEW_SLIDES.map((slide, i) => (
              <button
                key={i}
                className={`transition-all duration-300 rounded-full ${
                  i === activeIndex
                    ? "w-6 md:w-8 h-2 md:h-2.5 bg-[#5B8DEF]"
                    : "w-2 md:w-2.5 h-2 md:h-2.5 bg-slate-600"
                }`}
                aria-label={slide.label}
              />
            ))}
          </div>
          <p className="text-xs md:text-sm text-slate-400">
            {PREVIEW_SLIDES[activeIndex].label}
            <span className="text-slate-600 ml-2">{activeIndex + 1} / {PREVIEW_SLIDES.length}</span>
          </p>
        </div>
      </div>
    </div>
  )
}

export function WhyChooseUs() {
  return (
    <>
    <section className="py-24 bg-[#0d1f3c]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Hero Text */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            &quot;핵심 루프를 잘 설계하세요.&quot;<br />
            <span className="text-red-400">그래서 어쩌라고요?</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            GPT에게 기획서를 넣으면 돌아오는 건 교과서 요약뿐.<br />
            <span className="text-slate-300">당신의 문서에 해당하는 피드백</span>은 단 한 줄도 없습니다.
          </p>
        </div>

        {/* The Instructor's Edge - Split Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
          {/* Text Left */}
          <div className="space-y-6">
            <p className="text-xl md:text-2xl text-white leading-relaxed">
              여러분은 합격 포트폴리오 단 하나도<br />
              구하기 어렵지만,
            </p>
            <p className="text-xl md:text-2xl text-white leading-relaxed">
              제게는 제 손을 거쳐 취업한<br />
              <span className="text-[#5B8DEF] font-bold">187개의 실제 데이터</span>가 있습니다.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed mt-8">
              이 서비스는 합격 포트폴리오 187개를{" "}
              <span className="text-[#5B8DEF] font-semibold">Claude AI</span>에 학습시켜 만든<br />
              <span className="text-white font-semibold">&apos;검증된 솔루션&apos;</span>입니다.
            </p>
          </div>

          {/* Image Right - 실제 포트폴리오 데이터 */}
          <div className="space-y-4">
            {/* 회사별 학습 데이터 현황 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/training-data-management1.png"
                alt="회사별 학습 데이터 현황"
                width={1560}
                height={600}
                className="w-full h-auto"
              />
            </div>
            {/* 학습 데이터 목록 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/training-data-management2.png"
                alt="학습 데이터 목록"
                width={1024}
                height={560}
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>

        {/* The Process - 3 Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          <Card className="bg-slate-900/80 border-[#1e3a5f] hover:border-[#5B8DEF]/50 transition-colors">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 bg-[#5B8DEF]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <Database className="w-7 h-7 text-[#5B8DEF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                데이터의 질이 다릅니다
              </h3>
              <p className="text-slate-400 leading-relaxed">
                검증된 <span className="text-[#5B8DEF]">합격 포트폴리오 187개</span>를 기반으로 분석합니다.
                인터넷에서 긁어온 데이터가 아닙니다.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-[#1e3a5f] hover:border-[#5B8DEF]/50 transition-colors">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 bg-[#5B8DEF]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <ShieldCheck className="w-7 h-7 text-[#5B8DEF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                거짓말을 하지 않습니다
              </h3>
              <p className="text-slate-400 leading-relaxed">
                할루시네이션 없는 <span className="text-[#5B8DEF]">팩트 기반 분석</span>.
                실제 합격 사례와 비교하여 객관적인 피드백을 제공합니다.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-slate-900/80 border-[#1e3a5f] hover:border-[#5B8DEF]/50 transition-colors">
            <CardContent className="p-8 text-center">
              <div className="w-14 h-14 bg-[#5B8DEF]/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-7 h-7 text-[#5B8DEF]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                냉정한 비교 분석
              </h3>
              <p className="text-slate-400 leading-relaxed">
                당신의 문서 vs <span className="text-[#5B8DEF]">187개의 합격 포트폴리오</span>.
                어디가 부족한지, 무엇을 보완해야 하는지 명확히 알려드립니다.
              </p>
            </CardContent>
          </Card>
        </div>

      </div>
    </section>

    {/* AI 분석 결과 미리보기 - Sticky Scroll */}
    <section className="bg-[#0d1f3c]">
      <StickyPreview />
      <div className="text-center pb-24">
        <a
          href="/analyze"
          className="inline-flex items-center gap-2 text-[#5B8DEF] hover:text-[#7aa5f5] font-medium transition-colors"
        >
          지금 바로 분석해보기
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    </section>
    </>
  )
}
