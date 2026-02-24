"use client"

import { Database, ShieldCheck, BarChart3, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import Image from "next/image"

export function WhyChooseUs() {
  return (
    <section className="py-24 bg-[#0d1f3c]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Hero Text */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            &quot;핵심 루프를 잘 설계하세요.&quot;<br />
            <span className="text-red-400">그래서 어쩌라고요?</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            GPT에게 기획서를 넣으면 돌아오는 건 게임디자인 교과서 요약뿐.<br />
            <span className="text-slate-300">당신의 문서에만 해당하는 피드백</span>은 단 한 줄도 없습니다.
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
          <div className="relative">
            <div className="relative bg-slate-900/80 border border-[#1e3a5f] rounded-2xl overflow-hidden">
              {/* 학습 데이터 관리 스크린샷 - 회사별 현황 보이게 + 파일명 블러 */}
              <div className="relative aspect-[4/3]">
                <Image
                  src="/portfolio-data.png"
                  alt="합격자 포트폴리오 학습 데이터"
                  fill
                  className="object-cover object-top opacity-90"
                />
                {/* 하단 파일 목록 영역 강한 블러 (개인정보 보호) */}
                <div className="absolute bottom-0 left-0 right-0 h-[55%] backdrop-blur-md bg-[#0d1f3c]/40" />
                {/* 하단 그라데이션 */}
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-[#0d1f3c] to-transparent" />
                {/* 하단 187개 강조 오버레이 */}
                <div className="absolute bottom-0 left-0 right-0 p-6 flex items-end justify-between">
                  <div>
                    <div className="text-5xl md:text-6xl font-black text-[#5B8DEF] drop-shadow-2xl leading-none">187</div>
                    <p className="text-white text-sm font-bold mt-1 drop-shadow-lg">합격자 포트폴리오</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-300 text-xs drop-shadow-lg">187개의 문서 · 1.34GB</p>
                    <p className="text-slate-400 text-xs drop-shadow-lg mt-0.5">실제 데이터로 학습된 AI</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-[#5B8DEF] text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">
              📄 187개 실전 데이터
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

        {/* AI 분석 결과 미리보기 */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 text-[#5B8DEF] text-sm font-medium mb-8">
            AI가 이렇게 분석합니다
          </div>

          <h3 className="text-2xl md:text-3xl font-bold text-white mb-12">
            분석 결과 미리보기
          </h3>

          <div className="space-y-6">
            {/* 1행: 종합점수 + 레이더차트 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-score.png"
                alt="종합 점수 및 레이더 차트 분석 결과"
                width={2176}
                height={1142}
                className="w-full h-auto"
              />
            </div>

            {/* 2행: 회사별 합격자 비교 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-ranking.png"
                alt="회사별 합격자 평균 vs 내 점수 비교"
                width={2178}
                height={2054}
                className="w-full h-auto"
              />
            </div>

            {/* 3행: 강점/약점 + 게임디자인 역량 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-feedback.png"
                alt="강점, 약점 분석 및 게임 디자인 역량 평가"
                width={2178}
                height={2054}
                className="w-full h-auto"
              />
            </div>

            {/* 4행: 문서 가독성 + 레이아웃 개선 제안 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-readability.png"
                alt="문서 가독성 분석 및 레이아웃 개선 제안"
                width={2140}
                height={2352}
                className="w-full h-auto"
              />
            </div>

            {/* 5행: 버전별 점수 비교 */}
            <div className="relative rounded-2xl overflow-hidden border border-[#1e3a5f]">
              <Image
                src="/preview-history.png"
                alt="버전별 점수 변화 추적 및 비교"
                width={2002}
                height={780}
                className="w-full h-auto"
              />
            </div>
          </div>

          <a
            href="/analyze"
            className="inline-flex items-center gap-2 mt-12 text-[#5B8DEF] hover:text-[#7aa5f5] font-medium transition-colors"
          >
            지금 바로 분석해보기
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </section>
  )
}
