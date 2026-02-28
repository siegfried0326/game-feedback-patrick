/**
 * 구독 요금제 모달 (181줄)
 *
 * 헤더의 "구독하기" 버튼 클릭 시 열리는 다이얼로그.
 * 3가지 플랜 카드: 무료 체험, 월 구독(17,900원), 3개월 패스(49,000원).
 * 각 플랜별 기능 목록 + "시작하기" 버튼 (구독 페이지로 이동).
 * 사용: header.tsx, analyze-header.tsx
 */
"use client"

import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

const plans = [
  {
    name: "회차권",
    price: "2,900",
    period: "1회~",
    description: "필요한 만큼 구매 (1회/5회/10회)",
    features: [
      "1회 2,900원 / 5회 7,900원 / 10회 12,900원",
      "15개 항목 점수 평가",
      "상세 코멘트 제공",
      "크레딧 만료 없음",
    ],
    cta: "크레딧 구매",
    href: "/payment/credits",
    highlighted: false,
  },
  {
    name: "월 무제한",
    price: "13,900",
    period: "월",
    description: "집중적인 포트폴리오 준비에 최적",
    discountNote: "게임캔버스 수강생 월 5,900원",
    features: [
      "무제한 분석",
      "무제한 프로젝트",
      "포지션별 맞춤 피드백",
      "버전별 점수 비교 분석",
    ],
    cta: "구독 시작하기",
    href: "/payment/billing?plan=monthly",
    highlighted: true,
  },
  {
    name: "3개월 무제한",
    price: "39,000",
    period: "3개월",
    description: "월 13,000원 수준 + 프리미엄 AI",
    badge: "프리미엄 AI",
    features: [
      "무제한 분석",
      "무제한 프로젝트",
      "포지션별 맞춤 피드백",
      "버전별 점수 비교 분석",
      "프리미엄 AI (Claude Opus)",
    ],
    cta: "3개월 구매",
    href: "/payment/billing?plan=three_month",
    highlighted: false,
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
      <DialogContent className="max-w-[90vw] md:max-w-5xl lg:max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">요금제 선택</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            첫 1회 무료! 크레딧 구매 또는 무제한 구독
          </p>
        </DialogHeader>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-card rounded-xl p-6 border transition-all duration-300 flex flex-col ${
                plan.highlighted
                  ? "border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10"
                  : "border-border hover:border-[#5B8DEF]/30"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}
              {plan.highlighted && !plan.badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    추천
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
                {plan.originalPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {plan.originalPrice}원
                  </span>
                )}
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground whitespace-nowrap">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm whitespace-nowrap">원 / {plan.period}</span>
                </div>
                {plan.discountNote && (
                  <p className="text-xs text-emerald-400 mt-1.5">{plan.discountNote}</p>
                )}
              </div>

              <ul className="space-y-2 mb-6 flex-1">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2 text-xs">
                    <Check className="w-3.5 h-3.5 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                size="sm"
                className={`w-full mt-auto ${
                  plan.highlighted
                    ? "bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
                    : "bg-secondary hover:bg-secondary/80 text-foreground"
                }`}
              >
                <Link href={plan.href}>
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
