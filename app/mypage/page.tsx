/**
 * 마이페이지 (/mypage) — 구독/결제 전용
 *
 * 기능:
 * - 프로필 (이름, 이메일, 아바타)
 * - 크레딧 (남은 크레딧 + 충전, 판매 종료 전 구독이 유효하면 한 줄 안내·해지)
 * - 크레딧 구매 내역 + 환불
 *
 * 프로젝트 및 분석 결과는 /projects 로 분리됨.
 */
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Coins, Calendar, Loader2, Shield, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubscription, cancelSubscription } from "@/app/actions/subscription"
import { getCreditOrders, refundCreditOrder } from "@/app/actions/payment"
import { getUser } from "@/app/actions/auth"
import { PAYMENTS_ENABLED } from "@/lib/payments-config"
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
    switch (status) { case "active": return "text-green-600 bg-green-400/10"; case "cancelled": return "text-yellow-600 bg-yellow-400/10"; case "expired": return "text-red-600 bg-red-400/10"; default: return "text-muted-foreground bg-slate-400/10" }
  }
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })

  const isPaidPlan = subscription && subscription.plan !== "free"

  if (loading) {
    return (
      <main className="min-h-screen bg-secondary flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black text-foreground mb-2">마이페이지</h1>
        <p className="text-sm text-muted-foreground mb-8">크레딧과 결제 내역을 관리해요. 분석 결과는 <Link href="/projects" className="text-primary hover:underline">내 프로젝트</Link>에 있어요.</p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${message.type === "success" ? "bg-green-400/10 border-green-500/30 text-green-600" : "bg-red-400/10 border-red-500/30 text-red-600"}`}>
            {message.text}
          </div>
        )}

        {/* 데이터 보호 안내 */}
        <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-600 font-medium">당신의 데이터는 안전합니다</p>
            <p className="text-xs text-emerald-600/70 mt-1">
              업로드된 문서는 분석 즉시 서버에서 완전히 삭제됩니다. 분석 결과는 암호화되어 저장되며,
              본인만 조회할 수 있습니다. 서비스 관리자를 포함한 그 누구도 회원님의 분석 결과를 열람할 수 없습니다.
            </p>
          </div>
        </div>

        {/* 프로필 */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img src={user.avatar} alt="프로필" referrerPolicy="no-referrer" className="w-16 h-16 rounded-full border-2 border-border object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border-2 border-border">
                <span className="text-2xl text-primary">{(user?.name || user?.email || "U")[0].toUpperCase()}</span>
              </div>
            )}
            <div>
              <p className="text-foreground font-medium text-lg">{user?.name || "사용자"}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 크레딧 — 지금 남은 크레딧 + 충전 */}
        <div className="bg-card rounded-2xl border border-border p-6 mb-6">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
            <Coins className="w-5 h-5 text-primary" /> 크레딧
          </h2>
          {subscription ? (
            <>
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">남은 크레딧</p>
                  <p className="text-4xl font-black text-foreground leading-none">
                    {subscription.analysis_credits ?? 0}<span className="text-base font-semibold text-muted-foreground ml-1">크레딧</span>
                  </p>
                </div>
                {PAYMENTS_ENABLED ? (
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90 text-white">
                    <Link href="/payment/credits">충전하기</Link>
                  </Button>
                ) : (
                  <p className="text-xs text-amber-600 text-right">결제 일시 중단 중</p>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                기본 분석 1크레딧 · 정밀 분석 2크레딧 · 40쪽이 넘는 문서는 40쪽마다 +1 · 크레딧은 만료되지 않아요
              </p>

              {/* 판매 종료 전 가입한 구독이 아직 유효한 경우만 */}
              {isPaidPlan && subscription.status === "active" && (!subscription.expires_at || new Date(subscription.expires_at) > new Date()) && (
                <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {getPlanLabel(subscription.plan)} 이용 중
                    {subscription.expires_at && ` · ${formatDate(subscription.expires_at)}까지`}
                    {(subscription.analysis_credits ?? 0) > 0 && " · 보유 크레딧을 먼저 사용해요"}
                  </span>
                  {!showCancelConfirm ? (
                    <button onClick={() => setShowCancelConfirm(true)} className="text-xs text-muted-foreground hover:text-red-600 underline">구독 해지</button>
                  ) : (
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">만료일까지는 계속 쓸 수 있어요.</span>
                      <Button onClick={handleCancel} disabled={cancelling} size="sm" className="bg-red-500 hover:bg-red-600 text-white">
                        {cancelling && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />} 해지
                      </Button>
                      <Button onClick={() => setShowCancelConfirm(false)} size="sm" variant="outline" className="border-border text-muted-foreground">취소</Button>
                    </span>
                  )}
                </div>
              )}
              {subscription.cancelled_at && (
                <p className="mt-2 text-xs text-muted-foreground">구독 해지일 {formatDate(subscription.cancelled_at)}</p>
              )}
            </>
          ) : <p className="text-muted-foreground">크레딧 정보를 불러올 수 없어요.</p>}
        </div>

        {/* 크레딧 구매 내역 */}
        {creditOrders.length > 0 && (
          <div className="bg-card rounded-2xl border border-border p-6 mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" /> 크레딧 구매 내역
            </h2>
            <div className="space-y-3">
              {creditOrders.map((order: {
                order_id: string; packageLabel: string; paidAtFormatted: string;
                credits: number; amount: number; canRefund: boolean;
                refundAmount: number; usedCredits: number; isWithin7Days: boolean;
                refundableCredits: number; refunded_at: string | null;
              }) => (
                <div key={order.order_id} className="flex items-center justify-between p-4 bg-secondary rounded-xl border border-border">
                  <div>
                    <p className="text-foreground text-sm font-medium">{order.packageLabel}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.paidAtFormatted} · {order.amount.toLocaleString()}원
                    </p>
                  </div>
                  {order.refunded_at ? (
                    <span className="text-xs text-yellow-600">환불됨</span>
                  ) : !order.isWithin7Days ? (
                    <span className="text-xs text-muted-foreground/80">만료됨</span>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/80 mt-3 flex items-center gap-1.5">
              <Link href="/refund-policy" className="text-primary hover:underline">환불정책 보기</Link>
              {creditOrders.some((o: { canRefund: boolean }) => o.canRefund) && (
                <>
                  <span className="text-muted-foreground/80">·</span>
                  <button
                    onClick={() => {
                      const refundable = creditOrders.find((o: { canRefund: boolean }) => o.canRefund)
                      if (refundable) setShowRefundConfirm(refundable.order_id)
                    }}
                    className="text-muted-foreground hover:text-foreground/80 transition-colors"
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
        <div className="bg-accent/50 rounded-2xl border border-primary/20 p-6">
          <div className="flex items-center justify-between gap-4 flex-col sm:flex-row">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <FolderOpen className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-foreground font-semibold mb-1">분석 결과는 내 프로젝트에서</p>
                <p className="text-sm text-muted-foreground">저장한 분석과 수정본별 점수 변화를 볼 수 있어요.</p>
              </div>
            </div>
            <Button asChild className="bg-primary hover:bg-primary/90 text-white shrink-0">
              <Link href="/projects">프로젝트 열기</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 환불 확인 다이얼로그 */}
      <AlertDialog open={!!showRefundConfirm} onOpenChange={() => setShowRefundConfirm(null)}>
        <AlertDialogContent className="bg-secondary border-border text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>환불 확인</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {(() => {
                const order = creditOrders.find((o: { order_id: string }) => o.order_id === showRefundConfirm)
                if (!order) return ""
                return `${order.packageLabel} (${order.amount.toLocaleString()}원)에서 ${order.refundAmount.toLocaleString()}원이 환불됩니다.${order.usedCredits > 0 ? ` 사용한 ${order.usedCredits}회(${(order.usedCredits * (order.unitPrice ?? 3900)).toLocaleString()}원)는 차감됩니다.` : ""} 환불된 크레딧(${order.refundableCredits}회)은 즉시 차감됩니다. 진행하시겠습니까?`
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:text-foreground" disabled={refunding}>취소</AlertDialogCancel>
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
