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
    name: "무료 체험",
    price: "0",
    period: "무료",
    description: "처음 이용하시는 분들을 위한 무료 체험 (총 2회)",
    features: [
      "프로젝트 1개",
      "총 2회 문서 분석",
      "5개 항목 점수 평가",
      "기본 피드백 제공",
      "Claude Sonnet AI",
    ],
    cta: "무료로 시작하기",
    href: "/analyze",
    highlighted: false
  },
  {
    name: "월 구독",
    price: "17,900",
    period: "월",
    description: "집중적인 포트폴리오 준비에 최적",
    features: [
      "무제한 프로젝트",
      "무제한 문서 분석",
      "상세 코멘트 제공",
      "포지션별 맞춤 피드백",
      "버전별 점수 비교 분석",
      "Claude Sonnet AI",
    ],
    cta: "구독 시작하기",
    href: "/payment/billing?plan=monthly",
    highlighted: true
  },
  {
    name: "3개월 패스",
    price: "49,000",
    originalPrice: "53,700",
    period: "3개월",
    description: "프리미엄 AI로 더 정밀한 분석",
    badge: "프리미엄 AI",
    features: [
      "무제한 프로젝트",
      "무제한 문서 분석",
      "상세 코멘트 제공",
      "포지션별 맞춤 피드백",
      "버전별 점수 비교 분석",
      "프리미엄 AI (Claude Opus)",
    ],
    cta: "3개월 패스 구매",
    href: "/payment/billing?plan=three_month",
    highlighted: false
  }
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">요금제 선택</DialogTitle>
          <p className="text-center text-muted-foreground text-sm">
            첫 2회는 무료로 체험해 보세요
          </p>
        </DialogHeader>
        
        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {plans.map((plan, index) => (
            <div 
              key={index}
              className={`relative bg-card rounded-xl p-6 border transition-all duration-300 ${
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
              
              <div className="mb-4">
                <h3 className="text-base font-semibold text-foreground mb-1">
                  {plan.name}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {plan.description}
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  {plan.originalPrice && (
                    <span className="text-sm text-muted-foreground line-through mr-1">
                      {plan.originalPrice}원
                    </span>
                  )}
                  <span className="text-2xl font-bold text-foreground">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">원</span>
                  <span className="text-muted-foreground text-xs">/ {plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
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
                className={`w-full ${
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
