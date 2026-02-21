"use client"

import React from "react"
import { Upload, Sparkles, Database } from "lucide-react"
import Link from "next/link"

export function HeroSection() {
  return (
    <section className="min-h-[90vh] flex items-center justify-center px-6 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
      <div className="max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          첫 1회 무료
        </div>

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
          게임 기획 문서 <span className="text-[#5B8DEF]">AI 피드백</span>
        </h1>

        {/* Subtitle */}
        <p className="text-slate-400 mb-6 flex items-center justify-center gap-2">
          <Database className="w-4 h-4 text-[#5B8DEF]" />
          <span>실제 합격 포트폴리오 <span className="text-[#5B8DEF] font-semibold">187개</span>로 학습된 AI</span>
        </p>

        {/* Upload Area - /analyze 페이지로 이동 */}
        <Link href="/analyze">
          <div className="relative bg-slate-900/80 border-2 border-dashed rounded-2xl p-8 md:p-12 transition-all duration-300 cursor-pointer group border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-900">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors bg-[#5B8DEF]/10 group-hover:bg-[#5B8DEF]/20">
                <Upload className="w-8 h-8 text-[#5B8DEF]" />
              </div>

              <p className="text-white font-medium mb-2">
                문서를 드래그하거나 클릭하여 업로드
              </p>
              <p className="text-slate-500 text-sm">
                PDF, DOCX, TXT (최대 50MB)
              </p>
            </div>

            {/* Decorative Corner Icons */}
            <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-[#5B8DEF]/30 rounded-tl" />
            <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-[#5B8DEF]/30 rounded-tr" />
            <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-[#5B8DEF]/30 rounded-bl" />
            <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-[#5B8DEF]/30 rounded-br" />
          </div>
        </Link>

        {/* Bottom Note */}
        <div className="mt-6 space-y-1">
          <p className="text-slate-500 text-sm">
            업로드 시 <span className="text-slate-400">개인정보 처리방침</span>에 동의하는 것으로 간주됩니다.
          </p>
          <p className="text-slate-600 text-xs">
            🔒 업로드된 자료는 분석 후 즉시 서버에서 삭제됩니다.
          </p>
        </div>
      </div>
    </section>
  )
}
