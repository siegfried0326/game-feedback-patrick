/**
 * 마이페이지 (/mypage) — 구독/결제 전용
 *
 * 기능:
 * - 프로필 (이름, 이메일, 아바타)
 * - 구독 상태 (플랜, 크레딧, 만료일, 해지)
 * - 크레딧 구매 내역 + 환불
 *
 * 프로젝트 및 분석 결과는 /projects 로 분리됨.
 */
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Crown, Calendar, AlertCircle, Loader2, Shield, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { getSubscription, cancelSubscription } from "@/app/actions/subscription"
import { getCreditOrders, refundCreditOrder } from "@/app/actions/payment"
import { getUser } from "@/app/actions/auth"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

type Subscription = {
  plan: string
  status: string
  expires_at: string | null
  cancelled_at: string | null
  started_at: string | null
  created_at: string
  analysis_credits: number
}

export default function MyPage() {
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // 크레딧 환불 상태
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [creditOrders, setCreditOrders] = useState<any[]>([])
  const [showRefundConfirm, setShowRefundConfirm] = useState<string | null>(null)
  const [refunding, setRefunding] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, subResult] = await Promise.all([
          getUser(),
          getSubscription(),
        ])

        if (userData) {
          setUser({
            email: userData.email,
            name: userData.user_metadata?.full_name || userData.user_metadata?.name,
            avatar: userData.user_metadata?.avatar_url || userData.user_metadata?.picture,
          })
        }

        if (subResult.data) {
          setSubscription(subResult.data as Subscription)
        }

        const ordersResult = await getCreditOrders()
        if (ordersResult.orders) {
          setCreditOrders(ordersResult.orders)
        }
      } catch {
        console.error("데이터 로딩 실패")
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  const handleCancel = async () => {
    setCancelling(true)
    setMessage(null)
    const result = await cancelSubscription()
    if (result.error) {
      setMessage({ type: "error", text: result.error })
    } else {
      setMessage({ type: "success", text: "구독이 해지되었습니다. 만료일까지 계속 이용 가능합니다." })
      const subResult = await getSubscription()
      if (subResult.data) setSubscription(subResult.data as Subscription)
    }
    setCancelling(false)
    setShowCancelConfirm(false)
  }

  const handleRefund = async (orderId: string) => {
    setRefunding(true)
    setMessage(null)
    const result = await refundCreditOrder(orderId)
    if (result.error) {
      setMessage({ type: "error", text: result.error })
    } else {
      setMessage({ type: "success", text: `${result.refundAmount?.toLocaleString()}원이 환불되었습니다. (${result.refundedCredits}회 차감)` })
      const [subResult, ordersResult] = await Promise.all([
        getSubscription(),
        getCreditOrders(),
      ])
      if (subResult.data) setSubscription(subResult.data as Subscription)
      if (ordersResult.orders) setCreditOrders(ordersResult.orders)
    }
    setRefunding(false)
    setShowRefundConfirm(null)
  }

  const getPlanLabel = (plan: string) => {
    switch (plan) { case "free": return "무료"; case "monthly": return "월 무제한"; case "three_month": return "3개월 무제한"; default: return plan }
  }
  const getStatusLabel = (status: string) => {
    switch (status) { case "active": return "이용중"; case "cancelled": return "해지됨"; case "expired": return "만료됨"; default: return status }
  }
  const getStatusColor = (status: string) => {
    switch (status) { case "active": return "text-green-400 bg-green-400/10"; case "cancelled": return "text-yellow-400 bg-yellow-400/10"; case "expired": return "text-red-400 bg-red-400/10"; default: return "text-slate-400 bg-slate-400/10" }
  }
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })

  const isPaidPlan = subscription && subscription.plan !== "free"

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> 홈으로 돌아가기
          </Link>
          <Link href="/projects" className="inline-flex items-center gap-2 text-sm text-[#5B8DEF] hover:text-[#4A7CE0] transition-colors">
            <FolderOpen className="w-4 h-4" /> 프로젝트 관리
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">마이페이지</h1>
        <p className="text-sm text-slate-400 mb-8">구독과 결제 내역을 관리합니다. 프로젝트·분석 결과는 <Link href="/projects" className="text-[#5B8DEF] hover:underline">프로젝트 페이지</Link>에서 확인하세요.</p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${message.type === "success" ? "bg-green-400/10 border-green-400/30 text-green-400" : "bg-red-400/10 border-red-400/30 text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* 데이터 보호 안내 */}
        <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">당신의 데이터는 안전합니다</p>
            <p className="text-xs text-emerald-400/70 mt-1">
              업로드된 문서는 분석 즉시 서버에서 완전히 삭제됩니다. 분석 결과는 암호화되어 저장되며,
              본인만 조회할 수 있습니다. 서비스 관리자를 포함한 그 누구도 회원님의 분석 결과를 열람할 수 없습니다.
            </p>
          </div>
        </div>

        {/* 프로필 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img src={user.avatar} alt="프로필" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full border-2 border-[#1e3a5f] object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#162a4a] flex items-center justify-center border-2 border-[#1e3a5f]">
                <span className="text-2xl text-[#5B8DEF]">{(user?.name || user?.email || "U")[0].toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-white font-medium text-lg">{user?.name || "사용자"}</p>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 구독 상태 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#5B8DEF]" /> 구독 상태
            </h2>
            {subscription && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                {getStatusLabel(subscription.status)}
              </span>
            )}
          </div>
          {subscription ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">현재 플랜</p>
                <p className="text-white font-medium">{getPlanLabel(subscription.plan)}</p>
              </div>

              {(subscription.analysis_credits ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-slate-400">남은 크레딧</p>
                    <p className="text-sm font-semibold text-white">{subscription.analysis_credits}회</p>
                  </div>
                  <Progress
                    value={Math.min(((subscription.analysis_credits ?? 0) / 10) * 100, 100)}
                    className="h-3 bg-slate-700 [&>[data-slot=progress-indicator]]:bg-[#5B8DEF]"
                  />
                </div>
              )}

              {isPaidPlan && subscription.status === "active" && subscription.expires_at && (!subscription.expires_at || new Date(subscription.expires_at) > new Date()) && (() => {
                const now = new Date()
                const expiresAt = new Date(subscription.expires_at!)
                const startedAt = subscription.started_at ? new Date(subscription.started_at) : new Date(subscription.created_at)
                const totalMs = expiresAt.getTime() - startedAt.getTime()
                const elapsedMs = now.getTime() - startedAt.getTime()
                const progressPct = totalMs > 0 ? Math.min((elapsedMs / totalMs) * 100, 100) : 0
                const remainingDays = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
                const startStr = startedAt.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                const endStr = expiresAt.toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-slate-400">구독 기간</p>
                      <p className="text-sm font-semibold text-emerald-400">D-{remainingDays}</p>
                    </div>
                    <Progress value={progressPct} className="h-3 bg-slate-700 [&>[data-slot=progress-indicator]]:bg-emerald-400" />
                    <p className="text-xs text-slate-500 mt-1">{startStr} ~ {endStr}</p>
                  </div>
                )
              })()}

              {(subscription.analysis_credits ?? 0) === 0 && isPaidPlan && subscription.status === "active" && (!subscription.expires_at || new Date(subscription.expires_at) > new Date()) && (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-slate-400">분석 크레딧</p>
                  <p className="text-sm font-semibold text-emerald-400">무제한</p>
                </div>
              )}

              {isPaidPlan && subscription.status === "active" && (!subscription.expires_at || new Date(subscription.expires_at) > new Date()) && (subscription.analysis_credits ?? 0) > 0 && (
                <div className="bg-[#5B8DEF]/5 rounded-lg p-3 border border-[#5B8DEF]/20">
                  <p className="text-xs text-[#5B8DEF]">
                    보유 크레딧({subscription.analysis_credits}크레딧)을 먼저 소모한 뒤 구독이 적용됩니다.
                  </p>
                </div>
              )}

              {subscription.cancelled_at && (
                <div><p className="text-sm text-slate-400 mb-1">해지일</p><p className="text-yellow-400 font-medium">{formatDate(subscription.cancelled_at)}</p></div>
              )}

              {(!isPaidPlan || subscription.status !== "active") && (subscription.analysis_credits ?? 0) === 0 && (
                <div className="bg-[#162a4a] rounded-lg p-4 border border-[#1e3a5f]">
                  <p className="text-sm text-slate-300">크레딧이 없습니다. 크레딧을 구매하거나 무제한 구독을 시작해 보세요.</p>
                  <div className="flex gap-2 mt-3">
                    <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"><Link href="/payment/credits">크레딧 구매</Link></Button>
                    <Button asChild variant="outline" className="border-[#1e3a5f] text-slate-300 hover:text-white"><Link href="/pricing">요금제 보기</Link></Button>
                  </div>
                </div>
              )}
              {subscription.plan === "monthly" && subscription.status === "active" && (
                <div className="bg-[#5B8DEF]/5 rounded-lg p-3 border border-[#5B8DEF]/20">
                  <p className="text-xs text-[#5B8DEF]">🤖 Claude Sonnet AI 사용 중</p>
                </div>
              )}
              {subscription.plan === "three_month" && subscription.status === "active" && (
                <div className="bg-purple-500/5 rounded-lg p-3 border border-purple-500/20">
                  <p className="text-xs text-purple-400">✨ 프리미엄 Claude Opus AI 사용 중</p>
                </div>
              )}
              {subscription.plan !== "free" && subscription.status === "active" && (
                <>
                  {!showCancelConfirm ? (
                    <button onClick={() => setShowCancelConfirm(true)} className="text-sm text-slate-500 hover:text-red-400 transition-colors underline">구독 해지하기</button>
                  ) : (
                    <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-white font-medium mb-1">정말 해지하시겠습니까?</p>
                          <p className="text-sm text-slate-400 mb-3">해지 후에도 만료일까지는 계속 이용 가능합니다.</p>
                          <div className="flex gap-3">
                            <Button onClick={handleCancel} disabled={cancelling} className="bg-red-500 hover:bg-red-600 text-white text-sm">
                              {cancelling && <Loader2 className="w-4 h-4 animate-spin mr-2" />} 해지 확인
                            </Button>
                            <Button onClick={() => setShowCancelConfirm(false)} variant="outline" className="border-[#1e3a5f] text-slate-400 hover:text-white text-sm">취소</Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : <p className="text-slate-400">구독 정보를 불러올 수 없습니다.</p>}
        </div>

        {/* 크레딧 구매 내역 */}
        {creditOrders.length > 0 && (
          <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#5B8DEF]" /> 크레딧 구매 내역
            </h2>
            <div className="space-y-3">
              {creditOrders.map((order: {
                order_id: string; packageLabel: string; paidAtFormatted: string;
                credits: number; amount: number; canRefund: boolean;
                refundAmount: number; usedCredits: number; isWithin7Days: boolean;
                refundableCredits: number; refunded_at: string | null;
              }) => (
                <div key={order.order_id} className="flex items-center justify-between p-4 bg-[#0d1b2a] rounded-xl border border-[#1e3a5f]">
                  <div>
                    <p className="text-white text-sm font-medium">{order.packageLabel}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {order.paidAtFormatted} · {order.amount.toLocaleString()}원
                    </p>
                  </div>
                  {order.refunded_at ? (
                    <span className="text-xs text-yellow-400">환불됨</span>
                  ) : !order.isWithin7Days ? (
                    <span className="text-xs text-slate-600">만료됨</span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-600 mt-3 flex items-center gap-1.5">
              <Link href="/refund-policy" className="text-[#5B8DEF] hover:underline">환불정책 보기</Link>
              {creditOrders.some((o: { canRefund: boolean }) => o.canRefund) && (
                <>
                  <span className="text-slate-700">·</span>
                  <button
                    onClick={() => {
                      const refundable = creditOrders.find((o: { canRefund: boolean }) => o.canRefund)
                      if (refundable) setShowRefundConfirm(refundable.order_id)
                    }}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                    disabled={refunding}
                  >
                    환불하기
                  </button>
                </>
              )}
            </p>
          </div>
        )}

        {/* 프로젝트 관리로 가기 CTA */}
        <div className="bg-gradient-to-r from-[#5B8DEF]/10 to-purple-500/10 rounded-2xl border border-[#5B8DEF]/30 p-6">
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#5B8DEF]/20 flex items-center justify-center shrink-0">
                <FolderOpen className="w-6 h-6 text-[#5B8DEF]" />
              </div>
              <div>
                <p className="text-white font-semibold mb-1">분석 결과는 프로젝트 페이지에서</p>
                <p className="text-sm text-slate-400">프로젝트 인벤토리와 버전별 점수 비교는 별도 페이지에서 확인하세요.</p>
              </div>
            </div>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white shrink-0">
              <Link href="/projects">프로젝트 열기</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 환불 확인 다이얼로그 */}
      <AlertDialog open={!!showRefundConfirm} onOpenChange={() => setShowRefundConfirm(null)}>
        <AlertDialogContent className="bg-[#0f1d32] border-[#1e3a5f] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>환불 확인</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {(() => {
                const order = creditOrders.find((o: { order_id: string }) => o.order_id === showRefundConfirm)
                if (!order) return ""
                return `${order.packageLabel} (${order.amount.toLocaleString()}원)에서 ${order.refundAmount.toLocaleString()}원이 환불됩니다.${order.usedCredits > 0 ? ` 사용한 ${order.usedCredits}회(${(order.usedCredits * 2900).toLocaleString()}원)는 차감됩니다.` : ""} 환불된 크레딧(${order.refundableCredits}회)은 즉시 차감됩니다. 진행하시겠습니까?`
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[#1e3a5f] text-slate-400 hover:text-white" disabled={refunding}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => showRefundConfirm && handleRefund(showRefundConfirm)}
              className="bg-red-500 hover:bg-red-600 text-white"
              disabled={refunding}
            >
              {refunding && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              환불 진행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  )
}
