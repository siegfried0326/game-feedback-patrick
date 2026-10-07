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
    <section id="pricing" className="py-20 px-6 bg-background">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-4 block">
            Pricing
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 text-balance">
            합리적인 요금제
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            첫 1회는 무료! 필요한 만큼 크레딧을 구매하고,<br className="hidden sm:block" />
            더 깊은 피드백이 필요하다면 1:1 과외로 함께하세요.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
          {/* 크레딧 묶음 */}
          <div className="bg-card rounded-2xl p-8 border border-border hover:border-primary/30 transition-all duration-300 flex flex-col">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">크레딧</h3>
              <p className="text-sm text-muted-foreground">필요한 만큼만 구매 · 만료 없음</p>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                <div>
                  <span className="text-foreground font-medium">무료 체험</span>
                  <span className="text-muted-foreground text-sm ml-2">1회</span>
                </div>
                <span className="text-foreground font-bold">0원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                <div>
                  <span className="text-foreground font-medium">1크레딧</span>
                </div>
                <span className="text-foreground font-bold">3,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                <div>
                  <span className="text-foreground font-medium">5크레딧</span>
                  <span className="text-primary text-xs font-semibold ml-2">34%↓</span>
                </div>
                <span className="text-foreground font-bold">12,900원</span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-lg bg-secondary">
                <div>
                  <span className="text-foreground font-medium">10크레딧</span>
                  <span className="text-primary text-xs font-semibold ml-2">49%↓</span>
                </div>
                <span className="text-foreground font-bold">19,900원</span>
              </div>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {["기본 분석 1크레딧 · 정밀 분석 2크레딧", "직군별 채점표로 15개 항목 평가", "상세 코멘트 제공", "크레딧 만료 없음"].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>

            {!PAYMENTS_ENABLED ? (
              <Button disabled className="w-full bg-secondary text-muted-foreground opacity-60 cursor-not-allowed">
                결제 준비 중
              </Button>
            ) : (
              <Button asChild className="w-full bg-primary hover:bg-primary/90 text-white">
                <Link href="/payment/credits">크레딧 구매</Link>
              </Button>
            )}
          </div>

          {/* 1:1 과외 */}
          <div className="relative bg-card rounded-2xl p-8 border border-foreground/80 shadow-lg shadow-black/5 hover:border-foreground transition-all duration-300 flex flex-col">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-ink text-white text-xs font-bold">
                <Sparkles className="w-3 h-3" />
                수강생 전용 혜택 포함
              </span>
            </div>

            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground mb-2">게임 기획 1:1 과외</h3>
              <p className="text-sm text-primary">11년차 현업 기획자 직접 지도 · 수강료는 상담 후 안내</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {[
                "포트폴리오 기획·구성부터 완성까지 직접 피드백",
                "수강 기간 중 매월 AI 분석 크레딧 지급",
                "면접 연습 모드 이용 (600문항 + AI 평가)",
                "게임 디자인 라이브러리 이용 (1,200+ 자료)",
              ].map((f, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-foreground/80">{f}</span>
                </li>
              ))}
            </ul>

            <Button asChild className="w-full bg-brand-ink hover:bg-black/85 text-white active:scale-95">
              <a href={TUTORING_KAKAO_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-4 h-4 mr-2" />
                오픈카톡으로 상담하기
              </a>
            </Button>
            <p className="text-xs text-muted-foreground text-center mt-3">상담은 무료입니다. 부담 없이 문의하세요.</p>
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          숨겨진 비용이 없습니다. 크레딧은 사용한 만큼만.
        </p>
      </div>
    </section>
  )
}
