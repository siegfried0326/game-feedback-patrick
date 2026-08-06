/**
 * 랜딩 가격 섹션
 *
 * BM 개편(2026-08-05): 크레딧 카드 + 1:1 과외 카드 2축.
 * 구독(월/3개월)은 판매 종료로 제거됨.
 */
import Link from "next/link"
import { Check, Sparkles, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAYMENTS_ENABLED } from "@/lib/payments-config"
import { TUTORING_KAKAO_URL } from "@/lib/tutoring-config"

export function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-6 bg-[#0a1628]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#5B8DEF] text-sm font-medium tracking-wide uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            합리적인 요금제
          </h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            첫 1회는 무료! 필요한 만큼 크레딧을 구매하고,<br className="hidden sm:block" />
            더 깊은 피드백이 필요하다면 1:1 과외로 함께하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* 크레딧 묶음 */}
          <div className="bg-slate-900/80 rounded-2xl p-8 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">크레딧</h3>
              <p className="text-sm text-slate-400">필요한 만큼만 구매 · 만료 없음</p>
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
                  <span className="text-white font-medium">1크레딧</span>
                </div>
                <span className="text-white font-bold">2,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">5크레딧</span>
                  <span className="text-amber-400 text-xs ml-2">45%↓</span>
                </div>
                <span className="text-white font-bold">7,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-slate-800/50">
                <div>
                  <span className="text-white font-medium">10크레딧</span>
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

            {!PAYMENTS_ENABLED ? (
              <Button disabled className="w-full bg-[#162a4a] text-slate-500 opacity-60 cursor-not-allowed">
                결제 준비 중
              </Button>
            ) : (
              <Button asChild className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                <Link href="/payment/credits">크레딧 구매</Link>
              </Button>
            )}
          </div>

          {/* 1:1 과외 */}
          <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-500/70 transition-all duration-300 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500 text-white text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                수강생 전용 혜택 포함
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">게임 기획 1:1 과외</h3>
              <p className="text-sm text-amber-400/80">11년차 현업 기획자 직접 지도 · 수강료는 상담 후 안내</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "포트폴리오 기획·구성부터 완성까지 직접 피드백",
                "수강 기간 중 매월 AI 분석 크레딧 지급",
                "면접 연습 모드 이용 (600문항 + AI 평가)",
                "게임 디자인 라이브러리 이용 (1,200+ 자료)",
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                  <span className="text-slate-300">{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full bg-amber-500 hover:bg-amber-600 text-white active:scale-95">
              <a href={TUTORING_KAKAO_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" />
                오픈카톡으로 상담하기
              </a>
            </Button>
            <p className="text-xs text-slate-500 text-center mt-3">상담은 무료입니다. 부담 없이 문의하세요.</p>
          </div>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          숨겨진 비용이 없습니다. 크레딧은 사용한 만큼만.
        </p>
      </div>
    </section>
  )
}
