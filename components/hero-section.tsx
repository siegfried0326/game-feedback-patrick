"use client"

import React from "react"
import { Upload, Sparkles, Database, XCircle, CheckCircle2, ArrowRight, BarChart3 } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="min-h-[85vh] flex items-center px-6 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c] pt-20 pb-12">
      <div className="max-w-6xl mx-auto w-full">
        {/* Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            첫 2회 무료 분석
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-3 text-center">
          게임 기획 문서 <span className="text-[#5B8DEF]">AI 피드백</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 mb-10 flex items-center justify-center gap-2">
          <Database className="w-4 h-4 text-[#5B8DEF]" />
          <span>실제 합격 포트폴리오 <span className="text-[#5B8DEF] font-semibold">187개</span>로 학습된 <span className="text-[#5B8DEF] font-semibold">Claude AI</span></span>
        </p>

        {/* 2-Column Layout - items-stretch로 높이 맞춤 */}
        <div className="grid lg:grid-cols-2 gap-8 items-stretch">

          {/* LEFT: 차별점 */}
          <div className="flex flex-col gap-4">
            {/* 이 서비스는? — 위로 올림 */}
            <div className="bg-[#5B8DEF]/5 border border-[#5B8DEF]/30 rounded-2xl p-6 flex-1">
              <p className="text-[#5B8DEF] font-bold text-sm mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                이 서비스는?
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">187개 합격 포트폴리오</span>를 기준으로 비교</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">넥슨·넷마블·크래프톤 등 <span className="text-white font-medium">회사별 합격자 평균</span>과 비교</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">문서에 없는 내용은 <span className="text-white font-medium">절대 칭찬하지 않음</span></p>
                </div>
                <div className="flex items-start gap-2.5">
                  <BarChart3 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">합격자와 점수 비교</span>를 통해 객관적인 피드백 진행</p>
                </div>
              </div>
            </div>

            {/* GPT/Gemini 비교 — 아래로 */}
            <div className="bg-slate-900/60 border border-[#1e3a5f] rounded-2xl p-6 flex-1">
              <p className="text-red-400 font-bold text-sm mb-4 flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                GPT / Gemini에 넣으면?
              </p>
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-red-400/60 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-500">&quot;문서 구조가 좋습니다&quot; — 뻔한 말</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-red-400/60 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-500">&quot;리더십을 더 강조하세요&quot; — 근거 없음</p>
                </div>
                <div className="flex items-start gap-2.5">
                  <XCircle className="w-4 h-4 text-red-400/60 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-500">합격 기준을 모름 → 할루시네이션</p>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 text-center">
              11년차 현업 게임 기획자가 만든 학습 데이터 기반 AI
            </p>
          </div>

          {/* RIGHT: 업로드 영역 - flex로 높이 맞춤 */}
          <div className="flex flex-col">
            <Link href="/analyze" className="flex-1 flex">
              <div className="relative bg-slate-900/80 border-2 border-dashed rounded-2xl p-8 md:p-10 transition-all duration-300 cursor-pointer group border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-900 w-full flex flex-col items-center justify-center">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors bg-[#5B8DEF]/10 group-hover:bg-[#5B8DEF]/20">
                    <Upload className="w-8 h-8 text-[#5B8DEF]" />
                  </div>

                  <p className="text-white font-medium mb-2">
                    문서를 업로드하고 분석받기
                  </p>
                  <p className="text-slate-500 text-sm mb-4">
                    PDF, DOCX, TXT (최대 500MB)
                  </p>

                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white font-semibold rounded-xl transition-colors text-sm">
                    무료로 분석 시작
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                {/* Decorative Corner Icons */}
                <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-[#5B8DEF]/30 rounded-tl" />
                <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-[#5B8DEF]/30 rounded-tr" />
                <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-[#5B8DEF]/30 rounded-bl" />
                <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-[#5B8DEF]/30 rounded-br" />
              </div>
            </Link>

            {/* Bottom Note */}
            <div className="mt-4 text-center space-y-1">
              <p className="text-slate-500 text-xs">
                업로드 시 <span className="text-slate-400">개인정보 처리방침</span>에 동의하는 것으로 간주됩니다.
              </p>
              <p className="text-slate-600 text-xs">
                🔒 업로드된 자료는 분석 후 즉시 서버에서 삭제됩니다.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
