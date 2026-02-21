"use client"

import { Database, ShieldCheck, BarChart3, FolderOpen, ArrowRight, MessageSquare } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export function WhyChooseUs() {
  return (
    <section className="py-24 bg-[#0d1f3c]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Hero Text */}
        <div className="text-center mb-20">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            AI 첨삭 받고도 왜{" "}
            <span className="text-red-400">서류에서 떨어졌을까요?</span>
          </h2>
          <p className="text-lg md:text-xl text-slate-400 max-w-3xl mx-auto leading-relaxed">
            할루시네이션(거짓 정보)과 뻔한 조언에 지치셨나요?<br />
            인터넷 긁어온 AI로는 합격할 수 없습니다.
          </p>
        </div>

        {/* The Instructor's Edge - Split Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
          {/* Text Left */}
          <div className="space-y-6">
            <p className="text-xl md:text-2xl text-white leading-relaxed">
              여러분은 합격 포트폴리오 단 하나를 구하기 위해 목을 매지만,
            </p>
            <p className="text-xl md:text-2xl text-white leading-relaxed">
              제게는 제 손을 거쳐 취업한{" "}
              <span className="text-[#5B8DEF] font-bold">100개 이상의 실제 데이터</span>가 있습니다.
            </p>
            <p className="text-lg text-slate-300 leading-relaxed mt-8">
              이 서비스는 합격 포트폴리오 100개 이상을{" "}
              <span className="text-[#5B8DEF] font-semibold">Google Gemini</span>에 학습시켜 만든{" "}
              <span className="text-white font-semibold">'검증된 솔루션'</span>입니다.
            </p>
          </div>

          {/* Image Right */}
          <div className="relative">
            <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-2xl p-8 aspect-[4/3] flex flex-col items-center justify-center">
              <FolderOpen className="w-16 h-16 text-[#5B8DEF] mb-4" />
              <p className="text-slate-400 text-center font-medium">
                실제 합격자 포트폴리오 100개 폴더 캡처 화면
              </p>
              <p className="text-slate-500 text-sm mt-2">
                (이미지 준비 중)
              </p>
            </div>
            <div className="absolute -bottom-4 -right-4 bg-[#5B8DEF] text-white px-4 py-2 rounded-lg font-bold text-sm">
              100+ 합격 데이터
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
                검증된 <span className="text-[#5B8DEF]">합격 포트폴리오 100개</span>를 기반으로 분석합니다.
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
                당신의 문서 vs <span className="text-[#5B8DEF]">100개 이상의 합격 포트폴리오</span>.
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

          <div className="grid md:grid-cols-3 gap-6">
            {/* 점수 카드 */}
            <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-2xl p-8 flex flex-col items-center justify-center">
              <div className="text-6xl font-bold text-[#5B8DEF] mb-2">85</div>
              <div className="text-slate-400 text-sm mb-4">종합 점수</div>
              <div className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                A등급 · 상위 12%
              </div>
            </div>

            {/* 레이더 차트 */}
            <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-2xl p-8 flex flex-col items-center justify-center">
              <BarChart3 className="w-16 h-16 text-[#5B8DEF] mb-4" />
              <p className="text-white font-medium mb-2">5개 영역 레이더 분석</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                구조 · 논리 · 창의성 · 실현성 · 표현력
              </p>
            </div>

            {/* 피드백 카드 */}
            <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-2xl p-8 flex flex-col items-center justify-center">
              <MessageSquare className="w-16 h-16 text-emerald-400 mb-4" />
              <p className="text-white font-medium mb-2">항목별 상세 피드백</p>
              <p className="text-slate-400 text-sm leading-relaxed">
                각 영역별 강점, 약점, 구체적 개선 방향 제시
              </p>
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
