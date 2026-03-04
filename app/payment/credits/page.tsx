/**
 * 크레딧(회차권) 결제 페이지
 *
 * 크레딧은 분석 1회에 1개씩 소비되는 이용권이다.
 * 구독(무제한)과 달리 필요한 만큼만 구매하는 방식.
 *
 * ── 페이지 URL ──
 * /payment/credits                    → 기본 (1회권 선택)
 * /payment/credits?package=credit_1   → 1회권 (2,900원)
 * /payment/credits?package=credit_5   → 5회권 (7,900원)
 * /payment/credits?package=credit_10  → 10회권 (12,900원)
 *
 * ── 동작 흐름 ──
 * 1. 로그인 확인 (비로그인이면 로그인 페이지로 안내)
 * 2. 페이지 로드 → useEffect에서 TossPayments SDK를 미리 초기화
 * 3. 사용자가 패키지 선택 (1회/5회/10회)
 * 4. "결제하기" 버튼 클릭
 *    → createCreditOrder()로 서버에 주문 생성 (금액은 서버가 결정)
 *    → TossPayments 일반결제(카드 결제) 화면 표시
 * 5. 결제 성공 → /payment/credits/success 페이지로 이동
 * 6. 결제 실패/취소 → /payment/credits/fail 페이지로 이동
 *
 * ── 금액 보안 ──
 * 화면에 표시되는 금액(PACKAGES)은 UI용이고,
 * 실제 결제 금액은 서버(payment.ts의 CREDIT_PRICES)에서 결정한다.
 * → 브라우저에서 금액을 조작해도 서버에서 검증하므로 안전함.
 *
 * ── SDK 초기화 패턴 ──
 * TossPayments 공식 문서에서 권장하는 방식:
 * - useEffect(컴포넌트가 화면에 나타날 때)에서 SDK를 미리 로드
 * - 버튼 클릭 시에는 requestPayment(결제 요청)만 호출
 */
"use client"

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Loader2, Lock, Zap } from "lucide-react"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { createCreditOrder } from "@/app/actions/payment"

/**
 * TossPayments 클라이언트 키 (공개 키)
 * - NEXT_PUBLIC_ 접두사: 브라우저에서 사용 가능한 환경변수
 * - Vercel 환경변수에서 설정 (빌드 시 코드에 포함됨)
 * - 테스트 환경에서는 test_ck_... 형식의 테스트 키 사용
 */
const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ""

/**
 * 크레딧 패키지 목록 (UI 표시용)
 *
 * 여기 있는 price는 화면에 보여주기 위한 값이고,
 * 실제 결제 금액은 서버(payment.ts CREDIT_PRICES)에서 결정한다.
 * → 보안: 클라이언트에서 금액을 조작해도 서버에서 검증
 */
const PACKAGES = [
  {
    key: "credit_1",
    name: "1회권",
    credits: 1,
    price: 2900,
    perCredit: "2,900",
    badge: null as string | null,
  },
  {
    key: "credit_5",
    name: "5회권",
    credits: 5,
    price: 7900,
    perCredit: "1,580",
    badge: "45% 할인",
  },
  {
    key: "credit_10",
    name: "10회권",
    credits: 10,
    price: 12900,
    perCredit: "1,290",
    badge: "55% 할인",
  },
]

/**
 * 크레딧 결제 페이지 (라우트 컴포넌트)
 *
 * Suspense로 감싸는 이유:
 * - CreditsContent 안에서 useSearchParams()를 사용하는데,
 *   Next.js App Router에서는 이 훅이 Suspense 경계 안에 있어야 함
 * - Suspense fallback: SDK 로딩 중 스피너 표시
 */
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

/**
 * 크레딧 결제 페이지의 실제 내용 컴포넌트
 *
 * 로그인 확인 → 패키지 선택 → 결제 요청까지의 모든 로직을 담당.
 */
function CreditsContent() {
  // ─── URL 파라미터에서 패키지 정보 읽기 ───
  const searchParams = useSearchParams()

  // ─── 상태 관리 ───
  // 로그인 여부 (null = 아직 확인 중)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  // 선택된 패키지 키 (기본값: 1회권)
  const [selectedPackage, setSelectedPackage] = useState("credit_1")
  // 결제 진행 중 여부 (버튼 로딩 표시용)
  const [loading, setLoading] = useState(false)
  // 에러 메시지
  const [error, setError] = useState("")

  // ─── TossPayments SDK 관련 상태 ───
  /**
   * TossPayments 결제 인스턴스
   * - useEffect에서 미리 초기화해둠
   * - 이 값이 null이면 아직 SDK 로딩 중 → 버튼 비활성화
   * - any 타입: TossPayments SDK가 자체 타입을 제공하지 않음
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [payment, setPayment] = useState<any>(null)

  // ─── URL 파라미터로 전달된 패키지 선택 적용 ───
  useEffect(() => {
    const pkgParam = searchParams.get("package")
    if (pkgParam && PACKAGES.some(p => p.key === pkgParam)) {
      setSelectedPackage(pkgParam)
    }
  }, [searchParams])

  // ─── 로그인 확인 + TossPayments SDK 초기화 ───
  /**
   * 컴포넌트가 화면에 나타나자마자(마운트) 실행.
   *
   * 순서:
   * 1. Supabase에서 현재 로그인한 사용자 확인
   * 2. 비로그인이면 로그인 안내 화면 표시 (SDK 초기화 안 함)
   * 3. 로그인되었으면 TossPayments SDK 로드
   * 4. 사용자 ID로 TossPayments 고객 키(customerKey) 생성
   * 5. payment 인스턴스 생성 → 결제 버튼 활성화
   */
  useEffect(() => {
    async function init() {
      // Supabase에서 현재 로그인 사용자 확인
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      setIsLoggedIn(!!user) // true/false로 로그인 여부 설정

      // 비로그인이거나 TossPayments 키가 없으면 SDK 초기화 안 함
      if (!user || !TOSS_CLIENT_KEY) return

      try {
        // TossPayments 고객 키 생성 (user.id에서 하이픈 제거 후 앞 20자)
        const customerKey = `cust_${user.id.replace(/-/g, "").slice(0, 20)}`
        // TossPayments SDK 로드 및 결제 인스턴스 생성
        const tossPayments = await loadTossPayments(TOSS_CLIENT_KEY)
        const paymentInstance = tossPayments.payment({ customerKey })
        setPayment(paymentInstance) // → 이 시점부터 결제 버튼 활성화
      } catch (err) {
        console.error("[credits] SDK 초기화 에러:", err)
      }
    }
    init()
  }, []) // 빈 배열: 컴포넌트 최초 마운트 시 1번만 실행

  // 현재 선택된 패키지의 상세 정보
  const pkg = PACKAGES.find(p => p.key === selectedPackage) || PACKAGES[0]

  // ─── 결제 요청 ───
  /**
   * "결제하기" 버튼 클릭 시 실행.
   *
   * 흐름:
   * 1. SDK가 로드되었는지 확인
   * 2. createCreditOrder()로 서버에 주문 생성
   *    → 서버에서 금액 결정 + credit_orders 테이블에 주문 저장 (pending 상태)
   *    → orderId + amount 반환
   * 3. requestPayment()로 TossPayments 결제 화면 표시
   * 4. 사용자가 카드 결제 완료 → successUrl로 자동 이동
   * 5. 취소하면 → failUrl로 자동 이동
   */
  async function handlePayment() {
    setLoading(true)
    setError("")

    try {
      if (!payment) {
        setError("결제 모듈을 불러오지 못했습니다. 페이지를 새로고침해주세요.")
        setLoading(false)
        return
      }

      // 서버에 주문 생성 요청 (금액은 서버에서 결정 — 보안)
      const orderResult = await createCreditOrder(selectedPackage)
      if (orderResult.error) {
        setError(orderResult.error)
        setLoading(false)
        return
      }

      // TossPayments 카드 결제 화면 띄우기
      await payment.requestPayment({
        method: "CARD",                                                     // 카드 결제
        amount: { currency: "KRW", value: orderResult.amount! },            // 서버가 결정한 결제 금액
        orderId: orderResult.orderId!,                                      // 서버가 생성한 주문 ID
        orderName: `디자이닛 분석 ${pkg.name}`,                               // 결제 화면에 표시될 상품명
        successUrl: `${window.location.origin}/payment/credits/success`,    // 결제 성공 시 이동 URL
        failUrl: `${window.location.origin}/payment/credits/fail`,          // 결제 실패 시 이동 URL
      })
    } catch (err: unknown) {
      // 에러 발생 시 사용자에게 알기 쉬운 메시지 표시
      console.error("[credits] 결제 에러:", err)
      const message = err instanceof Error ? err.message : "결제 처리 중 문제가 발생했습니다."
      setError(message)
      setLoading(false)
    }
  }

  // ─── 로딩 중 화면 (로그인 여부 확인 중) ───
  if (isLoggedIn === null) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

  // ─── 비로그인 화면 ───
  // 크레딧 결제는 로그인이 필수 → 로그인 페이지로 안내
  if (!isLoggedIn) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="max-w-md mx-auto px-6 text-center">
          <Lock className="w-16 h-16 text-slate-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">로그인이 필요합니다</h1>
          <p className="text-slate-400 mb-6">크레딧 구매를 위해 로그인해 주세요.</p>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            {/* 로그인 후 이 페이지로 다시 돌아오도록 redirect 파라미터 전달 */}
            <Link href="/login?redirect=/payment/credits">로그인하기</Link>
          </Button>
        </div>
      </main>
    )
  }

  // ─── 메인 결제 화면 ───
  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* 뒤로가기 링크 → /pricing 페이지로 이동 */}
        <Link href="/pricing" className="inline-flex items-center text-slate-400 hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4 mr-2" /> 가격표로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">분석 크레딧 구매</h1>
        <p className="text-slate-400 mb-8">필요한 만큼만 구매하세요. 크레딧은 만료되지 않습니다.</p>

        {/* ── 패키지 선택 카드 ── */}
        {/* 1회권, 5회권, 10회권 중 하나를 선택할 수 있는 카드형 버튼 */}
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
                    {/* 할인 뱃지 (5회권: 45% 할인, 10회권: 55% 할인) */}
                    {p.badge && (
                      <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">{p.badge}</span>
                    )}
                  </div>
                  <p className="text-slate-400 text-sm mt-1">회당 {p.perCredit}원</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-xl">{p.price.toLocaleString()}원</p>
                  <p className="text-slate-500 text-sm">{p.credits}회 분석</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* ── 월 구독 안내 배너 ── */}
        {/* 10회 이상 사용하면 무제한 구독이 더 저렴하다는 안내 */}
        <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 mb-8">
          <p className="text-slate-400 text-sm">
            <Zap className="w-4 h-4 inline text-amber-400 mr-1" />
            10회 이상 사용한다면?{" "}
            <Link href="/payment/billing?plan=monthly" className="text-[#5B8DEF] hover:underline">
              월 13,900원 무제한 구독
            </Link>
            이 더 합리적이에요.
          </p>
        </div>

        {/* 에러 메시지 표시 영역 */}
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm mb-4">
            {error}
          </div>
        )}

        {/* ── 결제 버튼 ── */}
        {/* payment가 null이면 SDK 아직 로딩 중 → 버튼 비활성화 */}
        <Button
          onClick={handlePayment}
          disabled={loading || !payment}
          className="w-full py-6 text-lg bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"
        >
          {loading ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 준비 중...</>
          ) : !payment ? (
            <><Loader2 className="w-5 h-5 animate-spin mr-2" /> 결제 모듈 로딩 중...</>
          ) : (
            <>{pkg.price.toLocaleString()}원 결제하기</>
          )}
        </Button>
      </div>
    </main>
  )
}
