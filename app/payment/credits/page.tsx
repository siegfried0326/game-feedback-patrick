/**
 * 크레딧 결제 페이지
 *
 * NICEPayments Server 승인 모델로 결제 처리.
 *
 * ── 동작 흐름 ──
 * 1. 로그인 확인
 * 2. 나이스 JS SDK 스크립트 로드
 * 3. 사용자가 패키지 선택 (1/5/10크레딧)
 * 4. "결제하기" 버튼 클릭
 *    → createCreditOrder()로 서버에 주문 생성
 *    → AUTHNICE.requestPay()로 나이스 결제창 표시
 * 5. 인증 성공 → /api/nicepay/callback (POST) → /payment/credits/success (redirect)
 * 6. 인증 실패 → /api/nicepay/callback (POST) → /payment/credits/fail (redirect)
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Lock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { createCreditOrder } from "@/app/actions/payment"

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (options: Record<string, unknown>) => void
    }
  }
}

const NICEPAY_CLIENT_ID = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID ?? ""

const PACKAGES = [
  {
    key: "credit_1",
    name: "1크레딧",
    credits: 1,
    price: 2900,
    perCredit: "2,900",
    badge: null as string | null,
  },
  {
    key: "credit_5",
    name: "5크레딧",
    credits: 5,
    price: 7900,
    perCredit: "1,580",
    badge: "45% 할인",
  },
  {
    key: "credit_10",
    name: "10크레딧",
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
  const [sdkReady, setSdkReady] = useState(false)

  useEffect(() => {
    const pkgParam = searchParams.get("package")
    if (pkgParam && PACKAGES.some(p => p.key === pkgParam)) {
      setSelectedPackage(pkgParam)
    }
  }, [searchParams])

  // 로그인 확인 + NICEPayments JS SDK 로드
  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user)
      if (!user) return

      console.log("[credits] clientId:", NICEPAY_CLIENT_ID || "(비어있음)")

      // NICEPayments JS SDK 스크립트 로드
      if (!document.querySelector('script[src*="nicepay.co.kr"]')) {
        const script = document.createElement("script")
        script.src = "https://pay.nicepay.co.kr/v1/js/"
        script.onload = () => setSdkReady(true)
        script.onerror = () => setError("결제 모듈을 불러오지 못했습니다.")
        document.head.appendChild(script)
      } else {
        setSdkReady(true)
      }
    }
    init()
  }, [])

  const pkg = PACKAGES.find(p => p.key === selectedPackage) || PACKAGES[0]

  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      if (!sdkReady || !window.AUTHNICE) {
        setError("결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.")
        setLoading(false)
        return
      }

      // 서버에 주문 생성 요청 (금액은 서버에서 결정)
      const orderResult = await createCreditOrder(selectedPackage)
      if (orderResult.error) {
        setError(orderResult.error)
        setLoading(false)
        return
      }

      // NICEPayments 결제창 호출 (Server 승인 모델)
      window.AUTHNICE.requestPay({
        clientId: NICEPAY_CLIENT_ID,
        method: "card",
        orderId: orderResult.orderId!,
        amount: orderResult.amount!,
        goodsName: `아카이브 187 분석 ${pkg.name}`,
        returnUrl: `${window.location.origin}/api/nicepay/callback`,
        mallReserved: JSON.stringify({ type: "credits" }),
        fnError: (result: { errorCode?: string; errorMsg?: string }) => {
          setError(result.errorMsg || "결제 처리 중 오류가 발생했습니다.")
          setLoading(false)
        },
      })
    } catch (err: unknown) {
      console.error("[credits] 결제 에러:", err)
      const message = err instanceof Error ? err.message : "결제 처리 중 문제가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  if (isLoggedIn === null) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

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
        <Link href="/pricing" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> 가격표로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">분석 크레딧 구매</h1>
        <p className="text-slate-400 mb-8">필요한 만큼만 구매하세요. 크레딧은 만료되지 않습니다.</p>

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
                  <p className="text-slate-400 text-sm mt-1">크레딧당 {p.perCredit}원</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-xl">{p.price.toLocaleString()}원</p>
                  <p className="text-slate-500 text-sm">{p.credits}크레딧</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 mb-8">
          <p className="text-slate-400 text-sm">
            <Zap className="w-4 h-4 inline text-amber-400 mr-1" />
            10회 이상 사용한다면?{" "}
            <Link href="/payment/billing?plan=monthly" className="text-[#5B8DEF] hover:underline">
              월 13,800원 무제한 구독
            </Link>
            이 더 합리적이에요.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        <Button
          onClick={handlePayment}
          disabled={loading || !sdkReady}
          className="w-full py-6 text-lg bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 준비 중...</>
          ) : !sdkReady ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 모듈 로딩 중...</>
          ) : (
            <>{pkg.price.toLocaleString()}원 결제하기</>
          )}
        </Button>
      </div>
    </main>
  )
}
