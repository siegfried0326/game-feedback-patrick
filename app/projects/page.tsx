/**
 * 프로젝트 페이지 (/projects)
 *
 * 기능:
 * - 프로젝트 인벤토리 (목록/생성/이름변경/삭제)
 * - 프로젝트별 분석 이력 조회
 * - 분석 결과 상세 보기 (ScoreCard, RadarChart, FeedbackCards 등)
 * - 버전 비교 차트 (2개 이상 분석이 있으면 자동 노출)
 *
 * /mypage는 구독/결제만 담당 (분리됨)
 */
"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Calendar, Star, Loader2, Lock, X, Trophy, Swords, FolderOpen, Plus, ChevronRight, BarChart3, Eye, Trash2, Pencil, MoreVertical, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSubscription, getProjects, getProjectAnalyses, getAnalysisDetail, deleteAnalysis, deleteProject, renameProject, createProject } from "@/app/actions/subscription"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { DesignScores } from "@/components/design-scores"
import { ReadabilityScores } from "@/components/readability-scores"
import { LayoutRecommendations } from "@/components/layout-recommendations"
import { VersionComparison } from "@/components/version-comparison"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

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

function getGrade(score: number) {
  if (score >= 90) return { label: "S", color: "from-amber-400 to-yellow-500", border: "border-amber-400/60", glow: "shadow-amber-400/20", text: "text-amber-400", bg: "bg-amber-400/10" }
  if (score >= 80) return { label: "A", color: "from-purple-400 to-violet-500", border: "border-purple-400/60", glow: "shadow-purple-400/20", text: "text-purple-400", bg: "bg-purple-400/10" }
  if (score >= 70) return { label: "B", color: "from-blue-400 to-cyan-500", border: "border-blue-400/60", glow: "shadow-blue-400/20", text: "text-blue-400", bg: "bg-blue-400/10" }
  if (score >= 60) return { label: "C", color: "from-green-400 to-emerald-500", border: "border-green-400/60", glow: "shadow-green-400/20", text: "text-green-400", bg: "bg-green-400/10" }
  return { label: "D", color: "from-slate-400 to-gray-500", border: "border-slate-400/60", glow: "shadow-slate-400/20", text: "text-slate-400", bg: "bg-slate-400/10" }
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [isPaidPlan, setIsPaidPlan] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Level 2: 프로젝트 상세
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null)
  const [projectAnalyses, setProjectAnalyses] = useState<AnalysisItem[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)

  // 그래프뷰: 2개 이상 분석이 있으면 기본 표시 (즉시 노출)
  const [showComparison, setShowComparison] = useState(true)

  // Level 3: 분석 상세 모달
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisItem | null>(null)
  const [detailData, setDetailData] = useState<Record<string, AnalysisItem>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 삭제/이름변경
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "project" | "analysis"; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // 프로젝트 생성
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creatingNewProject, setCreatingNewProject] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [subResult, projectsResult] = await Promise.all([
          getSubscription(),
          getProjects(),
        ])
        if (subResult.data) {
          const sub = subResult.data as { plan: string }
          setIsPaidPlan(sub.plan !== "free")
        }
        if (projectsResult.data) setProjects(projectsResult.data as ProjectWithStats[])
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
    // 2개 이상 분석이 있으면 그래프뷰 기본 표시
    setShowComparison(true)
    try {
      const result = await getProjectAnalyses(project.id)
      if (result.data) setProjectAnalyses(result.data as AnalysisItem[])
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
      if (result.data) setDetailData(prev => ({ ...prev, [item.id]: result.data as AnalysisItem }))
    } catch {
      console.error("상세 데이터 로딩 실패")
    } finally {
      setLoadingDetail(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    if (deleteConfirm.type === "analysis") {
      const result = await deleteAnalysis(deleteConfirm.id)
      if (result.error) setMessage({ type: "error", text: result.error })
      else {
        setProjectAnalyses(prev => prev.filter(a => a.id !== deleteConfirm.id))
        const projectsResult = await getProjects()
        if (projectsResult.data) {
          setProjects(projectsResult.data as ProjectWithStats[])
          if (selectedProject) {
            const updated = (projectsResult.data as ProjectWithStats[]).find(p => p.id === selectedProject.id)
            if (updated) setSelectedProject(updated)
          }
        }
        setMessage({ type: "success", text: "분석 결과가 삭제되었습니다." })
      }
    } else {
      const result = await deleteProject(deleteConfirm.id)
      if (result.error) setMessage({ type: "error", text: result.error })
      else {
        setProjects(prev => prev.filter(p => p.id !== deleteConfirm.id))
        setSelectedProject(null)
        setProjectAnalyses([])
        setMessage({ type: "success", text: "프로젝트가 삭제되었습니다." })
      }
    }
    setDeleting(false)
    setDeleteConfirm(null)
  }

  const handleRename = async (projectId: string) => {
    if (!renameValue.trim()) return
    const result = await renameProject(projectId, renameValue.trim())
    if (result.error) setMessage({ type: "error", text: result.error })
    else {
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, name: renameValue.trim() } : p))
      if (selectedProject?.id === projectId) {
        setSelectedProject(prev => prev ? { ...prev, name: renameValue.trim() } : prev)
      }
    }
    setRenamingProjectId(null)
    setRenameValue("")
  }

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    setCreatingNewProject(true)
    try {
      const result = await createProject(newProjectName.trim())
      if (result.data) {
        const newProject = { ...result.data, analysis_count: 0, best_score: null } as ProjectWithStats
        setProjects(prev => [newProject, ...prev])
        setShowNewProjectInput(false)
        setNewProjectName("")
        setMessage({ type: "success", text: "프로젝트가 생성되었습니다." })
      } else if (result.error) setMessage({ type: "error", text: result.error })
    } catch {
      setMessage({ type: "error", text: "프로젝트 생성에 실패했습니다." })
    } finally {
      setCreatingNewProject(false)
    }
  }

  const groupedAnalyses = useMemo(() => {
    const groups: Record<string, AnalysisItem[]> = {}
    projectAnalyses.forEach(item => {
      const baseName = item.file_name.replace(/\.(pdf|docx|txt)$/i, "")
      if (!groups[baseName]) groups[baseName] = []
      groups[baseName].push(item)
    })
    Object.values(groups).forEach(group => {
      group.sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime())
    })
    return Object.entries(groups).sort((a, b) => {
      const latestA = a[1][a[1].length - 1].analyzed_at
      const latestB = b[1][b[1].length - 1].analyzed_at
      return new Date(latestB).getTime() - new Date(latestA).getTime()
    })
  }, [projectAnalyses])

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })
  const formatShortDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })

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
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> 홈으로 돌아가기
          </Link>
          <Link href="/mypage" className="text-sm text-slate-400 hover:text-white transition-colors">
            구독·결제 →
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">프로젝트</h1>
        <p className="text-sm text-slate-400 mb-8">분석 결과를 프로젝트 단위로 저장·관리하고 버전별로 비교해보세요.</p>

        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${message.type === "success" ? "bg-green-400/10 border-green-400/30 text-green-400" : "bg-red-400/10 border-red-400/30 text-red-400"}`}>
            {message.text}
          </div>
        )}

        {/* 프로젝트 인벤토리 */}
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
                {projects.map(project => {
                  const grade = project.best_score !== null ? getGrade(project.best_score) : null
                  const isRenaming = renamingProjectId === project.id
                  return (
                    <div
                      key={project.id}
                      className={`group relative bg-[#0d1b2a] rounded-xl border-2 ${grade ? grade.border : "border-[#1e3a5f]"} p-4 hover:shadow-lg ${grade ? grade.glow : ""} transition-all duration-200 text-left flex flex-col min-h-[160px]`}
                    >
                      {grade && (
                        <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br ${grade.color} flex items-center justify-center text-white font-black text-sm shadow-lg`}>
                          {grade.label}
                        </div>
                      )}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-md hover:bg-slate-800 text-slate-500 hover:text-white transition-colors" onClick={(e) => e.stopPropagation()}>
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-[#0f1d32] border-[#1e3a5f] text-white min-w-[140px]">
                            <DropdownMenuItem className="text-slate-300 hover:text-white focus:text-white focus:bg-slate-800 cursor-pointer" onClick={(e) => { e.stopPropagation(); setRenamingProjectId(project.id); setRenameValue(project.name) }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> 이름 변경
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#1e3a5f]" />
                            <DropdownMenuItem className="text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10 cursor-pointer" onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "project", id: project.id, name: project.name }) }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> 삭제
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <button onClick={() => !isRenaming && handleOpenProject(project)} className="flex flex-col flex-1 text-left w-full" disabled={isRenaming}>
                        <div className={`w-10 h-10 rounded-lg ${grade ? grade.bg : "bg-slate-800"} flex items-center justify-center mb-3`}>
                          <FolderOpen className={`w-5 h-5 ${grade ? grade.text : "text-slate-500"}`} />
                        </div>
                        {isRenaming ? (
                          <div className="flex items-center gap-1 mb-1 w-full" onClick={(e) => e.stopPropagation()}>
                            <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(project.id); if (e.key === "Escape") { setRenamingProjectId(null); setRenameValue("") } }} autoFocus className="bg-slate-800 text-white text-xs rounded px-2 py-1 border border-[#5B8DEF] outline-none w-full" />
                            <button onClick={() => handleRename(project.id)} className="p-1 rounded hover:bg-slate-800 text-[#5B8DEF]">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-white text-xs font-medium truncate w-full mb-1 pr-4">{project.name}</p>
                        )}
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
                        <div className="mt-auto flex items-center gap-1 text-[10px] text-slate-600 group-hover:text-[#5B8DEF] transition-colors">
                          <span>열기</span>
                          <ChevronRight className="w-3 h-3" />
                        </div>
                      </button>
                    </div>
                  )
                })}

                {/* 잠긴 슬롯 (무료 플랜) */}
                {!isPaidPlan && projects.length >= 1 && [1, 2].map(i => (
                  <Link key={`locked-${i}`} href="/pricing" className="relative bg-[#0d1b2a]/30 rounded-xl border-2 border-dashed border-slate-700/50 p-4 flex flex-col items-center justify-center min-h-[160px] group hover:border-amber-400/30 transition-colors">
                    <Lock className="w-8 h-8 text-slate-700 group-hover:text-amber-400/50 transition-colors mb-2" />
                    <p className="text-xs text-slate-700 group-hover:text-amber-400/70 font-medium transition-colors">구독 필요</p>
                    <p className="text-[10px] text-slate-800 group-hover:text-slate-600 mt-1 transition-colors">요금제 보기</p>
                  </Link>
                ))}

                {(isPaidPlan || projects.length === 0) && (
                  showNewProjectInput ? (
                    <div className="relative bg-[#0d1b2a] rounded-xl border-2 border-[#5B8DEF] p-4 flex flex-col min-h-[160px]">
                      <p className="text-xs text-slate-400 mb-3">프로젝트 이름</p>
                      <input type="text" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); if (e.key === "Escape") { setShowNewProjectInput(false); setNewProjectName("") } }} placeholder="예: 넥슨 포트폴리오" autoFocus className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 border border-[#1e3a5f] focus:border-[#5B8DEF] outline-none mb-3 w-full" />
                      <div className="flex gap-2 mt-auto">
                        <Button onClick={handleCreateProject} disabled={creatingNewProject || !newProjectName.trim()} className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white text-xs px-3 py-1 h-7 flex-1">
                          {creatingNewProject ? <Loader2 className="w-3 h-3 animate-spin" /> : "생성"}
                        </Button>
                        <Button onClick={() => { setShowNewProjectInput(false); setNewProjectName("") }} variant="outline" className="border-[#1e3a5f] text-slate-400 text-xs px-3 py-1 h-7">취소</Button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowNewProjectInput(true)} className="relative bg-[#0d1b2a]/50 rounded-xl border-2 border-dashed border-[#1e3a5f]/50 p-4 flex flex-col items-center justify-center min-h-[160px] hover:border-[#5B8DEF]/30 transition-colors group">
                      <div className="w-10 h-10 rounded-lg bg-slate-800/50 flex items-center justify-center mb-2 group-hover:bg-[#5B8DEF]/10 transition-colors">
                        <Plus className="w-5 h-5 text-slate-700 group-hover:text-[#5B8DEF] transition-colors" />
                      </div>
                      <p className="text-[10px] text-slate-700 group-hover:text-slate-500 transition-colors">새 프로젝트</p>
                    </button>
                  )
                )}
              </div>

              {projects.length === 0 && !showNewProjectInput && (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-2xl bg-[#162a4a] flex items-center justify-center mx-auto mb-4">
                    <Swords className="w-10 h-10 text-slate-600" />
                  </div>
                  <p className="text-slate-400 mb-1 font-medium">프로젝트가 비어있습니다</p>
                  <p className="text-slate-500 text-sm mb-6">위의 + 버튼을 눌러 첫 프로젝트를 만드세요!</p>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Level 2: 프로젝트 상세 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => { setSelectedProject(null); setProjectAnalyses([]) }} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2">
                    {renamingProjectId === selectedProject.id ? (
                      <div className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-[#5B8DEF]" />
                        <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleRename(selectedProject.id); if (e.key === "Escape") { setRenamingProjectId(null); setRenameValue("") } }} autoFocus className="bg-slate-800 text-white text-lg font-semibold rounded px-2 py-1 border border-[#5B8DEF] outline-none" />
                        <button onClick={() => handleRename(selectedProject.id)} className="p-1 rounded hover:bg-slate-800 text-[#5B8DEF]">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setRenamingProjectId(null); setRenameValue("") }} className="p-1 rounded hover:bg-slate-800 text-slate-500">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FolderOpen className="w-5 h-5 text-[#5B8DEF]" />
                            {selectedProject.name}
                          </h2>
                          <button onClick={() => { setRenamingProjectId(selectedProject.id); setRenameValue(selectedProject.name) }} className="p-1 rounded hover:bg-slate-800 text-slate-600 hover:text-slate-300 transition-colors" title="이름 변경">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setDeleteConfirm({ type: "project", id: selectedProject.id, name: selectedProject.name })} className="p-1 rounded hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors" title="프로젝트 삭제">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-500">{projectAnalyses.length}개 문서</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {projectAnalyses.length >= 2 && (
                    <Button size="sm" variant={showComparison ? "default" : "outline"} onClick={() => setShowComparison(!showComparison)} className={showComparison ? "bg-purple-500 hover:bg-purple-600 text-white text-xs" : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs"}>
                      <BarChart3 className="w-3.5 h-3.5 mr-1" /> 그래프뷰 {showComparison ? "숨기기" : "보기"}
                    </Button>
                  )}
                  <Button asChild size="sm" className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white text-xs">
                    <Link href={`/analyze?projectId=${selectedProject.id}`}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> 문서 분석하기
                    </Link>
                  </Button>
                </div>
              </div>

              {/* 그래프뷰 (2개 이상일 때 즉시 표시) */}
              {showComparison && projectAnalyses.length >= 2 && (
                <div className="mb-6">
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

              {loadingAnalyses ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
                </div>
              ) : projectAnalyses.length > 0 ? (
                <div className="space-y-4">
                  {groupedAnalyses.map(([groupName, items]) => (
                    <div key={groupName}>
                      {items.length >= 2 && (
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span className="text-xs text-slate-400 font-medium">{groupName}</span>
                          <span className="text-[10px] text-slate-600">(v1~v{items.length})</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {items.map((item, versionIdx) => {
                          const grade = getGrade(item.overall_score)
                          return (
                            <div key={item.id} className={`group/card relative bg-[#0d1b2a] rounded-xl border-2 ${grade.border} p-4 hover:shadow-lg ${grade.glow} hover:scale-[1.03] transition-all duration-200 text-left flex flex-col`}>
                              <div className={`absolute -top-2 -right-2 w-8 h-8 rounded-lg bg-gradient-to-br ${grade.color} flex items-center justify-center text-white font-black text-sm shadow-lg`}>
                                {grade.label}
                              </div>
                              <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ type: "analysis", id: item.id, name: item.file_name }) }} className="absolute top-2 left-2 opacity-0 group-hover/card:opacity-100 p-1 rounded-md hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-all z-10" title="삭제">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleOpenAnalysis(item)} className="flex flex-col flex-1 text-left w-full">
                                <div className={`w-10 h-10 rounded-lg ${grade.bg} flex items-center justify-center mb-3`}>
                                  <FileText className={`w-5 h-5 ${grade.text}`} />
                                </div>
                                <p className="text-white text-xs font-medium truncate w-full mb-2 pr-4">
                                  {items.length >= 2 ? `v${versionIdx + 1}` : item.file_name.replace(/\.(pdf|docx|txt)$/i, "")}
                                </p>
                                {items.length >= 2 && (
                                  <p className="text-slate-500 text-[10px] truncate w-full mb-1">{item.file_name.replace(/\.(pdf|docx|txt)$/i, "")}</p>
                                )}
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
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
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
            </>
          )}
        </div>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-[#0f1d32] border-[#1e3a5f] text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">
              {deleteConfirm?.type === "project" ? "프로젝트를 삭제하시겠습니까?" : "분석 결과를 삭제하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400">
              {deleteConfirm?.type === "project"
                ? `'${deleteConfirm?.name}' 프로젝트와 포함된 모든 분석 결과가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
                : `'${deleteConfirm?.name}' 분석 결과가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-[#1e3a5f] text-slate-400 hover:text-white hover:bg-slate-800">취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-500 hover:bg-red-600 text-white">
              {deleting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 분석 상세 모달 */}
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
                  {detail.ranking && detail.ranking.total > 0 && (() => {
                    const userScore = detail.overall_score
                    const getRankGrade = (s: number) => {
                      if (s >= 90) return { label: "합격 가능", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", emoji: "🏆" }
                      if (s >= 80) return { label: "경쟁력 있음", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", emoji: "✅" }
                      if (s >= 70) return { label: "보완 필요", color: "text-[#5B8DEF]", bg: "bg-[#5B8DEF]/10 border-[#5B8DEF]/20", emoji: "📝" }
                      if (s >= 60) return { label: "개선 필요", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", emoji: "⚠️" }
                      return { label: "재작성 권장", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", emoji: "🔄" }
                    }
                    const rankGrade = getRankGrade(userScore)
                    return (
                      <div className="bg-gradient-to-br from-slate-900/80 to-[#0d1b2a] rounded-xl border border-[#5B8DEF]/30 p-6">
                        <h4 className="text-white font-semibold mb-4 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-400" /> 합격자 포트폴리오 {detail.ranking.total}개 중 내 위치
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="text-center p-4 bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 rounded-xl">
                            <p className="text-xs text-slate-400 mb-2">내 점수</p>
                            <p className="text-3xl font-bold text-[#5B8DEF]">
                              {userScore}<span className="text-base text-slate-400">점</span>
                            </p>
                          </div>
                          <div className={`text-center p-4 border rounded-xl ${rankGrade.bg}`}>
                            <p className="text-xs text-slate-400 mb-2">{detail.ranking.total}개 기준 평가</p>
                            <p className={`text-2xl font-bold ${rankGrade.color}`}>
                              {rankGrade.emoji} {rankGrade.label}
                            </p>
                          </div>
                        </div>
                        <div className="mb-6">
                          <p className="text-slate-400 text-sm mb-3">합격 가능성 등급</p>
                          <div className="flex gap-1">
                            {[
                              { label: "재작성 권장", range: "~59", color: "bg-red-500/30", textColor: "text-red-300", min: 0, max: 59 },
                              { label: "개선 필요", range: "60~69", color: "bg-amber-500/30", textColor: "text-amber-300", min: 60, max: 69 },
                              { label: "보완 필요", range: "70~79", color: "bg-[#5B8DEF]/30", textColor: "text-blue-300", min: 70, max: 79 },
                              { label: "경쟁력 있음", range: "80~89", color: "bg-emerald-500/30", textColor: "text-emerald-300", min: 80, max: 89 },
                              { label: "합격 가능", range: "90+", color: "bg-purple-500/30", textColor: "text-purple-300", min: 90, max: 100 },
                            ].map((g, i) => (
                              <div key={i} className={`flex-1 h-10 ${g.color} rounded flex items-center justify-center text-xs ${g.textColor} relative ${userScore >= g.min && userScore <= g.max ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}>
                                <span className="hidden sm:inline">{g.label}</span>
                                <span className="sm:hidden">{g.range}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-slate-500 mt-2 text-center">
                            내 점수 {userScore}점 · 재작성 권장 &lt; 개선 필요 &lt; 보완 필요 &lt; 경쟁력 있음 &lt; 합격 가능
                          </p>
                        </div>
                        {detail.company_feedback && (
                          <div>
                            <p className="text-white font-semibold text-sm mb-3">회사별 합격자 포트폴리오 특징 비교</p>
                            <div className="space-y-2">
                              {detail.company_feedback.split('\n\n').filter(Boolean).map((paragraph, idx) => {
                                const parts = paragraph.split(/\*\*(.*?)\*\*/)
                                return (
                                  <div key={idx} className="p-3 bg-slate-800/50 border border-[#1e3a5f]/50 rounded-xl">
                                    <p className="text-sm text-slate-300 leading-relaxed">
                                      {parts.map((part, i) =>
                                        i % 2 === 1
                                          ? <span key={i} className="text-[#5B8DEF] font-semibold">{part}</span>
                                          : <span key={i}>{part}</span>
                                      )}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                            <p className="text-xs text-slate-500 mt-3 text-center">
                              * 실제 합격 포트폴리오와 비교 분석 · 데이터는 지속 업데이트됩니다
                            </p>
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  {(detail.strengths?.length > 0 || detail.weaknesses?.length > 0) && (
                    <FeedbackCards strengths={detail.strengths || []} weaknesses={detail.weaknesses || []} />
                  )}
                  {detail.categories?.length > 0 && (
                    <DesignScores data={detail.categories} />
                  )}
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
