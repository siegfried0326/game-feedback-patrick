/**
 * 구독 결제 페이지 — 빌링키 자동갱신 방식
 *
 * ── 동작 흐름 ──
 * 1. 사용자가 플랜(월/3개월) 선택
 * 2. 카드 정보 입력 (카드번호, 유효기간, 비밀번호 앞 2자리, 생년월일 6자리)
 * 3. "구독 시작하기" 클릭 → /api/nicepay/billing/register POST
 * 4. 서버: AES 암호화 → 빌링키 발급 → 첫 결제 → DB 저장
 * 5. 성공 시 분석 페이지로 이동 (이후 매월/3개월 Cron 자동 갱신)
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CheckCircle, CreditCard, Eye, EyeOff, Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { getSubscription } from "@/app/actions/subscription"

const PLANS = {
  monthly:     { name: "월 무제한",    price: "13,800", amount: 13800, period: "월",    description: "무제한 분석 + 버전 비교 + Claude Sonnet" },
  three_month: { name: "3개월 무제한", price: "39,000", amount: 39000, period: "3개월", description: "🏆 Claude Opus 탑재 — 월 구독 대비 더 심층적인 분석 제공" },
} as const

function formatCardNumber(val: string) {
  return val.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim()
}

function BillingContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const planParam = searchParams.get("plan") as keyof typeof PLANS | null

  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>(
    planParam && PLANS[planParam] ? planParam : "monthly"
  )
  const [currentCredits, setCurrentCredits] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // 카드 입력값
  const [cardNo, setCardNo]   = useState("")
  const [expMonth, setExpMonth] = useState("")
  const [expYear, setExpYear]   = useState("")
  const [cardPw, setCardPw]   = useState("")
  const [idNo, setIdNo]       = useState("")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push("/login?redirect=/payment/billing")
    })
    getSubscription().then(r => {
      if (r.data?.analysis_credits) setCurrentCredits(r.data.analysis_credits)
    })
  }, [router])

  const plan = PLANS[selectedPlan]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const cardNoClean = cardNo.replace(/\s/g, "")

    try {
      const res = await fetch("/api/nicepay/billing/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardNo: cardNoClean,
          expYear,
          expMonth,
          idNo,
          cardPw,
          plan: selectedPlan,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || "결제 처리 중 오류가 발생했습니다.")
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => router.push("/analyze"), 3000)
    } catch {
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">구독이 시작되었습니다!</h1>
          <p className="text-slate-400 mb-6">
            {selectedPlan === "three_month"
              ? "이제 프리미엄 Claude Opus AI로 더 정밀한 분석을 받으실 수 있습니다."
              : "이제 무제한 분석과 버전 비교 기능을 이용하실 수 있습니다."}
            <br />
            매월 자동으로 갱신됩니다. 잠시 후 분석 페이지로 이동합니다.
          </p>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <Link href="/analyze">분석하러 가기</Link>
          </Button>
        </div>
      </main>
    )
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
        <p className="text-slate-400 mb-8">카드를 등록하면 매월 자동으로 갱신됩니다.</p>

        {/* 플랜 선택 */}
        <div className="space-y-3 mb-6">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedPlan(key)}
              className={`w-full p-4 rounded-xl border text-left transition-all ${
                selectedPlan === key
                  ? key === "three_month"
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-[#5B8DEF] bg-[#5B8DEF]/10"
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
                  selectedPlan === key
                    ? key === "three_month" ? "border-amber-500" : "border-[#5B8DEF]"
                    : "border-slate-600"
                }`}>
                  {selectedPlan === key && (
                    <div className={`w-2.5 h-2.5 rounded-full ${key === "three_month" ? "bg-amber-500" : "bg-[#5B8DEF]"}`} />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        {currentCredits > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-400">
              현재 {currentCredits}회의 크레딧을 보유하고 있습니다.
              구독 시작 후에도 보유 크레딧을 먼저 소모한 뒤 구독이 적용됩니다.
            </p>
          </div>
        )}

        {/* 카드 정보 입력 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-medium text-slate-300">카드 정보 입력</span>
            </div>

            {/* 카드번호 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">카드번호</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardNo}
                onChange={e => setCardNo(formatCardNumber(e.target.value))}
                required
                maxLength={19}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF] text-sm tracking-widest"
              />
            </div>

            {/* 유효기간 */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">유효기간 (월)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="MM"
                  value={expMonth}
                  onChange={e => setExpMonth(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  required
                  maxLength={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF] text-sm text-center"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">유효기간 (년)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="YY"
                  value={expYear}
                  onChange={e => setExpYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  required
                  maxLength={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF] text-sm text-center"
                />
              </div>
            </div>

            {/* 비밀번호 앞 2자리 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">비밀번호 앞 2자리</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  inputMode="numeric"
                  placeholder="••"
                  value={cardPw}
                  onChange={e => setCardPw(e.target.value.replace(/\D/g, "").slice(0, 2))}
                  required
                  maxLength={2}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF] text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 생년월일 / 사업자번호 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">생년월일 6자리 (개인) 또는 사업자번호 10자리</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="예) 901225 또는 1234567890"
                value={idNo}
                onChange={e => setIdNo(e.target.value.replace(/\D/g, "").slice(0, 10))}
                required
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-[#5B8DEF] text-sm"
              />
            </div>
          </div>

          {/* 결제 요약 */}
          <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 text-sm">플랜</span>
              <span className="text-white text-sm font-medium">{plan.name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-700 pt-3">
              <span className="text-white font-semibold">결제 금액</span>
              <span className="text-xl font-bold text-white">{plan.price}원</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {selectedPlan === "monthly" ? "매월 자동 갱신됩니다." : "3개월 후 자동 갱신됩니다."}
              언제든지 마이페이지에서 해지할 수 있습니다.
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] active:scale-95 text-white py-6 text-lg font-semibold"
          >
            {loading ? (
              <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 처리 중...</>
            ) : (
              <><Lock className="w-5 h-5 mr-2" /> {plan.price}원 결제하기</>
            )}
          </Button>

          <p className="text-xs text-slate-500 text-center">
            카드 정보는 나이스페이먼츠를 통해 안전하게 처리되며, 서버에 저장되지 않습니다.
          </p>
        </form>
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
