/**
 * 구독 결제 페이지
 *
 * NICEPayments Server 승인 모델로 첫 결제를 처리하고,
 * 이후 빌링키로 자동 갱신이 가능하다.
 *
 * ── 동작 흐름 ──
 * 1. 나이스 JS SDK 스크립트 로드
 * 2. 사용자가 플랜(월/3개월) 선택
 * 3. (선택) 게임캔버스 할인 코드 입력 → 서버에서 유효성 검증
 * 4. "결제하기" 버튼 클릭 → AUTHNICE.requestPay()로 결제창 표시
 * 5. 인증 성공 → /api/nicepay/callback (POST) → /payment/billing/success (redirect)
 * 6. 인증 실패 → /api/nicepay/callback (POST) → /payment/billing/fail (redirect)
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CreditCard, Loader2, KeyRound, CheckCircle2, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { validateGamecanvasCode } from "@/app/actions/payment"
import { getSubscription } from "@/app/actions/subscription"

declare global {
  interface Window {
    AUTHNICE?: {
      requestPay: (options: Record<string, unknown>) => void
    }
  }
}

const NICEPAY_CLIENT_ID = process.env.NEXT_PUBLIC_NICEPAY_CLIENT_ID ?? ""

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
  const [currentCredits, setCurrentCredits] = useState(0)
  const [showDiscountInput, setShowDiscountInput] = useState(false)
  const [discountCode, setDiscountCode] = useState("")
  const [discountVerified, setDiscountVerified] = useState(false)
  const [discountLoading, setDiscountLoading] = useState(false)
  const [discountError, setDiscountError] = useState("")
  const [sdkReady, setSdkReady] = useState(false)

  const plan = PLANS[selectedPlan]
  const finalAmount = discountVerified && selectedPlan === "monthly" ? 5900 : plan.amount
  const finalPrice = finalAmount.toLocaleString()

  // NICEPayments JS SDK 로드
  useEffect(() => {
    async function initSDK() {
      if (!NICEPAY_CLIENT_ID) {
        setError("결제 시스템 설정 오류입니다. 관리자에게 문의해주세요.")
        return
      }

      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        getSubscription().then(result => {
          if (result.data?.analysis_credits) {
            setCurrentCredits(result.data.analysis_credits)
          }
        })

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
      } catch (err) {
        console.error("[billing] SDK 초기화 에러:", err)
      }
    }

    initSDK()
  }, [])

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

  // 결제 요청
  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      if (!sdkReady || !window.AUTHNICE) {
        setError("결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.")
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

      const orderId = `SUB_${selectedPlan}_${user.id.slice(0, 8)}_${Date.now()}`
      const orderName = selectedPlan === "monthly" ? "디자이닛 월 무제한" : "디자이닛 3개월 무제한"

      // NICEPayments 결제창 호출
      window.AUTHNICE.requestPay({
        clientId: NICEPAY_CLIENT_ID,
        method: "card",
        orderId,
        amount: finalAmount,
        goodsName: orderName,
        returnUrl: `${window.location.origin}/api/nicepay/callback`,
        mallReserved: JSON.stringify({
          type: "billing",
          plan: selectedPlan,
          discountCode: discountVerified ? discountCode : "",
        }),
        buyerName: user.user_metadata?.name || "구매자",
        buyerEmail: user.email || "",
        fnError: (result: { errorCode?: string; errorMsg?: string }) => {
          setError(result.errorMsg || "결제 처리 중 오류가 발생했습니다.")
          setLoading(false)
        },
      })
    } catch (err: unknown) {
      console.error("[billing] 결제 에러:", err)
      const message = err instanceof Error ? err.message : "결제 처리 중 문제가 발생했습니다."
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
        <p className="text-slate-400 mb-8">카드로 결제하고 구독을 시작하세요.</p>

        {/* 플랜 선택 */}
        <div className="space-y-3 mb-6">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedPlan(key)
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

        {/* 게임캔버스 할인코드 */}
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

        {currentCredits > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-400">
              현재 {currentCredits}회의 크레딧을 보유하고 있습니다.
              구독 시작 후에도 보유 회차를 먼저 소모한 뒤 구독이 적용됩니다.
            </p>
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
          onClick={handlePayment}
          disabled={loading || !sdkReady}
          className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CreditCard className="w-5 h-5 mr-2" />
          )}
          {loading ? "처리 중..." : !sdkReady ? "결제 모듈 로딩 중..." : `${finalPrice}원 결제하기`}
        </Button>

        <p className="text-xs text-slate-500 text-center mt-4">
          결제 후 즉시 구독이 시작됩니다.
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
