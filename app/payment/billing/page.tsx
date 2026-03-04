/**
 * 구독 결제 페이지 (261줄)
 *
 * TossPayments 빌링 위젯으로 카드 등록 → 자동결제.
 * plan 쿼리 파라미터로 월/3개월 플랜 구분.
 * 게임캔버스 할인 코드 입력 지원 (monthly 플랜만).
 * 라우트: /payment/billing?plan=monthly|three_month
 */
"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CreditCard, Loader2, KeyRound, CheckCircle2, ChevronDown } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { validateGamecanvasCode } from "@/app/actions/payment"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

const PLANS = {
  monthly: { name: "월 무제한", price: "13,900", amount: 13900, period: "월", description: "무제한 분석 + 버전 비교 + Claude Sonnet" },
  three_month: { name: "3개월 무제한", price: "39,000", amount: 39000, period: "3개월", description: "무제한 분석 + 버전 비교 + 프리미엄 Claude Opus" },
} as const

function BillingContent() {
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan") as keyof typeof PLANS | null
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>(planParam && PLANS[planParam] ? planParam : "monthly")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 할인코드 상태
  const [showDiscountInput, setShowDiscountInput] = useState(false)
  const [discountCode, setDiscountCode] = useState("")
  const [discountVerified, setDiscountVerified] = useState(false)
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountError, setDiscountError] = useState("")

  const plan = PLANS[selectedPlan]

  // 할인 적용 시 실제 결제 금액
  const finalAmount = discountVerified && selectedPlan === "monthly" ? 5900 : plan.amount
  const finalPrice = finalAmount.toLocaleString()

  // 할인코드 검증
  async function handleDiscountVerify() {
    if (!discountCode.trim()) return
    setDiscountLoading(true)
    setDiscountError("")

    try {
      const result = await validateGamecanvasCode(discountCode)
      if (result.valid) {
        setDiscountVerified(true)
      } else {
        setDiscountError(result.error || "유효하지 않은 코드입니다.")
      }
    } catch {
      setDiscountError("코드 확인 중 오류가 발생했습니다.")
    } finally {
      setDiscountLoading(false)
    }
  }

  async function handleBillingAuth() {
    setLoading(true)
    setError("")

    try {
      if (!TOSS_CLIENT_KEY) {
        setError("TOSS_CLIENT_KEY가 설정되지 않았습니다. 환경변수를 확인해주세요.")
        setLoading(false)
        return
      }

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

      // 할인코드가 인증되었으면 쿼리에 포함
      let successUrl = `${window.location.origin}/payment/billing/success?plan=${selectedPlan}`
      if (discountVerified && discountCode && selectedPlan === "monthly") {
        successUrl += `&discountCode=${encodeURIComponent(discountCode)}`
      }

      await payment.requestBillingAuth({
        method: "CARD",
        successUrl,
        failUrl: `${window.location.origin}/payment/billing/fail`,
        customerEmail: user.email || "",
        customerName: user.user_metadata?.name || "구매자",
      })
    } catch (err: unknown) {
      console.error("[billing] 결제 에러:", err)
      const detail = err instanceof Error ? err.message : JSON.stringify(err)
      setError(`결제 에러: ${detail}`)
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
        <div className="space-y-3 mb-6">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedPlan(key)
                // 플랜 바꾸면 할인 상태 초기화
                if (key !== "monthly") {
                  setDiscountVerified(false)
                  setShowDiscountInput(false)
                }
              }}
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

        {/* 게임캔버스 할인코드 영역 (monthly일 때만) */}
        {selectedPlan === "monthly" && (
          <div className="mb-6">
            {!discountVerified ? (
              <>
                <button
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="flex items-center gap-2 text-sm text-[#5B8DEF] hover:text-[#4A7CE0] transition-colors mb-3"
                >
                  <KeyRound className="w-4 h-4" />
                  게임캔버스 수강생이신가요?
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDiscountInput ? "rotate-180" : ""}`} />
                </button>

                {showDiscountInput && (
                  <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-4">
                    <p className="text-sm text-slate-400 mb-3">
                      게임캔버스 수강생 할인 코드를 입력하면 월 5,900원에 이용할 수 있습니다.
                    </p>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={discountCode}
                        onChange={e => setDiscountCode(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !discountLoading && handleDiscountVerify()}
                        placeholder="할인 코드 입력"
                        className="flex-1 bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#5B8DEF] uppercase tracking-widest"
                        disabled={discountLoading}
                      />
                      <Button
                        onClick={handleDiscountVerify}
                        disabled={discountLoading || !discountCode.trim()}
                        className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white px-5"
                      >
                        {discountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "확인"}
                      </Button>
                    </div>
                    {discountError && (
                      <p className="text-sm text-red-400">{discountError}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">게임캔버스 할인 적용 (월 5,900원)</span>
              </div>
            )}
          </div>
        )}

        {/* 결제 요약 */}
        <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400">상품</span>
            <span className="text-white font-medium">
              {plan.name}
              {discountVerified && selectedPlan === "monthly" && (
                <span className="ml-2 text-xs text-emerald-400">(게임캔버스)</span>
              )}
            </span>
          </div>
          {discountVerified && selectedPlan === "monthly" && (
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-slate-500">정가</span>
              <span className="text-slate-500 line-through">{plan.price}원</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <span className="text-white font-semibold">결제 금액</span>
            <span className="text-xl font-bold text-white">{finalPrice}원</span>
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
