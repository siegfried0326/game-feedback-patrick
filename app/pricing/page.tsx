import Link from "next/link"
import { ArrowLeft, Check, Sparkles, Shield, Clock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "요금제 | 디자이닛(DesignIt)",
  description: "디자이닛(DesignIt) 요금제 안내. 월 구독 17,900원, 3개월 패스 49,000원.",
}

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
    description: "처음 이용하시는 분들을 위한 무료 체험 (총 1회)",
    features: [
      "프로젝트 1개",
      "총 1회 문서 분석",
      "5개 항목 점수 평가",
      "기본 피드백 제공",
      "Claude Sonnet AI",
    ],
    cta: "무료로 시작하기",
    href: "/analyze",
    highlighted: false,
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
    highlighted: true,
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
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            합리적인 요금제
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            첫 1회는 무료로 체험해 보세요. 마음에 드시면 구독을 시작하시면 됩니다.
          </p>
        </div>

        {/* 요금제 카드 */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 mb-16">
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
              {plan.highlighted && !plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    추천
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">{plan.name}</h3>
                <p className="text-sm text-slate-400">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  {plan.originalPrice && (
                    <span className="text-lg text-slate-500 line-through mr-2">
                      {plan.originalPrice}원
                    </span>
                  )}
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
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
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* 서비스 상세 설명 */}
        <div className="bg-slate-900/50 rounded-2xl border border-[#1e3a5f] p-8 mb-12">
          <h2 className="text-xl font-bold text-white mb-6">서비스 상세 안내</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <Zap className="w-5 h-5 text-[#5B8DEF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">즉시 결과 제공</h3>
                <p className="text-sm text-slate-400">
                  문서 업로드 후 AI가 즉시 분석하여 결과를 제공합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-[#5B8DEF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">서비스 제공 기간</h3>
                <p className="text-sm text-slate-400">
                  월 구독: 결제일부터 1개월<br />
                  3개월 패스: 결제일부터 3개월
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-[#5B8DEF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-white mb-1">안심 환불</h3>
                <p className="text-sm text-slate-400">
                  미이용 시 7일 이내 전액 환불.{" "}
                  <Link href="/refund-policy" className="text-[#5B8DEF] hover:underline">
                    환불정책 보기
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div className="text-center text-sm text-slate-500 space-y-1">
          <p>모든 요금제는 언제든지 해지 가능합니다. 숨겨진 비용이 없습니다.</p>
          <p>
            결제 관련 문의:{" "}
            <a
              href="https://desk.channel.io/#/channels/227321/team_chats/groups/536162"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#5B8DEF] hover:underline"
            >
              문의하기
            </a>
            {" | "}
            <Link href="/terms" className="text-[#5B8DEF] hover:underline">
              이용약관
            </Link>
            {" | "}
            <Link href="/refund-policy" className="text-[#5B8DEF] hover:underline">
              환불정책
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
