"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, GraduationCap, Lock, KeyRound, CheckCircle2, BookOpen, Target, Users } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { checkTutoringAccess, validateTutoringCode, createTutoringOrder } from "@/app/actions/tutoring"
import { createClient } from "@/lib/supabase/client"

const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

const PACKAGES = [
  {
    key: "tutoring_1h",
    name: "1:1 컨설팅 (4타임)",
    price: 480000,
    description: "타임당 12만원 × 4회 = 총 48만원",
    details: ["포트폴리오 심층 리뷰", "실무 노하우 전수", "질의응답 무제한", "4회 맞춤 커리큘럼 제공"],
    emoji: "📚",
    icon: BookOpen,
  },
  {
    key: "mock_interview",
    name: "모의면접 / 단기 피드백",
    price: 200000,
    description: "실전 모의면접 또는 포트폴리오 집중 피드백 1회",
    details: ["실전형 모의면접 진행", "면접 피드백 리포트 제공", "합격 전략 컨설팅"],
    emoji: "🎯",
    icon: Target,
  },
  {
    key: "group_tutoring",
    name: "그룹 컨설팅 (1타임)",
    price: 90000,
    description: "타임당 9만원 · 소규모 그룹 형태",
    details: ["소규모 그룹 (2~4인)", "참여자 간 피드백 교류", "합리적인 가격의 컨설팅", "커리큘럼 맞춤 조정"],
    emoji: "👥",
    icon: Users,
  },
] as const

export default function TutoringPage() {
  const [accessChecked, setAccessChecked] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [accessError, setAccessError] = useState("")

  // 코드 인증 상태
  const [codeInput, setCodeInput] = useState("")
  const [codeVerified, setCodeVerified] = useState(false)
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError] = useState("")

  // 결제 상태
  const [selectedPackage, setSelectedPackage] = useState<string>("tutoring_1h")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [widgetsReady, setWidgetsReady] = useState(false)
  const [widgetsInstance, setWidgetsInstance] = useState<any>(null)

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

  // 코드 검증
  async function handleCodeVerify() {
    if (!codeInput.trim()) return
    setCodeLoading(true)
    setCodeError("")

    try {
      const result = await validateTutoringCode(codeInput)
      if (result.valid) {
        setCodeVerified(true)
      } else {
        setCodeError(result.error || "유효하지 않은 코드입니다.")
      }
    } catch {
      setCodeError("코드 확인 중 오류가 발생했습니다.")
    } finally {
      setCodeLoading(false)
    }
  }

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
          <h1 className="text-2xl font-bold text-white">1:1 컨설팅 · 모의면접</h1>
        </div>
        <p className="text-slate-400 mb-8">게임 업계 11년차 현업 기획자의 1:1 맞춤 컨설팅</p>

        {/* ========== 코드 입력 영역 ========== */}
        {!codeVerified && (
          <div className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-6 mb-8">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="w-5 h-5 text-[#5B8DEF]" />
              <h2 className="text-white font-semibold">상담 코드 입력</h2>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              카카오톡 상담 후 받은 코드를 입력해 주세요.<br />
              코드가 없으시면 먼저 상담을 신청해 주세요.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={codeInput}
                onChange={e => setCodeInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !codeLoading && handleCodeVerify()}
                placeholder="상담 코드 입력"
                className="flex-1 bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#5B8DEF] uppercase tracking-widest"
                disabled={codeLoading}
              />
              <Button
                onClick={handleCodeVerify}
                disabled={codeLoading || !codeInput.trim()}
                className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white px-6"
              >
                {codeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "확인"}
              </Button>
            </div>
            {codeError && (
              <p className="text-sm text-red-400 mb-3">{codeError}</p>
            )}
            <a
              href="https://open.kakao.com/o/sLz0kgBf"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[#5B8DEF] hover:underline"
            >
              아직 코드가 없으신가요? 카카오톡 상담 신청하기 →
            </a>
          </div>
        )}

        {/* ========== 코드 인증 완료 → 상품 선택 + 결제 ========== */}
        {codeVerified && (
          <>
            {/* 인증 완료 배지 */}
            <div className="flex items-center gap-2 mb-6 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm text-emerald-400 font-medium">코드 인증 완료</span>
            </div>

            {/* 상품 선택 */}
            <div className="space-y-4 mb-8">
              {PACKAGES.map(p => {
                const Icon = p.icon
                return (
                  <button
                    key={p.key}
                    onClick={() => {
                      setSelectedPackage(p.key)
                      setWidgetsReady(false)
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
                          <p className="text-white font-semibold">{p.name}</p>
                          <p className="text-white font-bold text-lg">{p.price.toLocaleString()}<span className="text-sm text-slate-400">원</span></p>
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
                disabled={loading}
                className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                {pkg.price.toLocaleString()}원 결제하기
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
                <a href="https://open.kakao.com/o/sLz0kgBf" target="_blank" rel="noopener noreferrer" className="text-[#5B8DEF] hover:underline">
                  카카오톡 상담
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
