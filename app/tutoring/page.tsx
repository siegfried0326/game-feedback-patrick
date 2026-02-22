"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, GraduationCap, Lock } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { checkTutoringAccess, createTutoringOrder } from "@/app/actions/tutoring"
import { createClient } from "@/lib/supabase/client"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "test_ck_4vZnjEJeQVxJzDoab4d8PmOoBN0k"

const PACKAGES = [
  { key: "1session", name: "1회 과외", price: 0, description: "1회 1:1 과외 세션" },
  { key: "3sessions", name: "3회 과외", price: 0, description: "3회 1:1 과외 패키지" },
  { key: "5sessions", name: "5회 과외", price: 0, description: "5회 1:1 과외 패키지" },
] as const

export default function TutoringPage() {
  const router = useRouter()
  const [accessChecked, setAccessChecked] = useState(false)
  const [hasAccess, setHasAccess] = useState(false)
  const [accessError, setAccessError] = useState("")
  const [selectedPackage, setSelectedPackage] = useState<string>("1session")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [widgetsReady, setWidgetsReady] = useState(false)
  const [widgetsInstance, setWidgetsInstance] = useState<any>(null)

  // 접근 권한 확인
  useEffect(() => {
    async function check() {
      const result = await checkTutoringAccess()
      setHasAccess(result.allowed)
      if (!result.allowed) setAccessError(result.error || "접근 권한이 없습니다.")
      setAccessChecked(true)
    }
    check()
  }, [])

  const pkg = PACKAGES.find(p => p.key === selectedPackage) || PACKAGES[0]

  async function handlePayment() {
    if (pkg.price <= 0) {
      setError("가격이 아직 설정되지 않았습니다. 관리자에게 문의해주세요.")
      return
    }

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
      const widgets = tossPayments.widgets({ customerKey })

      await widgets.setAmount({ currency: "KRW", value: pkg.price })

      await widgets.renderPaymentMethods({
        selector: "#payment-method",
      })

      await widgets.renderAgreement({
        selector: "#agreement",
      })

      setWidgetsInstance(widgets)
      setWidgetsReady(true)
      setLoading(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "결제 준비 중 오류가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  async function handleRequestPayment() {
    if (!widgetsInstance) return
    setLoading(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      const orderResult = await createTutoringOrder(selectedPackage, pkg.price)
      if (orderResult.error) {
        setError(orderResult.error)
        setLoading(false)
        return
      }

      await widgetsInstance.requestPayment({
        orderId: orderResult.orderId,
        orderName: pkg.name,
        successUrl: `${window.location.origin}/payment/tutoring/success`,
        failUrl: `${window.location.origin}/payment/billing/fail`,
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  if (!accessChecked) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <Lock className="w-16 h-16 text-slate-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">접근 권한이 없습니다</h1>
          <p className="text-slate-400 mb-6">{accessError}</p>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <a href="https://open.kakao.com/o/sLz0kgBf" target="_blank" rel="noopener noreferrer">
              1:1 상담 신청하기
            </a>
          </Button>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-lg mx-auto px-6 py-16">
        <Link
          href="/analyze"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          돌아가기
        </Link>

        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="w-8 h-8 text-[#5B8DEF]" />
          <h1 className="text-2xl font-bold text-white">1:1 과외 결제</h1>
        </div>
        <p className="text-slate-400 mb-8">전문가의 1:1 맞춤 피드백을 받아보세요.</p>

        {/* 패키지 선택 */}
        <div className="space-y-3 mb-8">
          {PACKAGES.map(p => (
            <button
              key={p.key}
              onClick={() => {
                setSelectedPackage(p.key)
                setWidgetsReady(false)
              }}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                selectedPackage === p.key
                  ? "border-[#5B8DEF] bg-[#5B8DEF]/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{p.name}</p>
                  <p className="text-sm text-slate-400">{p.description}</p>
                </div>
                <div className="text-right">
                  {p.price > 0 ? (
                    <p className="text-white font-bold">{p.price.toLocaleString()}원</p>
                  ) : (
                    <p className="text-slate-500 text-sm">가격 미정</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* 결제 위젯 영역 */}
        {widgetsReady && (
          <div className="mb-6">
            <div id="payment-method" className="mb-4" />
            <div id="agreement" />
          </div>
        )}

        {!widgetsReady ? (
          <Button
            onClick={handlePayment}
            disabled={loading || pkg.price <= 0}
            className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
            ) : null}
            {pkg.price > 0 ? `${pkg.price.toLocaleString()}원 결제하기` : "가격 미정"}
          </Button>
        ) : (
          <Button
            onClick={handleRequestPayment}
            disabled={loading}
            className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
            결제하기
          </Button>
        )}
      </div>
    </main>
  )
}
