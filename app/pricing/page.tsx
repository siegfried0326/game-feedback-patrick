/**
 * 요금제 상세 페이지
 *
 * 전체 요금제 비교 (무료/회차권/월구독/3개월).
 * PricingSection 컴포넌트와 유사하나 독립 페이지로 더 상세한 정보 포함.
 * 라우트: /pricing (공개)
 */
import Link from "next/link"
import { ArrowLeft, Check, Sparkles, Shield, Clock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "요금제 | 디자이닛(DesignIt)",
  description: "디자이닛(DesignIt) 요금제 안내. 1회 2,900원부터. 월 무제한 13,800원.",
}

const creditPlans = [
  {
    name: "무료 체험",
    price: "0",
    period: "1회",
    description: "처음 이용하시는 분들을 위한 무료 체험",
    features: ["1회 무료 분석", "15개 항목 점수 평가", "기본 피드백 제공"],
    cta: "무료로 시작하기",
    href: "/analyze",
  },
  {
    name: "1회권",
    price: "2,900",
    period: "1회",
    description: "필요할 때 한 번만",
    perCredit: null as string | null,
    features: ["1회 분석", "15개 항목 점수 평가", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_1",
  },
  {
    name: "5회권",
    price: "7,900",
    period: "5회",
    description: "회당 1,580원 (45% 할인)",
    badge: "45% 할인",
    features: ["5회 분석", "15개 항목 점수 평가", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_5",
  },
  {
    name: "10회권",
    price: "12,900",
    period: "10회",
    description: "회당 1,290원 (55% 할인)",
    badge: "55% 할인",
    features: ["10회 분석", "15개 항목 점수 평가", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_10",
  },
]

const subscriptionPlans = [
  {
    name: "월 무제한",
    price: "13,800",
    period: "월",
    description: "집중적인 포트폴리오 준비에 최적",
    features: [
      "무제한 분석",
      "무제한 프로젝트",
      "상세 코멘트 제공",
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
      "상세 코멘트 제공",
      "포지션별 맞춤 피드백",
      "버전별 점수 비교 분석",
      "프리미엄 AI (Claude Opus)",
    ],
    cta: "3개월 구매",
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
            첫 1회는 무료! 필요한 만큼 크레딧을 구매하거나, 무제한 구독을 시작하세요.
          </p>
        </div>

        {/* 크레딧 (회차권) */}
        <h2 className="text-xl font-bold text-white mb-4">회차권</h2>
        <p className="text-slate-400 text-sm mb-6">크레딧은 만료되지 않습니다. 필요할 때 사용하세요.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {creditPlans.map((plan, index) => (
            <div
              key={index}
              className="relative bg-slate-900/80 rounded-2xl p-6 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300"
            >
              {"badge" in plan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/90 text-white text-xs font-medium">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-white mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400">{plan.description}</p>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400">원</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-slate-400">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button asChild className="w-full bg-[#162a4a] hover:bg-[#1e3a5f] text-white">
                <Link href={plan.href}>{plan.cta}</Link>
              </Button>
            </div>
          ))}
        </div>

        {/* 무제한 구독 */}
        <h2 className="text-xl font-bold text-white mb-4">무제한 구독</h2>
        <p className="text-slate-400 text-sm mb-6">매일 분석한다면 구독이 훨씬 합리적이에요.</p>
        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 mb-16">
          {subscriptionPlans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-slate-900/80 rounded-2xl p-8 border transition-all duration-300 ${
                plan.highlighted
                  ? "border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10"
                  : "border-[#1e3a5f] hover:border-[#5B8DEF]/30"
              }`}
            >
              {"badge" in plan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                    <Sparkles className="w-3 h-3" />
                    {plan.badge}
                  </span>
                </div>
              )}
              {plan.highlighted && !("badge" in plan && plan.badge) && (
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
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  <span className="text-slate-400">원</span>
                  <span className="text-slate-400 text-sm">/ {plan.period}</span>
                </div>
                {"discountNote" in plan && plan.discountNote && (
                  <p className="text-xs text-emerald-400 mt-2">{plan.discountNote}</p>
                )}
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
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

        <p className="text-slate-500 text-xs mb-10">
          * 회차권을 보유한 상태에서 구독 시, 보유 회차를 먼저 소모한 뒤 구독이 적용됩니다.
        </p>

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
                  회차권: 만료 없음<br />
                  월 구독: 결제일부터 1개월<br />
                  3개월: 결제일부터 3개월
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
              href="http://pf.kakao.com/_bXgIX"
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
