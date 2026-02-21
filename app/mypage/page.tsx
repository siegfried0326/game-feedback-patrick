"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Crown, FileText, Calendar, Star, AlertCircle, Loader2, Shield, ChevronDown, ChevronUp, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubscription, cancelSubscription, getAnalysisHistory, getAnalysisDetail } from "@/app/actions/subscription"
import { getUser } from "@/app/actions/auth"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"

type Subscription = {
  plan: string
  status: string
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
}

type AnalysisItem = {
  id: string
  file_name: string
  overall_score: number
  analyzed_at: string
  categories: { subject: string; value: number; fullMark: number }[]
  strengths: string[]
  weaknesses: string[]
  ranking?: {
    total: number
    percentile: number
    companyComparison?: { company: string; avgScore: number; userScore: number }[]
  }
}

export default function MyPage() {
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [history, setHistory] = useState<AnalysisItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailData, setDetailData] = useState<Record<string, AnalysisItem>>({})
  const [loadingDetail, setLoadingDetail] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, subResult, historyResult] = await Promise.all([
          getUser(),
          getSubscription(),
          getAnalysisHistory(),
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

        if (historyResult.data) {
          setHistory(historyResult.data as AnalysisItem[])
        }
      } catch {
        console.error("데이터 로딩 실패")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleToggleDetail = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      return
    }

    setExpandedId(id)

    // 이미 로드된 데이터가 있으면 재사용
    if (detailData[id]) return

    setLoadingDetail(id)
    try {
      const result = await getAnalysisDetail(id)
      if (result.data) {
        setDetailData(prev => ({ ...prev, [id]: result.data as AnalysisItem }))
      }
    } catch {
      console.error("상세 데이터 로딩 실패")
    } finally {
      setLoadingDetail(null)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    setMessage(null)

    const result = await cancelSubscription()

    if (result.error) {
      setMessage({ type: "error", text: result.error })
    } else {
      setMessage({ type: "success", text: "구독이 해지되었습니다. 만료일까지 계속 이용 가능합니다." })
      const subResult = await getSubscription()
      if (subResult.data) {
        setSubscription(subResult.data as Subscription)
      }
    }

    setCancelling(false)
    setShowCancelConfirm(false)
  }

  const getPlanLabel = (plan: string) => {
    switch (plan) {
      case "free": return "무료 체험"
      case "monthly": return "월 구독"
      case "three_month": return "3개월 패스"
      default: return plan
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "이용중"
      case "cancelled": return "해지됨"
      case "expired": return "만료됨"
      default: return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "text-green-400 bg-green-400/10"
      case "cancelled": return "text-yellow-400 bg-yellow-400/10"
      case "expired": return "text-red-400 bg-red-400/10"
      default: return "text-slate-400 bg-slate-400/10"
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">마이페이지</h1>

        {/* 메시지 표시 */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg border ${
              message.type === "success"
                ? "bg-green-400/10 border-green-400/30 text-green-400"
                : "bg-red-400/10 border-red-400/30 text-red-400"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* 데이터 보호 안내 */}
        <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
          <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-emerald-400 font-medium">
              당신의 데이터는 안전합니다
            </p>
            <p className="text-xs text-emerald-400/70 mt-1">
              업로드된 문서는 분석 즉시 서버에서 완전히 삭제됩니다. 분석 결과는 암호화되어 저장되며,
              본인만 조회할 수 있습니다. 서비스 관리자를 포함한 그 누구도 회원님의 분석 결과를 열람할 수 없습니다.
            </p>
          </div>
        </div>

        {/* 프로필 섹션 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">프로필</h2>
          <div className="flex items-center gap-4">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt="프로필"
                className="w-16 h-16 rounded-full border-2 border-[#1e3a5f]"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-[#162a4a] flex items-center justify-center border-2 border-[#1e3a5f]">
                <span className="text-2xl text-[#5B8DEF]">
                  {(user?.name || user?.email || "U")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-white font-medium text-lg">
                {user?.name || "사용자"}
              </p>
              <p className="text-slate-400 text-sm">{user?.email}</p>
            </div>
          </div>
        </div>

        {/* 구독 상태 섹션 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#5B8DEF]" />
              구독 상태
            </h2>
            {subscription && (
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                {getStatusLabel(subscription.status)}
              </span>
            )}
          </div>

          {subscription ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-400 mb-1">현재 플랜</p>
                  <p className="text-white font-medium">{getPlanLabel(subscription.plan)}</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400 mb-1">시작일</p>
                  <p className="text-white font-medium">{formatDate(subscription.created_at)}</p>
                </div>
                {subscription.expires_at && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">만료일</p>
                    <p className="text-white font-medium">{formatDate(subscription.expires_at)}</p>
                  </div>
                )}
                {subscription.cancelled_at && (
                  <div>
                    <p className="text-sm text-slate-400 mb-1">해지일</p>
                    <p className="text-yellow-400 font-medium">{formatDate(subscription.cancelled_at)}</p>
                  </div>
                )}
              </div>

              {subscription.plan === "free" && (
                <div className="bg-[#162a4a] rounded-lg p-4 border border-[#1e3a5f]">
                  <p className="text-sm text-slate-300">
                    무료 체험은 1회 분석이 가능합니다. 무제한 분석을 원하시면 구독을 시작해 주세요.
                  </p>
                  <Button asChild className="mt-3 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                    <Link href="/pricing">요금제 보기</Link>
                  </Button>
                </div>
              )}

              {subscription.plan !== "free" && subscription.status === "active" && (
                <>
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      className="text-sm text-slate-500 hover:text-red-400 transition-colors underline"
                    >
                      구독 해지하기
                    </button>
                  ) : (
                    <div className="bg-red-400/5 border border-red-400/20 rounded-lg p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-white font-medium mb-1">정말 해지하시겠습니까?</p>
                          <p className="text-sm text-slate-400 mb-3">
                            해지 후에도 만료일까지는 계속 이용 가능합니다. 부분 환불은 제공되지 않습니다.
                          </p>
                          <div className="flex gap-3">
                            <Button
                              onClick={handleCancel}
                              disabled={cancelling}
                              className="bg-red-500 hover:bg-red-600 text-white text-sm"
                            >
                              {cancelling ? (
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              ) : null}
                              해지 확인
                            </Button>
                            <Button
                              onClick={() => setShowCancelConfirm(false)}
                              variant="outline"
                              className="border-[#1e3a5f] text-slate-400 hover:text-white text-sm"
                            >
                              취소
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <p className="text-slate-400">구독 정보를 불러올 수 없습니다.</p>
          )}
        </div>

        {/* 분석 이력 섹션 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#5B8DEF]" />
            분석 이력
          </h2>

          {/* 프라이버시 안내 */}
          <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
            <Lock className="w-3 h-3" />
            <span>분석 결과는 본인만 열람 가능하며, 관리자도 접근할 수 없습니다.</span>
          </div>

          {history.length > 0 ? (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id}>
                  <button
                    onClick={() => handleToggleDetail(item.id)}
                    className="w-full text-left bg-[#162a4a] rounded-lg p-4 border border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-white font-medium text-sm truncate max-w-[50%]">
                        {item.file_name}
                      </h3>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-[#5B8DEF]" />
                          <span className="text-[#5B8DEF] font-bold">{item.overall_score}</span>
                          <span className="text-slate-500 text-sm">/100</span>
                        </div>
                        {expandedId === item.id ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.analyzed_at)}
                      <span className="text-slate-600">|</span>
                      <span>클릭하여 상세 결과 보기</span>
                    </div>
                  </button>

                  {/* 상세 결과 패널 */}
                  {expandedId === item.id && (
                    <div className="mt-2 bg-[#0d1b2a] rounded-lg border border-[#1e3a5f] p-6 animate-in fade-in slide-in-from-top-2 duration-300">
                      {loadingDetail === item.id ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="w-6 h-6 text-[#5B8DEF] animate-spin" />
                        </div>
                      ) : detailData[item.id] ? (
                        <div className="space-y-6">
                          <div className="grid lg:grid-cols-2 gap-6">
                            <ScoreCard score={detailData[item.id].overall_score} />
                            {detailData[item.id].categories && detailData[item.id].categories.length > 0 && (
                              <RadarChartComponent data={detailData[item.id].categories} />
                            )}
                          </div>

                          {/* 랭킹 */}
                          {detailData[item.id].ranking && detailData[item.id].ranking!.total > 0 && (
                            <div className="bg-slate-900/80 rounded-lg border border-[#1e3a5f] p-4">
                              <p className="text-sm text-slate-400 mb-2">
                                합격 포트폴리오 {detailData[item.id].ranking!.total}개 기준
                              </p>
                              <p className="text-2xl font-bold text-[#5B8DEF]">
                                상위 {100 - detailData[item.id].ranking!.percentile}%
                              </p>
                            </div>
                          )}

                          {/* 강점/약점 */}
                          {(detailData[item.id].strengths?.length > 0 || detailData[item.id].weaknesses?.length > 0) && (
                            <FeedbackCards
                              strengths={detailData[item.id].strengths || []}
                              weaknesses={detailData[item.id].weaknesses || []}
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-slate-400 text-center py-4">데이터를 불러올 수 없습니다.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 mb-1">아직 분석 이력이 없습니다</p>
              <p className="text-slate-500 text-sm mb-4">문서를 업로드하고 AI 분석을 받아보세요</p>
              <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                <Link href="/analyze">분석하러 가기</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
