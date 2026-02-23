import Link from "next/link"
import { Check, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"

const plans: {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted: boolean
  originalPrice?: string
  badge?: string
  discountNote?: string
}[] = [
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
    discountNote: "게임캔버스 수강생 월 5,900원",
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
            첫 2회는 무료로 체험해 보세요.<br className="hidden sm:block" />
            마음에 드시면 구독을 시작하시면 됩니다.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-slate-900/80 rounded-2xl p-8 border transition-all duration-300 ${
                plan.highlighted
                  ? "border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10 scale-[1.02]"
                  : "border-[#1e3a5f] hover:border-[#5B8DEF]/30"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    추천
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  {plan.name}
                </h3>
                <p className="text-sm text-slate-400">
                  {plan.description}
                </p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  {plan.originalPrice && (
                    <span className="text-lg text-slate-500 line-through mr-2">
                      {plan.originalPrice}원
                    </span>
                  )}
                  <span className="text-4xl font-bold text-white">
                    {plan.price}
                  </span>
                  <span className="text-slate-400">원</span>
                  <span className="text-slate-400 text-sm">/ {plan.period}</span>
                </div>
                {plan.discountNote && (
                  <p className="text-xs text-emerald-400 mt-2">{plan.discountNote}</p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                className={`w-full ${
                  plan.highlighted
                    ? "bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
                    : "bg-[#162a4a] hover:bg-[#1e3a5f] text-white"
                }`}
              >
                <Link href={plan.href}>
                  {plan.cta}
                </Link>
              </Button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          모든 요금제는 언제든지 해지 가능합니다. 숨겨진 비용이 없습니다.
        </p>
      </div>
    </section>
  )
}
