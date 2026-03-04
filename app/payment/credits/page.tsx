/**
 * 크레딧(회차권) 결제 페이지
 *
 * 경로: /payment/credits?package=credit_1|credit_5|credit_10
 *
 * 흐름:
 * 1. 로그인 확인 → 패키지 선택 (1회/5회/10회)
 * 2. "결제하기" 클릭 → createCreditOrder()로 서버에 주문 생성
 * 3. TossPayments 일반결제로 카드 결제
 * 4. 결제 완료 → /payment/credits/success로 이동
 *
 * 금액은 서버(payment.ts CREDIT_PRICES)에서 결정하며,
 * 클라이언트 PACKAGES는 UI 표시용만 담당.
 *
 * SDK 초기화: useEffect에서 미리 로드 (공식 문서 권장 패턴)
 * 결제 요청: 버튼 클릭 시 requestPayment만 호출
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Lock, Zap } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { createCreditOrder } from "@/app/actions/payment"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

// UI 표시용 패키지 정보 (실제 결제 금액은 서버 CREDIT_PRICES에서 결정)
const PACKAGES = [
  {
    key: "credit_1",
    name: "1회권",
    credits: 1,
    price: 2900,
    perCredit: "2,900",
    badge: null as string | null,
  },
  {
    key: "credit_5",
    name: "5회권",
    credits: 5,
    price: 7900,
    perCredit: "1,580",
    badge: "45% 할인",
  },
  {
    key: "credit_10",
    name: "10회권",
    credits: 10,
    price: 12900,
    perCredit: "1,290",
    badge: "55% 할인",
  },
]

export default function CreditsPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <CreditsContent />
    </Suspense>
  )
}

function CreditsContent() {
  const searchParams = useSearchParams()
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [selectedPackage, setSelectedPackage] = useState("credit_1")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // TossPayments SDK 인스턴스 (useEffect에서 미리 초기화)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payment, setPayment] = useState<any>(null)

  useEffect(() => {
    const pkgParam = searchParams.get("package")
    if (pkgParam && PACKAGES.some(p => p.key === pkgParam)) {
      setSelectedPackage(pkgParam)
    }
  }, [searchParams])

  // SDK 초기화 + 로그인 확인 (공식 문서 권장: 컴포넌트 마운트 시 미리 로드)
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)

      if (!user || !TOSS_CLIENT_KEY) return

      try {
        const customerKey = `cust_${user.id.replace(/-/g, "").slice(0, 20)}`
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
        const paymentInstance = tossPayments.payment({ customerKey })
        setPayment(paymentInstance)
      } catch (err) {
        console.error("[credits] SDK 초기화 에러:", err)
      }
    }
    init()
  }, [])

  const pkg = PACKAGES.find(p => p.key === selectedPackage) || PACKAGES[0]

  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      if (!payment) {
        setError("결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.")
        setLoading(false)
        return
      }

      // 주문 생성 (금액은 서버에서 결정)
      const orderResult = await createCreditOrder(selectedPackage)
      if (orderResult.error) {
        setError(orderResult.error)
        setLoading(false)
        return
      }

      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: orderResult.amount! },
        orderId: orderResult.orderId!,
        orderName: `디자이닛 분석 ${pkg.name}`,
        successUrl: `${window.location.origin}/payment/credits/success`,
        failUrl: `${window.location.origin}/payment/credits/fail`,
      })
    } catch (err: unknown) {
      console.error("[credits] 결제 에러:", err)
      const detail = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`결제 에러: ${detail}`)
      setLoading(false)
    }
  }

  // 로딩
  if (isLoggedIn === null) {
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
          <p className="text-slate-400 mb-6">크레딧 구매를 위해 로그인해 주세요.</p>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <Link href="/login?redirect=/payment/credits">로그인하기</Link>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* 헤더 */}
        <Link href="/pricing" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> 가격표로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">분석 크레딧 구매</h1>
        <p className="text-slate-400 mb-8">필요한 만큼만 구매하세요. 크레딧은 만료되지 않습니다.</p>

        {/* 패키지 선택 */}
        <div className="space-y-3 mb-8">
          {PACKAGES.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelectedPackage(p.key)}
              className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                selectedPackage === p.key
                  ? "border-[#5B8DEF] bg-[#5B8DEF]/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-bold text-lg">{p.name}</span>
                    {p.badge && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">회당 {p.perCredit}원</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-xl">{p.price.toLocaleString()}원</p>
                  <p className="text-slate-500 text-sm">{p.credits}회 분석</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 월 구독 안내 */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 mb-8">
          <p className="text-slate-400 text-sm">
            <Zap className="w-4 h-4 inline text-amber-400 mr-1" />
            10회 이상 사용한다면?{" "}
            <Link href="/payment/billing?plan=monthly" className="text-[#5B8DEF] hover:underline">
              월 13,900원 무제한 구독
            </Link>
            이 더 합리적이에요.
          </p>
        </div>

        {/* 결제 버튼 */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={loading || !payment}
          className="w-full py-6 text-lg bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 준비 중...</>
          ) : !payment ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 모듈 로딩 중...</>
          ) : (
            <>{pkg.price.toLocaleString()}원 결제하기</>
          )}
        </Button>
      </div>
    </main>
  )
}
