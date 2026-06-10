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
import { PAYMENTS_ENABLED, PAYMENTS_DISABLED_MESSAGE } from "@/lib/payments-config"

const PLANS = {
  monthly:     { name: "월 무제한",    price: "13,800", amount: 13800, period: "월",    description: "무제한 분석 + 버전 비교 + Claude AI" },
  three_month: { name: "3개월 무제한", price: "39,000", amount: 39000, period: "3개월", description: "🏆 3개월 무제한 — 가장 합리적인 장기 플랜" },
} as const

// 결제 중복 방지: sessionStorage에 결제 시작 시각을 저장하여 새로고침/재진입 시 차단
const PAYMENT_LOCK_KEY = "billing_payment_lock_at"
const PAYMENT_LOCK_WINDOW_MS = 5 * 60 * 1000 // 5분

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
  const [activeSubInfo, setActiveSubInfo] = useState<{ plan: string; expiresAt: string | null } | null>(null)
  const [paymentInFlight, setPaymentInFlight] = useState(false)

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
      // 이미 활성 구독이 있으면 안내 (중복 결제 방지)
      if (r.data && r.data.plan !== "free" && r.data.status === "active") {
        const expiresAt = r.data.expires_at ? new Date(r.data.expires_at) : null
        const isStillActive = !expiresAt || expiresAt > new Date()
        if (isStillActive) {
          setActiveSubInfo({
            plan: r.data.plan,
            expiresAt: r.data.expires_at,
          })
        }
      }
    })

    // 결제 진행 중 락 확인 (새로고침/재진입 시 중복 결제 방지)
    try {
      const lockTsStr = sessionStorage.getItem(PAYMENT_LOCK_KEY)
      if (lockTsStr) {
        const lockTs = parseInt(lockTsStr, 10)
        if (!Number.isNaN(lockTs) && Date.now() - lockTs < PAYMENT_LOCK_WINDOW_MS) {
          setPaymentInFlight(true)
        } else {
          sessionStorage.removeItem(PAYMENT_LOCK_KEY)
        }
      }
    } catch { /* sessionStorage 사용 불가 환경 무시 */ }
  }, [router])

  const plan = PLANS[selectedPlan]

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    // 클라이언트 측 중복 클릭 방지: 이미 결제 처리 중이면 무시
    if (loading || paymentInFlight) return

    // sessionStorage 락 — 새로고침/다른 탭에서 다시 결제 시도 차단
    try {
      const existingLock = sessionStorage.getItem(PAYMENT_LOCK_KEY)
      if (existingLock) {
        const lockTs = parseInt(existingLock, 10)
        if (!Number.isNaN(lockTs) && Date.now() - lockTs < PAYMENT_LOCK_WINDOW_MS) {
          setPaymentInFlight(true)
          return
        }
      }
      sessionStorage.setItem(PAYMENT_LOCK_KEY, String(Date.now()))
    } catch { /* sessionStorage 사용 불가 환경 무시 */ }

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
        // 결제 실패 시 lock 해제 (재시도 가능하도록)
        try { sessionStorage.removeItem(PAYMENT_LOCK_KEY) } catch {}
        setError(data.error || "결제 처리 중 오류가 발생했습니다.")
        setLoading(false)
        return
      }

      // 결제 성공: lock 유지(만료 5분)하여 success 페이지 이동 중 재결제 차단
      setSuccess(true)
      setTimeout(() => {
        try { sessionStorage.removeItem(PAYMENT_LOCK_KEY) } catch {}
        window.location.href = "/analyze"
      }, 3000)
    } catch {
      try { sessionStorage.removeItem(PAYMENT_LOCK_KEY) } catch {}
      setError("네트워크 오류가 발생했습니다. 다시 시도해주세요.")
      setLoading(false)
    }
  }

  // 결제 일시 중단 — 결제 폼 진입 자체를 차단
  if (!PAYMENTS_ENABLED) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <Lock className="w-16 h-16 text-slate-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-3">결제 서비스 준비 중</h1>
          <p className="text-slate-400 mb-8 leading-relaxed">{PAYMENTS_DISABLED_MESSAGE}</p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline" className="border-[#1e3a5f] text-slate-300 hover:text-white">
              <Link href="/">홈으로</Link>
            </Button>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/analyze">분석하러 가기</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">구독이 시작되었습니다!</h1>
          <p className="text-slate-400 mb-6">
            {selectedPlan === "three_month"
              ? "이제 3개월 동안 무제한 분석과 모든 기능을 이용하실 수 있습니다."
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

  // 결제 진행 중인 경우 안내 (새로고침/재진입 시 중복 결제 방지)
  if (paymentInFlight) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <Loader2 className="w-16 h-16 text-[#5B8DEF] animate-spin mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">결제가 처리 중입니다</h1>
          <p className="text-slate-400 mb-2">방금 시작한 결제가 아직 처리 중이에요.</p>
          <p className="text-sm text-slate-500 mb-6">중복 결제를 방지하기 위해 잠시 차단됩니다.<br />몇 분 뒤 마이페이지에서 결과를 확인해주세요.</p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline" className="border-[#1e3a5f] text-slate-300 hover:text-white">
              <Link href="/mypage">마이페이지로 이동</Link>
            </Button>
            <Button
              type="button"
              onClick={() => {
                try { sessionStorage.removeItem(PAYMENT_LOCK_KEY) } catch {}
                setPaymentInFlight(false)
              }}
              variant="outline"
              className="border-slate-600 text-slate-400 hover:text-white"
            >
              결제가 안 됐다면 다시 시도
            </Button>
          </div>
        </div>
      </main>
    )
  }

  // 이미 활성 구독이 있는 경우 결제 페이지 차단 + 안내
  if (activeSubInfo) {
    const planLabel = activeSubInfo.plan === "monthly" ? "월 무제한" : "3개월 무제한"
    const expireStr = activeSubInfo.expiresAt
      ? new Date(activeSubInfo.expiresAt).toLocaleDateString("ko-KR")
      : "무기한"
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">이미 활성 구독이 있습니다</h1>
          <p className="text-slate-400 mb-2">
            현재 <span className="text-white font-medium">{planLabel}</span> 플랜을 이용 중입니다.
          </p>
          <p className="text-slate-400 mb-6">
            만료일: <span className="text-white">{expireStr}</span>
          </p>
          <p className="text-sm text-amber-400/80 mb-6">
            중복 결제를 방지하기 위해 결제 페이지가 차단되었습니다.<br />
            플랜 변경이나 해지는 마이페이지에서 가능합니다.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild variant="outline" className="border-[#1e3a5f] text-slate-300 hover:text-white">
              <Link href="/mypage">마이페이지로 이동</Link>
            </Button>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/analyze">분석하러 가기</Link>
            </Button>
          </div>
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
