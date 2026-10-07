/**
 * 요금제 상세 페이지
 *
 * BM 개편(2026-08-05): 과외 중심 모델.
 * - 크레딧 단건 판매 (무료 1회 + 1/10/30크레딧), 40쪽 초과 문서는 40쪽마다 +1크레딧
 * - 1:1 과외 (가격 비공개, 오픈카톡 상담) — 수강생은 매월 크레딧 지급 + 면접·라이브러리 혜택
 * - 구독(월/3개월)은 판매 종료
 * 라우트: /pricing (공개)
 */
import Link from "next/link"
import { LARGE_DOC_NOTICE } from "@/lib/analysis/pages"
import { ArrowLeft, Check, Sparkles, Shield, Clock, Zap, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAYMENTS_ENABLED } from "@/lib/payments-config"
import { TUTORING_KAKAO_URL } from "@/lib/tutoring-config"

export const metadata = {
  title: "요금제 | 문라이트 아카이브",
  description: "문라이트 아카이브 요금제 안내. 첫 1회 무료, 크레딧 3,900원부터. 1:1 과외 상담.",
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
    name: "1크레딧",
    price: "3,900",
    period: "1크레딧",
    description: "필요할 때 한 번만",
    perCredit: null as string | null,
    features: ["기본 분석 1회 (정밀 분석은 2크레딧)", "직군별 채점표 15개 항목", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_1",
  },
  {
    name: "10크레딧",
    price: "19,900",
    period: "10크레딧",
    description: "크레딧당 1,990원 (49% 할인)",
    badge: "49% 할인",
    features: ["기본 분석 10회 또는 정밀 분석 5회", "직군별 채점표 15개 항목", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_10",
  },
  {
    name: "30크레딧",
    price: "44,900",
    period: "30크레딧",
    description: "크레딧당 1,497원 (62% 할인)",
    badge: "62% 할인",
    features: ["기본 분석 30회 또는 정밀 분석 15회", "직군별 채점표 15개 항목", "상세 코멘트 제공"],
    cta: "구매하기",
    href: "/payment/credits?package=credit_30",
  },
]

const tutoringBenefits = [
  "11년차 현업 게임 기획자의 1:1 맞춤 지도",
  "포트폴리오 기획·구성부터 완성까지 직접 피드백",
  "수강 기간 중 매월 AI 분석 크레딧 지급",
  "면접 연습 모드 이용 (600문항 + AI 평가)",
  "게임 디자인 라이브러리 이용 (1,200+ 자료)",
  "수강료·커리큘럼은 상담으로 안내",
]

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-secondary">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-black text-foreground mb-4">
            합리적인 요금제
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            첫 1회는 무료! 필요한 만큼 크레딧을 구매하고,
            더 깊은 피드백이 필요하다면 1:1 과외로 함께하세요.
          </p>
        </div>

        {/* 크레딧 */}
        <h2 className="text-xl font-black text-foreground mb-4">크레딧</h2>
        <p className="text-muted-foreground text-sm mb-6">크레딧은 만료되지 않습니다. 필요할 때 사용하세요. {LARGE_DOC_NOTICE}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
          {creditPlans.map((plan, index) => (
            <div
              key={index}
              className="relative bg-card rounded-2xl p-6 border border-border hover:border-primary/30 transition-all duration-300"
            >
              {"badge" in plan && plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold text-foreground mb-1">{plan.name}</h3>
                <p className="text-xs text-muted-foreground">{plan.description}</p>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">원</span>
                </div>
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {!PAYMENTS_ENABLED && plan.href.startsWith("/payment/") ? (
                <Button disabled className="w-full bg-secondary text-muted-foreground opacity-60 cursor-not-allowed">
                  결제 준비 중
                </Button>
              ) : (
                <Button asChild className="w-full bg-secondary hover:bg-border text-foreground">
                  <Link href={plan.href}>{plan.cta}</Link>
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* 1:1 과외 */}
        <h2 className="text-xl font-black text-foreground mb-4">1:1 과외</h2>
        <p className="text-muted-foreground text-sm mb-6">
          AI 피드백을 넘어, 187개 합격 포트폴리오를 만든 현업 기획자가 직접 지도합니다.
        </p>
        <div className="relative bg-card rounded-2xl p-8 border border-foreground/80 shadow-lg shadow-black/5 mb-16">
          <div className="absolute -top-3 left-8">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-brand-ink text-white text-xs font-bold">
              <Sparkles className="w-3 h-3" />
              수강생 전용 혜택 포함
            </span>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">게임 기획 1:1 과외</h3>
              <p className="text-sm text-primary mb-4">수강료는 목표·기간에 맞춰 상담 후 안내드립니다.</p>
              <ul className="space-y-3">
                {tutoringBenefits.map((benefit, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-foreground/80">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-4">
                포트폴리오 상태를 알고 계신가요?<br />
                무료 분석 결과를 들고 오시면 상담이 더 정확해집니다.
              </p>
              <Button asChild size="lg" className="bg-brand-ink hover:bg-black/85 text-white w-full md:w-auto px-8">
                <a href={TUTORING_KAKAO_URL} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-5 h-5 mr-2" />
                  오픈카톡으로 상담하기
                </a>
              </Button>
              <p className="text-xs text-muted-foreground mt-3">부담 없이 문의하세요. 상담은 무료입니다.</p>
            </div>
          </div>
        </div>

        <p className="text-muted-foreground text-xs mb-10">
          * 과외 수강생에게는 수강 기간 중 매월 분석 크레딧이 지급되며, 별도 결제가 필요하지 않습니다.
        </p>

        {/* 서비스 상세 설명 */}
        <div className="bg-card rounded-2xl border border-border p-8 mb-12">
          <h2 className="text-xl font-black text-foreground mb-6">서비스 상세 안내</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex gap-3">
              <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-1">즉시 결과 제공</h3>
                <p className="text-sm text-muted-foreground">
                  문서 업로드 후 AI가 즉시 분석하여 결과를 제공합니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-1">서비스 제공 기간</h3>
                <p className="text-sm text-muted-foreground">
                  크레딧: 만료 없음<br />
                  과외 수강생 지급 크레딧: 수강 기간 중 매월 지급
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground mb-1">안심 환불</h3>
                <p className="text-sm text-muted-foreground">
                  미이용 시 7일 이내 전액 환불.{" "}
                  <Link href="/refund-policy" className="text-primary hover:underline">
                    환불정책 보기
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 안내 */}
        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>숨겨진 비용이 없습니다. 크레딧은 사용한 만큼만.</p>
          <p>
            결제 관련 문의:{" "}
            <a
              href="http://pf.kakao.com/_bXgIX"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              문의하기
            </a>
            {" | "}
            <Link href="/terms" className="text-primary hover:underline">
              이용약관
            </Link>
            {" | "}
            <Link href="/refund-policy" className="text-primary hover:underline">
              환불정책
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
