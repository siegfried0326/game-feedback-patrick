import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-6 bg-[#0a1628]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#5B8DEF] text-sm font-medium tracking-wide uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            합리적인 요금제
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            첫 1회는 무료! 필요한 만큼 크레딧을 구매하거나,<br className="hidden sm:block" />
            무제한 구독을 시작하세요.
          </p>
        </div>

        {/* 회차권 + 구독 통합 */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* 회차권 묶음 */}
          <div className="bg-slate-900/80 rounded-2xl p-8 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">회차권</h3>
              <p className="text-sm text-slate-400">필요한 만큼만 구매</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">무료 체험</span>
                  <span className="text-slate-500 text-sm ml-2">1회</span>
                </div>
                <span className="text-white font-bold">0원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">1회권</span>
                </div>
                <span className="text-white font-bold">2,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">5회권</span>
                  <span className="text-amber-400 text-xs ml-2">45%↓</span>
                </div>
                <span className="text-white font-bold">7,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">10회권</span>
                  <span className="text-amber-400 text-xs ml-2">55%↓</span>
                </div>
                <span className="text-white font-bold">12,900원</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {["15개 항목 점수 평가", "상세 코멘트 제공", "크레딧 만료 없음"].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                  <span className="text-slate-400">{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full bg-[#162a4a] hover:bg-[#1e3a5f] text-white">
              <Link href="/payment/credits">크레딧 구매</Link>
            </Button>
          </div>

          {/* 월 무제한 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10 scale-[1.02] transition-all duration-300 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                추천
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">월 무제한</h3>
              <p className="text-sm text-slate-400">집중적인 포트폴리오 준비에 최적</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">13,800</span>
                <span className="text-slate-400">원</span>
                <span className="text-slate-400 text-sm">/ 월</span>
              </div>
              <p className="text-xs text-emerald-400 mt-2">게임캔버스 수강생 월 5,900원</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {["무제한 분석", "무제한 프로젝트", "상세 코멘트 제공", "포지션별 맞춤 피드백", "버전별 점수 비교 분석"].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                  <span className="text-slate-400">{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/payment/billing?plan=monthly">구독 시작하기</Link>
            </Button>
          </div>

          {/* 3개월 무제한 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                프리미엄 AI
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">3개월 무제한</h3>
              <p className="text-sm text-slate-400">월 13,000원 수준 + 프리미엄 AI</p>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">39,000</span>
                <span className="text-slate-400">원</span>
                <span className="text-slate-400 text-sm">/ 3개월</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {["무제한 분석", "무제한 프로젝트", "상세 코멘트 제공", "포지션별 맞춤 피드백", "버전별 점수 비교 분석", "프리미엄 AI (Claude Opus)"].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                  <span className="text-slate-400">{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full bg-[#162a4a] hover:bg-[#1e3a5f] text-white">
              <Link href="/payment/billing?plan=three_month">3개월 구매</Link>
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          모든 요금제는 언제든지 해지 가능합니다. 숨겨진 비용이 없습니다.
        </p>
      </div>
    </section>
  )
}
