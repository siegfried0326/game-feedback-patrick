"use client"

import { Brain, Database, FileWarning, CheckCircle2, XCircle, ArrowDown, Sparkles, TrendingUp } from "lucide-react"

export function AIComparison() {
  // 연도별 학습 데이터 수치
  const yearlyData = [
    { year: "2023", count: 32, label: "합격 포트폴리오" },
    { year: "2024", count: 48, label: "합격 포트폴리오" },
    { year: "2025", count: 41, label: "합격 포트폴리오" },
    { year: "2026", count: 12, label: "합산 중...", isOngoing: true },
  ]
  
  const totalCount = yearlyData.reduce((sum, item) => sum + item.count, 0)

  return (
    <section className="py-24 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 text-[#5B8DEF] text-sm font-medium mb-6">
            <Brain className="w-4 h-4" />
            AI 학습의 비밀
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
            <span className="text-red-400">Gemini가 부족한 게 아닙니다.</span><br />
            <span className="text-[#5B8DEF]">당신의 자료가 부족한 겁니다.</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            같은 AI도 어떤 데이터로 학습했느냐에 따라 결과가 완전히 달라집니다.
          </p>
        </div>

        {/* Comparison Infographic */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          
          {/* LEFT: Your Gemini (Bad) */}
          <div className="relative">
            <div className="absolute -top-3 left-6 px-4 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-sm font-medium">
              일반적인 AI 첨삭
            </div>
            <div className="bg-slate-900/80 border border-red-500/30 rounded-2xl p-8 pt-12">
              
              {/* Data Input Section */}
              <div className="mb-8">
                <p className="text-slate-400 text-sm mb-4 text-center">학습 데이터</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                    <FileWarning className="w-6 h-6 text-red-400/60 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">10년 전<br/>취업 자료</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center">
                    <FileWarning className="w-6 h-6 text-red-400/60 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">인터넷<br/>검색 결과</p>
                  </div>
                  <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-center opacity-40">
                    <div className="w-6 h-6 border-2 border-dashed border-slate-600 rounded mx-auto mb-2" />
                    <p className="text-xs text-slate-600">자료 없음</p>
                  </div>
                </div>
                <p className="text-center text-slate-500 text-sm mt-3">겨우 2~3개의 검증되지 않은 자료</p>
              </div>

              {/* Arrow */}
              <div className="flex justify-center mb-6">
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                  <ArrowDown className="w-5 h-5 text-slate-500" />
                </div>
              </div>

              {/* Gemini Brain */}
              <div className="bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Gemini AI</p>
                    <p className="text-xs text-red-400">부족한 데이터로 학습</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-red-500/60 h-2 rounded-full" style={{ width: '25%' }} />
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">학습 품질: 25%</p>
              </div>

              {/* Output */}
              <div className="space-y-3">
                <p className="text-slate-400 text-sm text-center mb-4">AI 피드백 결과</p>
                <div className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400">"문서 구조가 좋습니다" (뻔한 말)</p>
                </div>
                <div className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400">"리더십을 더 강조하세요" (근거 없음)</p>
                </div>
                <div className="flex items-start gap-3 bg-slate-800/50 rounded-lg p-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-400">할루시네이션 (거짓 정보)</p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Our Gemini (Good) */}
          <div className="relative">
            <div className="absolute -top-3 left-6 px-4 py-1 bg-[#5B8DEF]/20 border border-[#5B8DEF]/30 rounded-full text-[#5B8DEF] text-sm font-medium">
              PATRICK AI 첨삭
            </div>
            <div className="bg-slate-900/80 border border-[#5B8DEF]/30 rounded-2xl p-8 pt-12">
              
              {/* Data Input Section - Yearly Stats */}
              <div className="mb-8">
                <p className="text-slate-400 text-sm mb-4 text-center">연도별 학습 데이터</p>
                
                {/* Year by Year Data Visualization */}
                <div className="space-y-3">
                  {yearlyData.map((item) => (
                    <div key={item.year} className="flex items-center gap-3">
                      <span className={`text-sm font-mono w-12 ${item.isOngoing ? 'text-[#5B8DEF]' : 'text-slate-400'}`}>
                        {item.year}
                      </span>
                      <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
                        <div 
                          className={`h-full rounded-full flex items-center justify-end pr-3 transition-all ${
                            item.isOngoing 
                              ? 'bg-gradient-to-r from-[#5B8DEF]/60 to-[#5B8DEF] animate-pulse' 
                              : 'bg-gradient-to-r from-[#5B8DEF]/80 to-[#5B8DEF]'
                          }`}
                          style={{ width: `${Math.min((item.count / 50) * 100, 100)}%` }}
                        >
                          <span className="text-xs font-bold text-white">{item.count}개</span>
                        </div>
                      </div>
                      <span className={`text-xs w-20 text-right ${item.isOngoing ? 'text-[#5B8DEF]' : 'text-slate-500'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Total Count */}
                <div className="mt-6 p-4 bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 rounded-xl text-center">
                  <div className="flex items-center justify-center gap-2">
                    <TrendingUp className="w-5 h-5 text-[#5B8DEF]" />
                    <span className="text-[#5B8DEF] font-bold text-2xl">{totalCount}+</span>
                  </div>
                  <p className="text-slate-400 text-sm mt-1">검증된 합격 포트폴리오 학습 완료</p>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center mb-6">
                <div className="w-10 h-10 rounded-full bg-[#5B8DEF]/20 border border-[#5B8DEF]/30 flex items-center justify-center">
                  <ArrowDown className="w-5 h-5 text-[#5B8DEF]" />
                </div>
              </div>

              {/* Gemini Brain */}
              <div className="bg-gradient-to-b from-[#5B8DEF]/10 to-slate-900 border border-[#5B8DEF]/30 rounded-xl p-6 mb-8">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#5B8DEF]/30 to-blue-500/20 flex items-center justify-center">
                    <Sparkles className="w-6 h-6 text-[#5B8DEF]" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Gemini AI</p>
                    <p className="text-xs text-[#5B8DEF]">검증된 데이터로 학습</p>
                  </div>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-gradient-to-r from-[#5B8DEF] to-blue-400 h-2 rounded-full" style={{ width: '95%' }} />
                </div>
                <p className="text-xs text-[#5B8DEF] mt-2 text-center">학습 품질: 95%</p>
              </div>

              {/* Output */}
              <div className="space-y-3">
                <p className="text-slate-400 text-sm text-center mb-4">AI 피드백 결과</p>
                <div className="flex items-start gap-3 bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 rounded-lg p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">"3번 문단의 수치 표현이 합격자 대비 구체성 부족"</p>
                </div>
                <div className="flex items-start gap-3 bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 rounded-lg p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">"A사 합격자 문서와 비교 시 기술 스택 설명 방식 개선 필요"</p>
                </div>
                <div className="flex items-start gap-3 bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 rounded-lg p-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-300">"상위 20% 합격자 평균 점수: 82점, 현재 점수: 67점"</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Message */}
        <div className="mt-16 text-center">
          <div className="inline-block bg-gradient-to-r from-[#5B8DEF]/10 via-[#5B8DEF]/5 to-[#5B8DEF]/10 border border-[#5B8DEF]/20 rounded-2xl px-8 py-6">
            <p className="text-xl md:text-2xl text-white font-medium">
              똑같은 <span className="text-[#4285F4]">G</span><span className="text-[#EA4335]">e</span><span className="text-[#FBBC05]">m</span><span className="text-[#4285F4]">i</span><span className="text-[#34A853]">n</span><span className="text-[#EA4335]">i</span>도,<br className="sm:hidden" />
              <span className="text-[#5B8DEF] font-bold"> 어떤 데이터로 학습했느냐</span>가 전부입니다.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
