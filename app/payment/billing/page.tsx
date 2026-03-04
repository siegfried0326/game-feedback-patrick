/**
 * 구독 결제 페이지
 *
 * TossPayments 빌링키 방식으로 카드를 등록하고, 등록 즉시 첫 결제가 이루어진다.
 * 이후 구독 기간이 끝나면 등록된 카드로 자동 결제(갱신)가 가능하다.
 *
 * ── 페이지 URL ──
 * /payment/billing?plan=monthly       → 월 구독 (13,900원/월)
 * /payment/billing?plan=three_month   → 3개월 구독 (39,000원)
 *
 * ── 동작 흐름 ──
 * 1. 페이지 로드 → useEffect에서 TossPayments SDK를 미리 초기화
 * 2. 사용자가 플랜(월/3개월) 선택
 * 3. (선택) 게임캔버스 할인 코드 입력 → 서버에서 유효성 검증
 * 4. "카드 등록하기" 버튼 클릭 → TossPayments 카드 등록 화면 표시
 * 5. 카드 등록 성공 → /payment/billing/success 페이지로 이동
 * 6. 카드 등록 실패/취소 → /payment/billing/fail 페이지로 이동
 *
 * ── SDK 초기화 패턴 ──
 * TossPayments 공식 문서에서 권장하는 방식:
 * - useEffect(컴포넌트가 화면에 나타날 때)에서 SDK를 미리 로드
 * - 버튼 클릭 시에는 requestBillingAuth(카드등록 요청)만 호출
 * → 이렇게 해야 SDK 로딩 시간 없이 즉시 결제 화면이 뜸
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, CreditCard, Loader2, KeyRound, CheckCircle2, ChevronDown } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { validateGamecanvasCode } from "@/app/actions/payment"

/**
 * TossPayments 클라이언트 키 (공개 키)
 * - NEXT_PUBLIC_ 접두사: 브라우저에서 사용 가능한 환경변수
 * - Vercel 환경변수에서 설정 (빌드 시 코드에 포함됨)
 * - 테스트 환경에서는 test_ck_... 형식의 테스트 키 사용
 */
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

/**
 * 구독 플랜 정보
 * - monthly: 월 구독 (13,900원) — Claude Sonnet 모델 사용
 * - three_month: 3개월 구독 (39,000원) — 프리미엄 Claude Opus 모델 사용
 * - 실제 결제 금액은 서버(payment.ts)에서 최종 결정 (보안)
 */
const PLANS = {
  monthly: { name: "월 무제한", price: "13,900", amount: 13900, period: "월", description: "무제한 분석 + 버전 비교 + Claude Sonnet" },
  three_month: { name: "3개월 무제한", price: "39,000", amount: 39000, period: "3개월", description: "무제한 분석 + 버전 비교 + 프리미엄 Claude Opus" },
} as const

/**
 * 구독 결제 페이지의 실제 내용 컴포넌트
 *
 * Suspense 안에서 렌더링되며, useSearchParams() 사용을 위해 분리됨.
 * (Next.js에서 useSearchParams는 Suspense 경계 안에서만 사용 가능)
 */
function BillingContent() {
  // ─── URL 파라미터에서 플랜 정보 읽기 ───
  const searchParams = useSearchParams()
  const planParam = searchParams.get("plan") as keyof typeof PLANS | null

  // ─── 상태 관리 ───
  // 선택된 플랜 (URL 파라미터가 유효하면 사용, 아니면 기본값 monthly)
  const [selectedPlan, setSelectedPlan] = useState<keyof typeof PLANS>(planParam && PLANS[planParam] ? planParam : "monthly")
  // 결제 진행 중 여부 (버튼 로딩 표시용)
  const [loading, setLoading] = useState(false)
  // 에러 메시지
  const [error, setError] = useState("")

  // ─── 게임캔버스 할인코드 관련 상태 ───
  // 할인코드 입력 영역 표시 여부
  const [showDiscountInput, setShowDiscountInput] = useState(false)
  // 사용자가 입력한 할인 코드
  const [discountCode, setDiscountCode] = useState("")
  // 할인 코드가 서버에서 확인되었는지 여부
  const [discountVerified, setDiscountVerified] = useState(false)
  // 할인 코드 검증 중 로딩 상태
  const [discountLoading, setDiscountLoading] = useState(false)
  // 할인 코드 검증 실패 시 에러 메시지
  const [discountError, setDiscountError] = useState("")

  // ─── TossPayments SDK 관련 상태 ───
  /**
   * TossPayments 결제 인스턴스
   * - useEffect에서 미리 초기화해둠
   * - 이 값이 null이면 아직 SDK 로딩 중 → 버튼 비활성화
   * - any 타입: TossPayments SDK가 자체 타입을 제공하지 않음
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payment, setPayment] = useState<any>(null)
  // TossPayments 고객 식별 키 (Supabase user.id 기반으로 생성)
  const [customerKey, setCustomerKey] = useState("")

  // 현재 선택된 플랜의 상세 정보
  const plan = PLANS[selectedPlan]

  // ─── 할인 적용 시 실제 결제 금액 계산 ───
  // 게임캔버스 할인이 적용되면 월 구독이 13,900원 → 5,900원
  const finalAmount = discountVerified && selectedPlan === "monthly" ? 5900 : plan.amount
  const finalPrice = finalAmount.toLocaleString()

  // ─── TossPayments SDK 초기화 ───
  /**
   * 컴포넌트가 화면에 나타나자마자(마운트) SDK를 미리 로드한다.
   * 이렇게 하면 사용자가 "카드 등록하기" 버튼을 누를 때 바로 결제 화면이 뜸.
   *
   * 순서:
   * 1. TOSS_CLIENT_KEY 환경변수 확인
   * 2. Supabase에서 현재 로그인한 사용자 정보 가져오기
   * 3. 사용자 ID로 TossPayments 고객 키(customerKey) 생성
   * 4. TossPayments SDK 로드 → payment 인스턴스 생성
   */
  useEffect(() => {
    async function initSDK() {
      if (!TOSS_CLIENT_KEY) {
        setError("결제 시스템 설정 오류입니다. 관리자에게 문의해주세요.")
        return
      }

      try {
        // Supabase에서 현재 로그인 사용자 확인
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return // 비로그인이면 SDK 초기화 안 함

        // TossPayments 고객 키 생성 (user.id에서 하이픈 제거 후 앞 20자)
        const custKey = `cust_${user.id.replace(/-/g, "").slice(0, 20)}`
        setCustomerKey(custKey)

        // TossPayments SDK 로드 및 결제 인스턴스 생성
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
        const paymentInstance = tossPayments.payment({ customerKey: custKey })
        setPayment(paymentInstance) // → 이 시점부터 결제 버튼 활성화
      } catch (err) {
        console.error("[billing] SDK 초기화 에러:", err)
      }
    }

    initSDK()
  }, []) // 빈 배열: 컴포넌트 최초 마운트 시 1번만 실행

  // ─── 게임캔버스 할인코드 검증 ───
  /**
   * 사용자가 입력한 할인 코드를 서버에 보내서 유효한지 확인한다.
   * 유효하면 월 구독 가격이 13,900원 → 5,900원으로 변경.
   * 서버 액션: validateGamecanvasCode() (app/actions/payment.ts)
   */
  async function handleDiscountVerify() {
    if (!discountCode.trim()) return
    setDiscountLoading(true)
    setDiscountError("")

    try {
      const result = await validateGamecanvasCode(discountCode)
      if (result.valid) {
        setDiscountVerified(true) // 할인 적용 완료
      } else {
        setDiscountError(result.error || "유효하지 않은 코드입니다.")
      }
    } catch {
      setDiscountError("코드 확인 중 오류가 발생했습니다.")
    } finally {
      setDiscountLoading(false)
    }
  }

  // ─── 카드 등록 (빌링키 발급) 요청 ───
  /**
   * "카드 등록하기" 버튼 클릭 시 실행.
   * TossPayments 카드 등록 화면(팝업)을 띄운다.
   *
   * 흐름:
   * 1. SDK가 로드되었는지 확인
   * 2. 성공/실패 시 이동할 URL 생성 (할인코드가 있으면 URL에 포함)
   * 3. requestBillingAuth() 호출 → TossPayments 카드 등록 화면 표시
   * 4. 사용자가 카드 정보 입력 완료 → successUrl로 자동 이동
   * 5. 취소하면 → failUrl로 자동 이동
   */
  async function handleBillingAuth() {
    setLoading(true)
    setError("")

    try {
      if (!payment) {
        setError("결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.")
        setLoading(false)
        return
      }

      // 카드 등록 성공 시 이동할 URL 생성
      let successUrl = `${window.location.origin}/payment/billing/success?plan=${selectedPlan}`
      // 게임캔버스 할인코드가 인증되었으면 URL 파라미터에 포함 (성공 페이지에서 사용)
      if (discountVerified && discountCode && selectedPlan === "monthly") {
        successUrl += `&discountCode=${encodeURIComponent(discountCode)}`
      }

      // 현재 로그인 사용자 정보 (이메일, 이름을 결제 화면에 표시)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // TossPayments 카드 등록 화면 띄우기
      await payment.requestBillingAuth({
        method: "CARD",                                                     // 카드 결제
        successUrl,                                                         // 성공 시 이동 URL
        failUrl: `${window.location.origin}/payment/billing/fail`,          // 실패 시 이동 URL
        customerEmail: user?.email || "",                                    // 고객 이메일
        customerName: user?.user_metadata?.name || "구매자",                 // 고객 이름
      })
    } catch (err: unknown) {
      // 에러 발생 시 사용자에게 알기 쉬운 메시지 표시
      console.error("[billing] 결제 에러:", err)
      const message = err instanceof Error ? err.message : "결제 처리 중 문제가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  // ─── 화면 렌더링 ───
  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-lg mx-auto px-6 py-16">
        {/* 뒤로가기 링크 → /pricing 페이지로 이동 */}
        <Link
          href="/pricing"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          요금제로 돌아가기
        </Link>

        <h1 className="text-2xl font-bold text-white mb-2">구독 결제</h1>
        <p className="text-slate-400 mb-8">카드를 등록하고 구독을 시작하세요.</p>

        {/* ── 플랜 선택 라디오 버튼 ── */}
        {/* monthly와 three_month 중 하나를 선택할 수 있는 카드형 버튼 */}
        <div className="space-y-3 mb-6">
          {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
            <button
              key={key}
              onClick={() => {
                setSelectedPlan(key)
                // 3개월 플랜으로 바꾸면 게임캔버스 할인 상태 초기화
                // (할인은 monthly 플랜에만 적용 가능)
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
                {/* 선택 표시 원형 라디오 */}
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedPlan === key ? "border-[#5B8DEF]" : "border-slate-600"
                }`}>
                  {selectedPlan === key && <div className="w-2.5 h-2.5 rounded-full bg-[#5B8DEF]" />}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── 게임캔버스 할인코드 입력 영역 ── */}
        {/* monthly 플랜 선택 시에만 표시 */}
        {/* 게임캔버스 수강생 할인: 13,900원 → 5,900원 */}
        {selectedPlan === "monthly" && (
          <div className="mb-6">
            {!discountVerified ? (
              <>
                {/* 할인코드 입력 토글 버튼 */}
                <button
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="flex items-center gap-2 text-sm text-[#5B8DEF] hover:text-[#4A7CE0] transition-colors mb-3"
                >
                  <KeyRound className="w-4 h-4" />
                  게임캔버스 수강생이신가요?
                  <ChevronDown className={`w-4 h-4 transition-transform ${showDiscountInput ? "rotate-180" : ""}`} />
                </button>

                {/* 할인코드 입력 폼 (토글 시 표시) */}
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
                    {/* 할인코드 에러 메시지 */}
                    {discountError && (
                      <p className="text-sm text-red-400">{discountError}</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              /* 할인 적용 완료 표시 */
              <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">게임캔버스 할인 적용 (월 5,900원)</span>
              </div>
            )}
          </div>
        )}

        {/* ── 결제 요약 카드 ── */}
        {/* 선택한 플랜 + 할인 적용 여부 + 최종 결제 금액 표시 */}
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
          {/* 할인 적용 시 정가 취소선 표시 */}
          {discountVerified && selectedPlan === "monthly" && (
            <div className="flex items-center justify-between mb-2 text-sm">
              <span className="text-slate-500">정가</span>
              <span className="text-slate-500 line-through">{plan.price}원</span>
            </div>
          )}
          {/* 최종 결제 금액 */}
          <div className="flex items-center justify-between border-t border-slate-700 pt-4">
            <span className="text-white font-semibold">결제 금액</span>
            <span className="text-xl font-bold text-white">{finalPrice}원</span>
          </div>
        </div>

        {/* 에러 메시지 표시 영역 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ── 카드 등록 버튼 ── */}
        {/* payment가 null이면 SDK 아직 로딩 중 → 버튼 비활성화 */}
        <Button
          onClick={handleBillingAuth}
          disabled={loading || !payment}
          className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white py-6 text-lg font-semibold"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <CreditCard className="w-5 h-5 mr-2" />
          )}
          {loading ? "처리 중..." : !payment ? "결제 모듈 로딩 중..." : "카드 등록하기"}
        </Button>

        {/* 안내 문구 */}
        <p className="text-xs text-slate-500 text-center mt-4">
          카드를 등록하면 즉시 첫 결제가 진행됩니다.
          <br />
          구독은 언제든지 해지할 수 있습니다.
        </p>
      </div>
    </main>
  )
}

/**
 * 구독 결제 페이지 (라우트 컴포넌트)
 *
 * Suspense로 감싸는 이유:
 * - BillingContent 안에서 useSearchParams()를 사용하는데,
 *   Next.js App Router에서는 이 훅이 Suspense 경계 안에 있어야 함
 * - Suspense fallback: SDK 로딩 중 스피너 표시
 */
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
