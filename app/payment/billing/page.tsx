"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CreditCard, Loader2 } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "test_ck_4vZnjEJeQVxJzDoab4d8PmOoBN0k"

const PLANS = {
  monthly: { name: "월 구독", price: "17,900", amount: 17900, period: "월", description: "무제한 분석 + 버전 비교 + Claude Sonnet" },
  three_month: { name: "3개월 패스", price: "49,000", amount: 49000, period: "3개월", description: "무제한 분석 + 버전 비교 + 프리미엄 Claude Opus" },
} as const

function BillingContent() {
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan") as keyof typeof PLANS | null
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>(planParam && PLANS[planParam] ? planParam : "monthly")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const plan = PLANS[selectedPlan]

  async function handleBillingAuth() {
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

      const customerKey = `cust_${user.id.replace(/-/g, "").slice(0, 20)}`

      const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
      const payment = tossPayments.payment({ customerKey })

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl: `${window.location.origin}/payment/billing/success?plan=${selectedPlan}`,
        failUrl: `${window.location.origin}/payment/billing/fail`,
        customerEmail: user.email || "",
        customerName: user.user_metadata?.name || "구매자",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "결제 요청 중 오류가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-lg mx-auto px-6 py-16">
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          요금제로 돌아가기
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">구독 결제</h1>
        <p className="text-slate-400 mb-8">카드를 등록하고 구독을 시작하세요.</p>

        {/* 플랜 선택 */}
        <div className="space-y-3 mb-8">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => setSelectedPlan(key)}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                selectedPlan === key
                  ? "border-[#5B8DEF] bg-[#5B8DEF]/10"
                  : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{p.name}</p>
                  <p className="text-sm text-slate-400">{p.amount.toLocaleString()}원 / {p.period}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{p.description}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === key ? "border-[#5B8DEF]" : "border-slate-600"
                }`}>
                  {selectedPlan === key && <div className="w-2.5 h-2.5 rounded-full bg-[#5B8DEF]" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 결제 요약 */}
        <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">상품</span>
            <span className="text-white font-medium">{plan.name}</span>
          </div>
          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <span className="text-white font-semibold">결제 금액</span>
            <span className="text-xl font-bold text-white">{plan.price}원</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        <Button
          onClick={handleBillingAuth}
          disabled={loading}
          className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CreditCard className="w-5 h-5 mr-2" />
          )}
          {loading ? "처리 중..." : "카드 등록하기"}
        </Button>

        <p className="text-xs text-slate-500 text-center mt-4">
          카드를 등록하면 즉시 첫 결제가 진행됩니다.
          <br />
          구독은 언제든지 해지할 수 있습니다.
        </p>
      </div>
    </main>
  )
}

export default function BillingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <BillingContent />
    </Suspense>
  )
}
