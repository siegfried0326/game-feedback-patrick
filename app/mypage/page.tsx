"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Crown, FileText, Calendar, Star, AlertCircle, Loader2, Shield, Lock, X, Trophy, Swords, FolderOpen, Plus, ChevronRight, BarChart3, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubscription, cancelSubscription, getProjects, getProjectAnalyses, getAnalysisDetail } from "@/app/actions/subscription"
import { getUser } from "@/app/actions/auth"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { DesignScores } from "@/components/design-scores"
import { ReadabilityScores } from "@/components/readability-scores"
import { LayoutRecommendations } from "@/components/layout-recommendations"
import { VersionComparison } from "@/components/version-comparison"

type Subscription = {
  plan: string
  status: string
  expires_at: string | null
  cancelled_at: string | null
  created_at: string
}

type ProjectWithStats = {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
  analysis_count: number
  best_score: number | null
  latest_score: number | null
  latest_file_name: string | null
  latest_analyzed_at: string | null
}

type AnalysisItem = {
  id: string
  file_name: string
  overall_score: number
  analyzed_at: string
  categories: { subject: string; value: number; fullMark: number; feedback?: string }[]
  strengths: string[]
  weaknesses: string[]
  company_feedback?: string
  analysis_source?: string
  readability_categories?: { subject: string; value: number; fullMark: number; feedback?: string }[]
  layout_recommendations?: {
    pageOrSection: string
    currentDescription: string
    recommendedDescription: string
    currentLayout: { sections: { label: string; x: number; y: number; w: number; h: number; color: string }[] }
    recommendedLayout: { sections: { label: string; x: number; y: number; w: number; h: number; color: string }[] }
  }[]
  ranking?: {
    total: number
    percentile: number
    companyComparison?: { company: string; avgScore: number; userScore: number }[]
  }
}

// 점수 기반 등급 시스템
function getGrade(score: number) {
  if (score >= 90) return { label: "S", color: "from-amber-400 to-yellow-500", border: "border-amber-400/60", glow: "shadow-amber-400/20", text: "text-amber-400", bg: "bg-amber-400/10" }
  if (score >= 80) return { label: "A", color: "from-purple-400 to-violet-500", border: "border-purple-400/60", glow: "shadow-purple-400/20", text: "text-purple-400", bg: "bg-purple-400/10" }
  if (score >= 70) return { label: "B", color: "from-blue-400 to-cyan-500", border: "border-blue-400/60", glow: "shadow-blue-400/20", text: "text-blue-400", bg: "bg-blue-400/10" }
  if (score >= 60) return { label: "C", color: "from-green-400 to-emerald-500", border: "border-green-400/60", glow: "shadow-green-400/20", text: "text-green-400", bg: "bg-green-400/10" }
  return { label: "D", color: "from-slate-400 to-gray-500", border: "border-slate-400/60", glow: "shadow-slate-400/20", text: "text-slate-400", bg: "bg-slate-400/10" }
}

export default function MyPage() {
  const [user, setUser] = useState<{ email?: string; name?: string; avatar?: string } | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Level 2: 프로젝트 상세
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null)
  const [projectAnalyses, setProjectAnalyses] = useState<AnalysisItem[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)

  // 버전 비교 토글
  const [showComparison, setShowComparison] = useState(false)

  // Level 3: 분석 상세 모달
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisItem | null>(null)
  const [detailData, setDetailData] = useState<Record<string, AnalysisItem>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [userData, subResult, projectsResult] = await Promise.all([
          getUser(),
          getSubscription(),
          getProjects(),
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

        if (projectsResult.data) {
          setProjects(projectsResult.data as ProjectWithStats[])
        }
      } catch {
        console.error("데이터 로딩 실패")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleOpenProject = async (project: ProjectWithStats) => {
    setSelectedProject(project)
    setLoadingAnalyses(true)
    try {
      const result = await getProjectAnalyses(project.id)
      if (result.data) {
        setProjectAnalyses(result.data as AnalysisItem[])
      }
    } catch {
      console.error("분석 목록 로딩 실패")
    } finally {
      setLoadingAnalyses(false)
    }
  }

  const handleOpenAnalysis = async (item: AnalysisItem) => {
    setSelectedAnalysis(item)
    if (detailData[item.id]) return

    setLoadingDetail(true)
    try {
      const result = await getAnalysisDetail(item.id)
      if (result.data) {
        setDetailData(prev => ({ ...prev, [item.id]: result.data as AnalysisItem }))
      }
    } catch {
      console.error("상세 데이터 로딩 실패")
    } finally {
      setLoadingDetail(false)
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
      if (subResult.data) setSubscription(subResult.data as Subscription)
    }
    setCancelling(false)
    setShowCancelConfirm(false)
  }

  const getPlanLabel = (plan: string) => {
    switch (plan) { case "free": return "무료 체험"; case "monthly": return "월 구독"; case "three_month": return "3개월 패스"; default: return plan }
  }
  const getStatusLabel = (status: string) => {
    switch (status) { case "active": return "이용중"; case "cancelled": return "해지됨"; case "expired": return "만료됨"; default: return status }
  }
  const getStatusColor = (status: string) => {
    switch (status) { case "active": return "text-green-400 bg-green-400/10"; case "cancelled": return "text-yellow-400 bg-yellow-400/10"; case "expired": return "text-red-400 bg-red-400/10"; default: return "text-slate-400 bg-slate-400/10" }
  }
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const formatShortDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })

  const isPaidPlan = subscription && subscription.plan !== "free"
  const detail = selectedAnalysis ? detailData[selectedAnalysis.id] : null

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
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8">
          <ArrowLeft className="w-4 h-4" /> 홈으로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-8">마이페이지</h1>

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
              <img src={user.avatar} alt="프로필" className="w-16 h-16 rounded-full border-2 border-[#1e3a5f]" />
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
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-slate-400 mb-1">현재 플랜</p><p className="text-white font-medium">{getPlanLabel(subscription.plan)}</p></div>
                <div><p className="text-sm text-slate-400 mb-1">시작일</p><p className="text-white font-medium">{formatDate(subscription.created_at)}</p></div>
                {subscription.expires_at && <div><p className="text-sm text-slate-400 mb-1">만료일</p><p className="text-white font-medium">{formatDate(subscription.expires_at)}</p></div>}
                {subscription.cancelled_at && <div><p className="text-sm text-slate-400 mb-1">해지일</p><p className="text-yellow-400 font-medium">{formatDate(subscription.cancelled_at)}</p></div>}
              </div>
              {subscription.plan === "free" && (
                <div className="bg-[#162a4a] rounded-lg p-4 border border-[#1e3a5f]">
                  <p className="text-sm text-slate-300">무료 플랜은 프로젝트 1개, 총 2회 분석이 가능합니다. 무제한 분석과 프리미엄 AI를 원하시면 구독을 시작해 주세요.</p>
                  <Button asChild className="mt-3 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white"><Link href="/pricing">요금제 보기</Link></Button>
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

        {/* ========== 프로젝트 인벤토리 ========== */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-6">
          {!selectedProject ? (
            <>
              {/* Level 1: 프로젝트 목록 */}
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Swords className="w-5 h-5 text-[#5B8DEF]" /> 프로젝트 인벤토리
                </h2>
                <span className="text-xs text-slate-500">{projects.length}개 프로젝트</span>
              </div>
              <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
                <Lock className="w-3 h-3" />
                <span>본인만 열람 가능 | 관리자 접근 불가</span>
              </div>

              {/* 등급 범례 */}
              {projects.some(p => p.best_score !== null) && (
                <div className="mb-5 flex flex-wrap gap-3 text-xs">
                  {[
                    { label: "S", range: "90+", color: "text-amber-400 border-amber-400/40" },
                    { label: "A", range: "80-89", color: "text-purple-400 border-purple-400/40" },
                    { label: "B", range: "70-79", color: "text-blue-400 border-blue-400/40" },
                    { label: "C", range: "60-69", color: "text-green-400 border-green-400/40" },
                    { label: "D", range: "~59", color: "text-slate-400 border-slate-400/40" },
                  ].map(g => (
                    <div key={g.label} className={`flex items-center gap-1.5 px-2 py-1 rounded border ${g.color}`}>
                      <span className="font-bold">{g.label}</span>
                      <span className="opacity-70">{g.range}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {/* 프로젝트 카드들 */}
                {projects.map(project => {
                  const grade = project.best_score !== null ? getGrade(project.best_score) : null
                  return (
                    <button
                      key={project.id}
                      onClick={() => handleOpenProject(project)}
                      className={`group relative bg-[#0d1b2a] rounded-xl border-2 ${grade ? grade.border : "border-[#1e3a5f]"} p-4
                        hover:shadow-lg ${grade ? grade.glow : ""} hover:scale-[1.03] transition-all duration-200
                        text-left flex flex-col min-h-[160px]`}
                    >
                      {/* 등급 배지 */}
                      {grade && (
                        <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br ${grade.color}
                          flex items-center justify-center text-white font-black text-sm shadow-lg`}>
                          {grade.label}
                        </div>
                      )}

                      {/* 폴더 아이콘 */}
                      <div className={`w-10 h-10 rounded-lg ${grade ? grade.bg : "bg-slate-800"} flex items-center justify-center mb-3`}>
                        <FolderOpen className={`w-5 h-5 ${grade ? grade.text : "text-slate-500"}`} />
                      </div>

                      {/* 프로젝트 이름 */}
                      <p className="text-white text-xs font-medium truncate w-full mb-1 pr-4">
                        {project.name}
                      </p>

                      {/* 통계 */}
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="w-3 h-3 text-slate-500" />
                        <span className="text-xs text-slate-500">{project.analysis_count}개 문서</span>
                      </div>

                      {project.best_score !== null && (
                        <div className="flex items-center gap-1 mb-1">
                          <Star className={`w-3.5 h-3.5 ${grade ? grade.text : "text-slate-500"}`} />
                          <span className={`font-bold text-sm ${grade ? grade.text : "text-slate-400"}`}>{project.best_score}</span>
                          <span className="text-slate-600 text-xs">최고</span>
                        </div>
                      )}

                      {/* 화살표 */}
                      <div className="mt-auto flex items-center gap-1 text-[10px] text-slate-600 group-hover:text-[#5B8DEF] transition-colors">
                        <span>열기</span>
                        <ChevronRight className="w-3 h-3" />
                      </div>
                    </button>
                  )
                })}

                {/* 잠긴 슬롯 (무료 플랜) */}
                {!isPaidPlan && projects.length >= 1 && [1, 2].map(i => (
                  <Link
                    key={`locked-${i}`}
                    href="/pricing"
                    className="relative bg-[#0d1b2a]/30 rounded-xl border-2 border-dashed border-slate-700/50 p-4
                      flex flex-col items-center justify-center min-h-[160px] group hover:border-amber-400/30 transition-colors"
                  >
                    <Lock className="w-8 h-8 text-slate-700 group-hover:text-amber-400/50 transition-colors mb-2" />
                    <p className="text-xs text-slate-700 group-hover:text-amber-400/70 font-medium transition-colors">구독 필요</p>
                    <p className="text-[10px] text-slate-800 group-hover:text-slate-600 mt-1 transition-colors">요금제 보기</p>
                  </Link>
                ))}

                {/* 빈 슬롯 (유료 플랜 또는 프로젝트 0개) */}
                {(isPaidPlan || projects.length === 0) && (
                  <Link
                    href="/analyze"
                    className="relative bg-[#0d1b2a]/50 rounded-xl border-2 border-dashed border-[#1e3a5f]/50 p-4
                      flex flex-col items-center justify-center min-h-[160px] hover:border-[#5B8DEF]/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center mb-2 group-hover:bg-[#5B8DEF]/10 transition-colors">
                      <Plus className="w-5 h-5 text-slate-700 group-hover:text-[#5B8DEF] transition-colors" />
                    </div>
                    <p className="text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors">새 프로젝트</p>
                  </Link>
                )}
              </div>

              {projects.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-2xl bg-[#162a4a] flex items-center justify-center mx-auto mb-4">
                    <Swords className="w-10 h-10 text-slate-600" />
                  </div>
                  <p className="text-slate-400 mb-1 font-medium">프로젝트가 비어있습니다</p>
                  <p className="text-slate-500 text-sm mb-6">문서를 분석하여 첫 번째 프로젝트를 만드세요!</p>
                  <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                    <Link href="/analyze">문서 분석하러 가기</Link>
                  </Button>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Level 2: 프로젝트 상세 (문서 인벤토리) */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setSelectedProject(null); setProjectAnalyses([]) }}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-[#5B8DEF]" />
                      {selectedProject.name}
                    </h2>
                    <p className="text-xs text-slate-500">{selectedProject.analysis_count}개 문서</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {projectAnalyses.length >= 2 && (
                    <Button
                      size="sm"
                      variant={showComparison ? "default" : "outline"}
                      onClick={() => setShowComparison(!showComparison)}
                      className={showComparison
                        ? "bg-purple-500 hover:bg-purple-600 text-white text-xs"
                        : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs"
                      }
                    >
                      <BarChart3 className="w-3.5 h-3.5 mr-1" /> 버전 비교
                    </Button>
                  )}
                  <Button asChild size="sm" className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white text-xs">
                    <Link href={`/analyze?projectId=${selectedProject.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> 새 버전 분석
                    </Link>
                  </Button>
                </div>
              </div>

              {loadingAnalyses ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
                </div>
              ) : projectAnalyses.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {projectAnalyses.map(item => {
                    const grade = getGrade(item.overall_score)
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleOpenAnalysis(item)}
                        className={`group relative bg-[#0d1b2a] rounded-xl border-2 ${grade.border} p-4
                          hover:shadow-lg ${grade.glow} hover:scale-[1.03] transition-all duration-200
                          text-left flex flex-col`}
                      >
                        <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br ${grade.color}
                          flex items-center justify-center text-white font-black text-sm shadow-lg`}>
                          {grade.label}
                        </div>
                        <div className={`w-10 h-10 rounded-lg ${grade.bg} flex items-center justify-center mb-3`}>
                          <FileText className={`w-5 h-5 ${grade.text}`} />
                        </div>
                        <p className="text-white text-xs font-medium truncate w-full mb-2 pr-4">
                          {item.file_name.replace(/\.(pdf|docx|txt)$/i, "")}
                        </p>
                        <div className="flex items-center gap-1 mb-1">
                          <Star className={`w-3.5 h-3.5 ${grade.text}`} />
                          <span className={`font-bold text-lg ${grade.text}`}>{item.overall_score}</span>
                          <span className="text-slate-600 text-xs">/100</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-auto">
                          <Calendar className="w-2.5 h-2.5" />
                          {formatShortDate(item.analyzed_at)}
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-1">아직 분석한 문서가 없습니다</p>
                  <Button asChild className="mt-4 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                    <Link href={`/analyze?projectId=${selectedProject.id}`}>문서 분석하기</Link>
                  </Button>
                </div>
              )}

              {/* 버전 비교 섹션 */}
              {showComparison && projectAnalyses.length >= 2 && (
                <div className="mt-6">
                  {isPaidPlan ? (
                    <div className="bg-slate-900/80 border border-purple-500/20 rounded-xl p-6">
                      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        버전별 점수 비교
                      </h3>
                      <VersionComparison analyses={projectAnalyses} />
                    </div>
                  ) : (
                    <div className="relative bg-slate-900/80 border border-[#1e3a5f] rounded-xl p-8 text-center">
                      <div className="absolute inset-0 bg-[#0d1b2a]/80 backdrop-blur-sm rounded-xl flex flex-col items-center justify-center z-10">
                        <Lock className="w-8 h-8 text-slate-500 mb-3" />
                        <p className="text-white font-medium mb-1">구독 시 이용 가능</p>
                        <p className="text-slate-400 text-sm mb-4">버전별 점수 비교 기능은 구독자 전용입니다.</p>
                        <Button asChild size="sm" className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                          <Link href="/pricing">요금제 보기</Link>
                        </Button>
                      </div>
                      <div className="opacity-20">
                        <div className="h-48 bg-slate-800 rounded-lg mb-4" />
                        <div className="h-32 bg-slate-800 rounded-lg" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ========== 분석 상세 모달 ========== */}
      {selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelectedAnalysis(null)} />
          <div className="relative w-full max-w-4xl mx-4 my-8 bg-[#0d1b2a] rounded-2xl border border-[#1e3a5f] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-10 bg-[#0d1b2a] rounded-t-2xl border-b border-[#1e3a5f] p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const grade = getGrade(selectedAnalysis.overall_score)
                  return (
                    <>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${grade.color} flex items-center justify-center text-white font-black text-lg`}>
                        {grade.label}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold text-lg truncate max-w-[300px] sm:max-w-[500px]">{selectedAnalysis.file_name}</h3>
                        <p className="text-slate-500 text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(selectedAnalysis.analyzed_at)}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
              <button onClick={() => setSelectedAnalysis(null)} className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {loadingDetail ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" /></div>
              ) : detail ? (
                <>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <ScoreCard score={detail.overall_score} ranking={detail.ranking} />
                    {detail.categories?.length > 0 && <RadarChartComponent data={detail.categories} />}
                  </div>
                  {detail.ranking && detail.ranking.total > 0 && (
                    <div className="bg-slate-900/80 rounded-xl border border-[#1e3a5f] p-6">
                      <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-400" /> 합격 포트폴리오 {detail.ranking.total}개 기준 랭킹
                      </h4>
                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="text-center py-4">
                          <p className="text-slate-400 text-sm mb-2">전체 랭킹</p>
                          <p className="text-5xl font-bold text-[#5B8DEF] mb-1">상위 {Math.max(1, 100 - detail.ranking.percentile)}%</p>
                        </div>
                        {detail.ranking.companyComparison?.length ? (
                          <div>
                            <p className="text-slate-400 text-sm mb-3">회사별 합격자 평균 비교</p>
                            <div className="space-y-2.5">
                              {detail.ranking.companyComparison.map((comp, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                  <span className="text-slate-300 text-xs w-20 truncate">{comp.company}</span>
                                  <div className="flex-1 bg-slate-800 rounded-full h-5 overflow-hidden relative">
                                    <div className="h-full bg-slate-600 rounded-full" style={{ width: `${Math.min(100, comp.avgScore)}%` }} />
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 font-medium">평균 {comp.avgScore}점</span>
                                  </div>
                                  <span className={`text-xs font-bold min-w-[40px] text-right ${detail.overall_score - comp.avgScore >= 0 ? "text-emerald-400" : "text-amber-400"}`}>
                                    {detail.overall_score - comp.avgScore >= 0 ? "+" : ""}{detail.overall_score - comp.avgScore}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  )}
                  {(detail.strengths?.length > 0 || detail.weaknesses?.length > 0) && (
                    <FeedbackCards strengths={detail.strengths || []} weaknesses={detail.weaknesses || []} />
                  )}
                  {detail.categories?.length > 0 && (
                    <DesignScores data={detail.categories} />
                  )}
                  {/* 문서 가독성 + 레이아웃 (PDF만) */}
                  {detail.analysis_source === "pdf" && detail.readability_categories && detail.readability_categories.length > 0 ? (
                    <>
                      <ReadabilityScores data={detail.readability_categories} />
                      {detail.layout_recommendations && detail.layout_recommendations.length > 0 && (
                        <LayoutRecommendations data={detail.layout_recommendations} />
                      )}
                    </>
                  ) : detail.analysis_source === "url" ? (
                    <div className="p-4 bg-slate-900/80 border border-[#1e3a5f] rounded-xl text-center">
                      <Eye className="w-6 h-6 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">PDF 파일을 업로드하면 문서의 시각적 가독성 분석과 레이아웃 개선 제안을 받을 수 있습니다</p>
                    </div>
                  ) : null}
                  {detail.company_feedback && (
                    <div className="p-4 bg-[#5B8DEF]/5 border border-[#5B8DEF]/20 rounded-xl">
                      <p className="text-sm text-slate-300 leading-relaxed">{detail.company_feedback}</p>
                    </div>
                  )}
                  {/* 다시 분석하기 버튼 */}
                  {selectedProject && (
                    <div className="flex justify-center pt-4">
                      <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                        <Link href={`/analyze?projectId=${selectedProject.id}`} onClick={() => setSelectedAnalysis(null)}>
                          수정본 다시 분석하기
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              ) : <p className="text-slate-400 text-center py-8">데이터를 불러올 수 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
