import Link from "next/link"
import { ArrowLeft, Check, Sparkles, Shield, Clock, Zap, GraduationCap, BookOpen, Users } from "lucide-react"
import { Button } from "@/components/ui/button"

export const metadata = {
  title: "요금제 | 디자이닛(DesignIt)",
  description: "디자이닛(DesignIt) 요금제 안내. 월 구독 17,900원, 3개월 패스 49,000원. 1:1 컨설팅, 그룹 컨설팅.",
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

        {/* 1:1 컨설팅 섹션 */}
        <div className="mb-16">
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-3">
              <GraduationCap className="w-6 h-6 text-[#5B8DEF]" />
              <h2 className="text-2xl font-bold text-white">1:1 컨설팅</h2>
            </div>
            <p className="text-slate-400">
              게임 업계 11년차 현업 기획자의 맞춤 컨설팅
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {/* 4회 컨설팅 */}
            <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300">
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-[#5B8DEF]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">1:1 컨설팅 (4회)</h3>
                <p className="text-sm text-slate-400">타임당 12만원 x 4회</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">480,000</span>
                  <span className="text-slate-400">원</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {["포트폴리오 심층 리뷰", "실무 노하우 전수", "질의응답 무제한", "4회 맞춤 커리큘럼 제공"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#162a4a] hover:bg-[#1e3a5f] text-white">
                <Link href="/tutoring?package=tutoring_4">신청하기</Link>
              </Button>
            </div>

            {/* 12회 컨설팅 (10% 할인) */}
            <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-[#5B8DEF] shadow-lg shadow-[#5B8DEF]/10 scale-[1.02] transition-all duration-300">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#5B8DEF] text-white text-xs font-medium">
                  <Sparkles className="w-3 h-3" />
                  10% 할인
                </span>
              </div>
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-[#5B8DEF]/20 flex items-center justify-center mb-4">
                  <BookOpen className="w-6 h-6 text-[#5B8DEF]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">1:1 컨설팅 (12회)</h3>
                <p className="text-sm text-slate-400">타임당 12만원 x 12회, 10% 할인 적용</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg text-slate-500 line-through mr-2">1,440,000원</span>
                  <span className="text-4xl font-bold text-white">1,296,000</span>
                  <span className="text-slate-400">원</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {["포트폴리오 심층 리뷰", "실무 노하우 전수", "질의응답 무제한", "12회 맞춤 커리큘럼 제공", "10% 할인 적용"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                <Link href="/tutoring?package=tutoring_12">신청하기</Link>
              </Button>
            </div>

            {/* 그룹 컨설팅 */}
            <div className="relative bg-slate-900/80 rounded-2xl p-8 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-all duration-300">
              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-[#5B8DEF]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">그룹 컨설팅 (4주)</h3>
                <p className="text-sm text-slate-400">주 1회 × 4주, 타임당 9만원</p>
              </div>
              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-white">360,000</span>
                  <span className="text-slate-400">원</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {["소규모 그룹 (2~4인)", "참여자 간 피드백 교류", "합리적인 가격의 컨설팅", "4주 맞춤 커리큘럼"].map((f, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-[#5B8DEF] mt-0.5 shrink-0" />
                    <span className="text-slate-400">{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="w-full bg-[#162a4a] hover:bg-[#1e3a5f] text-white">
                <Link href="/tutoring?package=group_tutoring">신청하기</Link>
              </Button>
            </div>
          </div>
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
