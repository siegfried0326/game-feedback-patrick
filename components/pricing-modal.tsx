/**
 * 요금제 모달
 *
 * 헤더의 "가격표" 버튼 클릭 시 열리는 다이얼로그.
 * BM 개편(2026-08-05): 크레딧 + 1:1 과외 2축. 구독 판매 종료.
 * 사용: header.tsx, analyze-header.tsx
 */
"use client"

import Link from "next/link"
import { Check, Sparkles, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAYMENTS_ENABLED } from "@/lib/payments-config"
import { TUTORING_KAKAO_URL } from "@/lib/tutoring-config"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const plans = [
  {
    name: "크레딧",
    price: "2,900",
    period: "1크레딧~",
    description: "필요한 만큼 구매 (1/5/10크레딧)",
    features: [
      "1크레딧 2,900원 / 5크레딧 7,900원 / 10크레딧 12,900원",
      "15개 항목 점수 평가",
      "상세 코멘트 제공",
      "크레딧 만료 없음",
    ],
    cta: "크레딧 구매",
    href: "/payment/credits",
    external: false,
    highlighted: true,
    amber: false,
    badge: null as string | null,
  },
  {
    name: "게임 기획 1:1 과외",
    price: "상담 후 안내",
    period: "",
    description: "11년차 현업 기획자 직접 지도",
    features: [
      "포트폴리오 완성까지 직접 피드백",
      "수강 기간 중 매월 AI 분석 크레딧 지급",
      "면접 연습 + 게임 디자인 라이브러리 이용",
      "상담은 무료 (오픈카톡)",
    ],
    cta: "오픈카톡 상담",
    href: TUTORING_KAKAO_URL,
    external: true,
    highlighted: false,
    amber: true,
    badge: "수강생 혜택 포함",
  },
]

export function PricingModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          suppressHydrationWarning
        >
          가격표
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-[90vw] md:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">요금제 선택</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            첫 1회 무료! 크레딧 구매 또는 1:1 과외
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-xl p-6 border transition-all duration-300 flex flex-col ${
                plan.highlighted
                  ? "border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10"
                  : plan.amber
                  ? "border-amber-500/40 shadow-lg shadow-amber-500/5 hover:border-amber-500/70"
                  : "border-border hover:border-[#5B8DEF]/30"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-white text-xs font-medium ${
                    plan.amber ? "bg-amber-500" : "bg-[#5B8DEF]"
                  }`}>
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-3">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-muted-foreground min-h-[2rem]">
                  {plan.description}
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-foreground whitespace-nowrap ${plan.period ? "text-3xl" : "text-xl"}`}>
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-muted-foreground text-sm whitespace-nowrap">원 / {plan.period}</span>
                  )}
                </div>
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2 text-xs">
                    <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${plan.amber ? "text-amber-400" : "text-[#5B8DEF]"}`} />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {!PAYMENTS_ENABLED && !plan.external ? (
                <Button disabled size="sm" className="w-full mt-auto bg-secondary text-muted-foreground opacity-60 cursor-not-allowed">
                  결제 준비 중
                </Button>
              ) : plan.external ? (
                <Button
                  asChild
                  size="sm"
                  className="w-full mt-auto bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <a href={plan.href} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-3.5 h-3.5 mr-1.5" />
                    {plan.cta}
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  size="sm"
                  className="w-full mt-auto bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
                >
                  <Link href={plan.href}>
                    {plan.cta}
                  </Link>
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
