/**
 * 크레딧 결제 성공 페이지 — 충전 시각화 포함
 *
 * 경로: /payment/credits/success?tid=...&orderId=...&amount=...
 *
 * NICEPayments 결제 인증 후 callback에서 리다이렉트.
 * 1. URL 파라미터에서 tid, orderId, amount 추출
 * 2. confirmCreditPayment()로 서버에서 승인 + 크레딧 지급
 * 3. 성공 시 크레딧 충전 애니메이션 → 5초 후 분석 페이지 이동
 */
"use client"

import { Suspense, useEffect, useState, useRef } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2, XCircle, Zap, ArrowRight } from "lucide-react"
import { confirmCreditPayment } from "@/app/actions/payment"
import { Button } from "@/components/ui/button"
import Link from "next/link"

/** 카운트업 애니메이션 — 0부터 target까지 숫자 올라감 */
function AnimatedCounter({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [count, setCount] = useState(0)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (target <= 0) return
    const start = performance.now()
    startRef.current = start

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [target, duration])

  return <>{count}</>
}

/** 크레딧 슬롯 하나 (채워지는 애니메이션) */
function CreditSlot({ index, total, filled }: { index: number; total: number; filled: boolean }) {
  return (
    <div
      className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-sm font-bold transition-all duration-500 ${
        filled
          ? "border-[#5B8DEF] bg-[#5B8DEF]/20 text-[#5B8DEF] scale-110"
          : "border-slate-700 bg-slate-800/50 text-slate-600"
      }`}
      style={{ transitionDelay: `${index * 150}ms` }}
    >
      {filled ? <Zap className="w-4 h-4" /> : index + 1}
    </div>
  )
}

function CreditSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [errorMessage, setErrorMessage] = useState("")
  const [credits, setCredits] = useState(0)
  const [purchasedCredits, setPurchasedCredits] = useState(0)
  const [showSlots, setShowSlots] = useState(false)
  const [filledCount, setFilledCount] = useState(0)
  const [showComplete, setShowComplete] = useState(false)

  useEffect(() => {
    const tid = searchParams.get("tid")
    const orderId = searchParams.get("orderId")
    const amount = searchParams.get("amount")

    if (!tid || !orderId || !amount) {
      setStatus("error")
      setErrorMessage("결제 정보가 올바르지 않습니다.")
      return
    }

    async function confirm() {
      const result = await confirmCreditPayment(tid!, orderId!, Number(amount))

      if (result.error) {
        setStatus("error")
        setErrorMessage(result.error)
      } else {
        setStatus("success")
        setCredits(result.credits || 0)
        // 구매한 크레딧 수 추정 (금액 기반)
        const amt = Number(amount)
        const purchased = amt <= 3000 ? 1 : amt <= 8000 ? 5 : 10
        setPurchasedCredits(purchased)

        // 충전 애니메이션 시퀀스
        setTimeout(() => setShowSlots(true), 300)
        setTimeout(() => setFilledCount(purchased), 800)
        setTimeout(() => setShowComplete(true), 800 + purchased * 150 + 500)
        setTimeout(() => {
          window.location.href = "/analyze"
        }, 5000)
      }
    }

    confirm()
  }, [searchParams, router])

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        {/* 처리 중 */}
        {status === "processing" && (
          <>
            <div className="relative w-20 h-20 mx-auto mb-6">
              <Loader2 className="w-20 h-20 text-[#5B8DEF] animate-spin" />
              <Zap className="w-8 h-8 text-[#5B8DEF] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">결제 확인 중...</h1>
            <p className="text-slate-400">크레딧을 충전하고 있습니다.</p>
            <div className="mt-6 flex justify-center gap-2">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-[#5B8DEF] animate-bounce"
                  style={{ animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
          </>
        )}

        {/* 성공 — 충전 시각화 */}
        {status === "success" && (
          <div className="space-y-6">
            {/* 체크마크 */}
            <div className={`transition-all duration-700 ${showComplete ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto" />
            </div>

            <h1 className="text-2xl font-bold text-white">
              {showComplete ? "충전 완료!" : "크레딧 충전 중..."}
            </h1>

            {/* 크레딧 슬롯 애니메이션 */}
            {showSlots && purchasedCredits <= 10 && (
              <div className="flex justify-center gap-2 flex-wrap py-4">
                {Array.from({ length: purchasedCredits }).map((_, i) => (
                  <CreditSlot
                    key={i}
                    index={i}
                    total={purchasedCredits}
                    filled={i < filledCount}
                  />
                ))}
              </div>
            )}

            {/* 충전량 + 보유량 */}
            <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">충전한 크레딧</span>
                <span className="text-[#5B8DEF] font-bold text-lg">
                  +<AnimatedCounter target={purchasedCredits} />회
                </span>
              </div>
              <div className="h-px bg-[#1e3a5f]" />
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">현재 보유 크레딧</span>
                <span className="text-white font-bold text-2xl">
                  <AnimatedCounter target={credits} duration={1800} />회
                </span>
              </div>
              {/* 게이지 바 */}
              <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#5B8DEF] to-[#7BA4F7] rounded-full transition-all duration-1500 ease-out"
                  style={{ width: `${Math.min((credits / Math.max(credits, 10)) * 100, 100)}%`, transitionDuration: "1.5s" }}
                />
              </div>
            </div>

            {/* 안내 텍스트 */}
            <p className="text-slate-500 text-sm">
              잠시 후 분석 페이지로 이동합니다.
            </p>

            {/* CTA 버튼 */}
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white w-full">
              <Link href="/analyze" className="flex items-center justify-center gap-2">
                바로 분석하러 가기 <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        )}

        {/* 에러 */}
        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">결제 확인에 실패했습니다</h1>
            <p className="text-slate-400 mb-2">{errorMessage}</p>
            <p className="text-sm text-slate-500 mb-6">문제가 지속되면 고객센터에 문의해주세요.</p>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/payment/credits">다시 시도</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}

export default function CreditSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <CreditSuccessContent />
    </Suspense>
  )
}
