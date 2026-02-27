"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, GraduationCap, Lock, BookOpen, Users } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { checkTutoringAccess, createTutoringOrder } from "@/app/actions/tutoring"
import { createClient } from "@/lib/supabase/client"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

const PACKAGES = [
  {
    key: "tutoring_4",
    name: "1:1 컨설팅 (4회)",
    price: 480000,
    originalPrice: null as number | null,
    description: "타임당 12만원 × 4회 = 총 48만원",
    details: ["포트폴리오 심층 리뷰", "실무 노하우 전수", "질의응답 무제한", "4회 맞춤 커리큘럼 제공"],
    icon: BookOpen,
  },
  {
    key: "tutoring_12",
    name: "1:1 컨설팅 (12회)",
    price: 1296000,
    originalPrice: 1440000,
    description: "타임당 12만원 × 12회, 10% 할인 적용",
    details: ["포트폴리오 심층 리뷰", "실무 노하우 전수", "질의응답 무제한", "12회 맞춤 커리큘럼 제공", "10% 할인 적용"],
    icon: BookOpen,
    badge: "10% 할인",
  },
  {
    key: "group_tutoring",
    name: "그룹 컨설팅 (4주)",
    price: 360000,
    originalPrice: null as number | null,
    description: "주 1회 × 4주, 타임당 9만원",
    details: ["소규모 그룹 (2~4인)", "참여자 간 피드백 교류", "합리적인 가격의 컨설팅", "4주 맞춤 커리큘럼"],
    icon: Users,
  },
]

export default function TutoringPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <TutoringContent />
    </Suspense>
  )
}

function TutoringContent() {
  const searchParams = useSearchParams()
  const [accessChecked, setAccessChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [accessError, setAccessError] = useState("")

  // 결제 상태
  const [selectedPackage, setSelectedPackage] = useState<string>("tutoring_4")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // URL 파라미터로 패키지 선택
  useEffect(() => {
    const pkgParam = searchParams.get("package")
    if (pkgParam && PACKAGES.some(p => p.key === pkgParam)) {
      setSelectedPackage(pkgParam)
    }
  }, [searchParams])

  // 접근 권한 확인 (로그인만)
  useEffect(() => {
    async function check() {
      const result = await checkTutoringAccess()
      setIsLoggedIn(result.allowed)
      if (!result.allowed) setAccessError(result.error || "로그인이 필요합니다.")
      setAccessChecked(true)
    }
    check()
  }, [])

  const pkg = PACKAGES.find(p => p.key === selectedPackage) || PACKAGES[0]

  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError("로그인이 필요합니다.")
        setLoading(false)
        return
      }

      // 주문 생성
      const orderResult = await createTutoringOrder(selectedPackage, pkg.price)
      if (orderResult.error) {
        setError(orderResult.error)
        setLoading(false)
        return
      }

      const customerKey = `cust_${user.id.replace(/-/g, "").slice(0, 20)}`
      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = tossPayments.payment({ customerKey })

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: pkg.price },
        orderId: orderResult.orderId!,
        orderName: pkg.name,
        successUrl: `${window.location.origin}/payment/tutoring/success`,
        failUrl: `${window.location.origin}/payment/billing/fail`,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "결제 중 오류가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  // 로딩
  if (!accessChecked) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

  // 비로그인
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <Lock className="w-16 h-16 text-slate-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">로그인이 필요합니다</h1>
          <p className="text-slate-400 mb-6">{accessError}</p>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <Link href="/login?redirect=/tutoring">로그인하기</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-lg mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-[#5B8DEF]" />
          <h1 className="text-2xl font-bold text-white">1:1 컨설팅</h1>
        </div>
        <p className="text-slate-400 mb-8">게임 업계 11년차 현업 기획자의 1:1 맞춤 컨설팅</p>

        {/* 상품 선택 */}
        <div className="space-y-4 mb-8">
          {PACKAGES.map(p => {
            const Icon = p.icon
            return (
              <button
                key={p.key}
                onClick={() => {
                  setSelectedPackage(p.key)
                  setError("")
                }}
                className={`w-full p-5 rounded-xl border text-left transition-all ${
                  selectedPackage === p.key
                    ? "border-[#5B8DEF] bg-[#5B8DEF]/10"
                    : "border-[#1e3a5f] bg-slate-800/50 hover:border-[#5B8DEF]/50"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                    selectedPackage === p.key ? "bg-[#5B8DEF]/20" : "bg-slate-700/50"
                  }`}>
                    <Icon className={`w-6 h-6 ${selectedPackage === p.key ? "text-[#5B8DEF]" : "text-slate-400"}`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <p className="text-white font-semibold">{p.name}</p>
                        {"badge" in p && p.badge && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-[#5B8DEF]/20 text-[#5B8DEF] font-medium">
                            {p.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        {p.originalPrice && (
                          <p className="text-xs text-slate-500 line-through">{p.originalPrice.toLocaleString()}원</p>
                        )}
                        <p className="text-white font-bold text-lg">{p.price.toLocaleString()}<span className="text-sm text-slate-400">원</span></p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-400 mb-3">{p.description}</p>
                    <ul className="space-y-1">
                      {p.details.map((d, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full bg-[#5B8DEF] shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={loading}
          className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
        >
          {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
          {pkg.price.toLocaleString()}원 결제하기
        </Button>

        {/* 환불규정 안내 */}
        <div className="mt-8 bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">컨설팅 환불규정 안내</h3>
          <ul className="space-y-1.5 text-xs text-slate-400">
            <li>• 잔여 회차 기준으로 환불됩니다.</li>
            <li>• 등록일로부터 <span className="text-slate-300 font-medium">4주 이내</span> 모든 회차를 소진해야 합니다.</li>
            <li>• 4주 종료 후 <span className="text-slate-300 font-medium">2주 서비스 연장</span>이 무료 제공되나, 연장 기간 중 환불은 불가합니다.</li>
            <li>• 강사 사정으로 수업이 미진행된 경우 <span className="text-slate-300 font-medium">무료 자동 연장</span>됩니다.</li>
          </ul>
          <Link
            href="/refund-policy"
            className="inline-block mt-3 text-xs text-[#5B8DEF] hover:underline"
          >
            전체 환불규정 보기 →
          </Link>
        </div>

        {/* 안내 */}
        <div className="mt-4 text-center space-y-1">
          <p className="text-xs text-slate-500">결제 후 카카오톡으로 일정을 안내드립니다.</p>
          <p className="text-xs text-slate-600">
            문의:{" "}
            <a href="http://pf.kakao.com/_bXgIX" target="_blank" rel="noopener noreferrer" className="text-[#5B8DEF] hover:underline">
              카카오톡 상담
            </a>
          </p>
        </div>
      </div>
    </main>
  )
}
