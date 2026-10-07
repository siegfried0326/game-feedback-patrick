/**
 * 프로젝트 페이지 (/projects)
 *
 * 2026-10-07 개편 — 분석은 프로젝트 없이 먼저 하고, 결과 화면의 '저장하기'로 프로젝트에 넣는다.
 * - 목록: 저장 안 한 분석(있으면) + 프로젝트 한 줄 목록 (이름·문서 수·최고점·최근일)
 * - 상세: 버전별 점수 그래프(2개 이상) + 분석 목록 → 분석 상세 모달
 * - ?project=<id> 로 들어오면 그 프로젝트를 바로 연다 (저장 직후 이동)
 * 프로젝트는 무료 — 구독 시절의 잠금(슬롯·그래프) 제거
 */
"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Calendar, Loader2, X, Trophy, FolderOpen, Plus, ChevronRight, BarChart3, Eye, Trash2, Pencil, MoreVertical, Check, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProjects, getProjectAnalyses, getAnalysisDetail, deleteAnalysis, deleteProject, renameProject, createProject, getUnsavedAnalyses, assignAnalysisToProject } from "@/app/actions/subscription"
import { BrandLogo } from "@/components/brand-logo"
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
  if (score >= 90) return { label: "S", color: "from-amber-400 to-yellow-500", border: "border-amber-500/60", glow: "shadow-amber-400/20", text: "text-amber-600", bg: "bg-amber-400/10" }
  if (score >= 80) return { label: "A", color: "from-purple-400 to-violet-500", border: "border-purple-500/60", glow: "shadow-purple-400/20", text: "text-purple-600", bg: "bg-purple-400/10" }
  if (score >= 70) return { label: "B", color: "from-blue-400 to-cyan-500", border: "border-blue-500/60", glow: "shadow-blue-400/20", text: "text-blue-600", bg: "bg-blue-400/10" }
  if (score >= 60) return { label: "C", color: "from-green-400 to-emerald-500", border: "border-green-500/60", glow: "shadow-green-400/20", text: "text-green-600", bg: "bg-green-400/10" }
  return { label: "D", color: "from-slate-400 to-gray-500", border: "border-slate-400/60", glow: "shadow-slate-400/20", text: "text-muted-foreground", bg: "bg-slate-400/10" }
}

type UnsavedItem = { id: string; file_name: string; overall_score: number; analyzed_at: string }

function scoreColor(score: number) {
  if (score >= 85) return "text-primary"
  if (score >= 70) return "text-foreground"
  if (score >= 60) return "text-amber-600"
  return "text-red-600"
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectWithStats[]>([])
  const [unsaved, setUnsaved] = useState<UnsavedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // 프로젝트 상세
  const [selectedProject, setSelectedProject] = useState<ProjectWithStats | null>(null)
  const [projectAnalyses, setProjectAnalyses] = useState<AnalysisItem[]>([])
  const [loadingAnalyses, setLoadingAnalyses] = useState(false)

  // 분석 상세 모달
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisItem | null>(null)
  const [detailData, setDetailData] = useState<Record<string, AnalysisItem>>({})
  const [loadingDetail, setLoadingDetail] = useState(false)

  // 삭제/이름변경
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "project" | "analysis"; id: string; name: string } | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")

  // 새 프로젝트
  const [showNewProjectInput, setShowNewProjectInput] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creatingNewProject, setCreatingNewProject] = useState(false)

  // 저장 안 한 분석 → 프로젝트에 넣기
  const [assigning, setAssigning] = useState<UnsavedItem | null>(null)
  const [assignTarget, setAssignTarget] = useState<string>("new")
  const [assignName, setAssignName] = useState("")
  const [assignBusy, setAssignBusy] = useState(false)

  const reloadLists = async () => {
    const [projectsResult, unsavedResult] = await Promise.all([getProjects(), getUnsavedAnalyses()])
    const list = (projectsResult.data ?? []) as ProjectWithStats[]
    setProjects(list)
    if (unsavedResult.data) setUnsaved(unsavedResult.data as UnsavedItem[])
    return list
  }

  useEffect(() => {
    async function loadData() {
      try {
        const list = await reloadLists()
        // 저장 직후 이동(?project=<id>) — 그 프로젝트를 바로 연다
        const wanted = new URLSearchParams(window.location.search).get("project")
        const target = wanted ? list.find(p => p.id === wanted) : null
        if (target) await handleOpenProject(target)
      } catch {
        console.error("데이터 로딩 실패")
      } finally {
        setLoading(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleOpenProject = async (project: ProjectWithStats) => {
    setSelectedProject(project)
    setLoadingAnalyses(true)
    try {
      const result = await getProjectAnalyses(project.id)
      if (result.data) setProjectAnalyses(result.data as AnalysisItem[])
    } catch {
      console.error("분석 목록 로딩 실패")
    } finally {
      setLoadingAnalyses(false)
    }
  }

  const handleOpenAnalysis = async (item: AnalysisItem | UnsavedItem) => {
    setSelectedAnalysis(item as AnalysisItem)
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
        setUnsaved(prev => prev.filter(a => a.id !== deleteConfirm.id))
        const list = await reloadLists()
        if (selectedProject) {
          const updated = list.find(p => p.id === selectedProject.id)
          if (updated) setSelectedProject(updated)
        }
        setMessage({ type: "success", text: "분석 결과를 삭제했어요." })
      }
    } else {
      const result = await deleteProject(deleteConfirm.id)
      if (result.error) setMessage({ type: "error", text: result.error })
      else {
        setProjects(prev => prev.filter(p => p.id !== deleteConfirm.id))
        setSelectedProject(null)
        setProjectAnalyses([])
        setMessage({ type: "success", text: "프로젝트를 삭제했어요." })
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
      } else if (result.error) setMessage({ type: "error", text: result.error })
    } catch {
      setMessage({ type: "error", text: "프로젝트를 만들지 못했어요." })
    } finally {
      setCreatingNewProject(false)
    }
  }

  const openAssign = (item: UnsavedItem) => {
    setAssigning(item)
    setAssignTarget(projects.length > 0 ? projects[0].id : "new")
    setAssignName(item.file_name.replace(/\.(pdf|docx|pptx?|xlsx?|txt)$/i, "").slice(0, 40))
  }

  const handleAssign = async () => {
    if (!assigning) return
    setAssignBusy(true)
    try {
      let projectId = assignTarget
      if (assignTarget === "new") {
        const created = await createProject(assignName.trim() || "내 포트폴리오")
        if (!created.data) { setMessage({ type: "error", text: created.error || "프로젝트를 만들지 못했어요." }); return }
        projectId = created.data.id
      }
      const res = await assignAnalysisToProject(assigning.id, projectId)
      if (res.error) { setMessage({ type: "error", text: res.error }); return }
      setAssigning(null)
      const list = await reloadLists()
      const target = list.find(p => p.id === projectId)
      if (target) await handleOpenProject(target)
    } finally {
      setAssignBusy(false)
    }
  }

  const groupedAnalyses = useMemo(() => {
    const groups: Record<string, AnalysisItem[]> = {}
    projectAnalyses.forEach(item => {
      const baseName = item.file_name.replace(/\.(pdf|docx|pptx?|xlsx?|txt)$/i, "")
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
      <main className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" aria-label="문라이트 아카이브 홈"><BrandLogo /></Link>
          <Link href="/mypage" className="text-sm text-muted-foreground hover:text-foreground transition-colors">마이페이지</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-10 pb-16">
        {message && (
          <div className={`mb-6 p-3 rounded-lg border text-sm ${message.type === "success" ? "bg-accent/50 border-primary/20 text-primary" : "bg-red-500/10 border-red-500/30 text-red-600"}`}>
            {message.text}
          </div>
        )}

        {!selectedProject ? (
          <>
            {/* ── 목록 ── */}
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-foreground">내 프로젝트</h1>
                <p className="text-sm text-muted-foreground mt-1">같은 문서의 수정본을 모아 점수 변화를 비교해요. 본인만 볼 수 있어요.</p>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 text-white shrink-0">
                <Link href="/"><Plus className="w-4 h-4 mr-1" /> 새 분석</Link>
              </Button>
            </div>

            {/* 저장 안 한 분석 */}
            {unsaved.length > 0 && (
              <section className="mb-8">
                <h2 className="text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
                  <Inbox className="w-4 h-4 text-primary" /> 저장 안 한 분석 <span className="text-muted-foreground font-medium">{unsaved.length}</span>
                </h2>
                <div className="rounded-xl border border-border divide-y divide-border">
                  {unsaved.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                      <button onClick={() => handleOpenAnalysis(item)} className="flex-1 min-w-0 text-left">
                        <p className="text-sm text-foreground font-medium truncate">{item.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatShortDate(item.analyzed_at)}</p>
                      </button>
                      <span className={`text-lg font-black ${scoreColor(item.overall_score)}`}>{item.overall_score}</span>
                      <Button size="sm" variant="outline" onClick={() => openAssign(item)} className="border-primary/40 text-primary hover:bg-accent/50 bg-transparent">
                        저장
                      </Button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* 프로젝트 목록 */}
            {projects.length > 0 ? (
              <div className="rounded-xl border border-border divide-y divide-border">
                {projects.map(project => {
                  const isRenaming = renamingProjectId === project.id
                  return (
                    <div key={project.id} className="group flex items-center gap-3 px-4 py-4 hover:bg-secondary/60 transition-colors">
                      <FolderOpen className="w-5 h-5 text-primary shrink-0" />
                      {isRenaming ? (
                        <div className="flex-1 flex items-center gap-2">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRename(project.id); if (e.key === "Escape") { setRenamingProjectId(null); setRenameValue("") } }}
                            autoFocus
                            className="flex-1 bg-card text-foreground text-sm rounded-md px-2 py-1 border border-primary outline-none"
                          />
                          <button onClick={() => handleRename(project.id)} className="p-1 rounded text-primary"><Check className="w-4 h-4" /></button>
                        </div>
                      ) : (
                        <button onClick={() => handleOpenProject(project)} className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-bold text-foreground truncate">{project.name}</p>
                          <p className="text-xs text-muted-foreground">
                            문서 {project.analysis_count}개
                            {project.best_score !== null && <> · 최고 <span className="font-semibold text-foreground">{project.best_score}점</span></>}
                            {project.latest_analyzed_at && <> · {formatShortDate(project.latest_analyzed_at)}</>}
                          </p>
                        </button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="프로젝트 메뉴">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[140px]">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => { setRenamingProjectId(project.id); setRenameValue(project.name) }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> 이름 변경
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700" onClick={() => setDeleteConfirm({ type: "project", id: project.id, name: project.name })}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> 삭제
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {!isRenaming && <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />}
                    </div>
                  )
                })}
              </div>
            ) : unsaved.length === 0 && (
              <div className="rounded-xl border border-dashed border-border text-center py-14 px-6">
                <FolderOpen className="w-10 h-10 text-primary/40 mx-auto mb-3" />
                <p className="text-foreground font-semibold mb-1">아직 저장한 프로젝트가 없어요</p>
                <p className="text-sm text-muted-foreground mb-5">문서를 분석한 뒤 결과 화면에서 &apos;저장하기&apos;를 누르면 여기에 모여요.</p>
                <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                  <Link href="/">문서 분석하러 가기</Link>
                </Button>
              </div>
            )}

            {/* 새 프로젝트 */}
            {projects.length > 0 && (
              showNewProjectInput ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleCreateProject(); if (e.key === "Escape") { setShowNewProjectInput(false); setNewProjectName("") } }}
                    placeholder="새 프로젝트 이름"
                    maxLength={40}
                    autoFocus
                    className="flex-1 bg-card text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:border-primary outline-none"
                  />
                  <Button onClick={handleCreateProject} disabled={creatingNewProject || !newProjectName.trim()} className="bg-primary hover:bg-primary/90 text-white">
                    {creatingNewProject ? <Loader2 className="w-4 h-4 animate-spin" /> : "만들기"}
                  </Button>
                  <Button variant="outline" onClick={() => { setShowNewProjectInput(false); setNewProjectName("") }} className="border-border text-muted-foreground">취소</Button>
                </div>
              ) : (
                <button onClick={() => setShowNewProjectInput(true)} className="mt-3 text-sm text-primary hover:underline flex items-center gap-1">
                  <Plus className="w-4 h-4" /> 새 프로젝트
                </button>
              )
            )}
          </>
        ) : (
          <>
            {/* ── 프로젝트 상세 ── */}
            <button onClick={() => { setSelectedProject(null); setProjectAnalyses([]) }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
              <ArrowLeft className="w-4 h-4" /> 내 프로젝트
            </button>

            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="min-w-0">
                {renamingProjectId === selectedProject.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRename(selectedProject.id); if (e.key === "Escape") { setRenamingProjectId(null); setRenameValue("") } }}
                      autoFocus
                      className="bg-card text-foreground text-xl font-bold rounded-md px-2 py-1 border border-primary outline-none"
                    />
                    <button onClick={() => handleRename(selectedProject.id)} className="p-1 rounded text-primary"><Check className="w-5 h-5" /></button>
                    <button onClick={() => { setRenamingProjectId(null); setRenameValue("") }} className="p-1 rounded text-muted-foreground"><X className="w-5 h-5" /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">{selectedProject.name}</h1>
                    <button onClick={() => { setRenamingProjectId(selectedProject.id); setRenameValue(selectedProject.name) }} className="p-1 rounded text-muted-foreground/70 hover:text-foreground" title="이름 변경">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm({ type: "project", id: selectedProject.id, name: selectedProject.name })} className="p-1 rounded text-muted-foreground/70 hover:text-red-600" title="프로젝트 삭제">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-sm text-muted-foreground mt-1">문서 {projectAnalyses.length}개{selectedProject.best_score !== null && ` · 최고 ${selectedProject.best_score}점`}</p>
              </div>
              <Button asChild className="bg-primary hover:bg-primary/90 text-white shrink-0">
                <Link href={`/analyze?projectId=${selectedProject.id}`}><Plus className="w-4 h-4 mr-1" /> 수정본 분석</Link>
              </Button>
            </div>

            {/* 버전별 점수 (2개 이상) */}
            {projectAnalyses.length >= 2 && (
              <div className="mb-6 rounded-xl border border-border p-5">
                <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-primary" /> 버전별 점수 변화
                </h2>
                <VersionComparison analyses={projectAnalyses} />
              </div>
            )}

            {loadingAnalyses ? (
              <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
            ) : projectAnalyses.length > 0 ? (
              <div className="space-y-5">
                {groupedAnalyses.map(([groupName, items]) => (
                  <div key={groupName}>
                    {items.length >= 2 && (
                      <p className="text-xs text-muted-foreground font-medium mb-1.5 px-1">{groupName} · 수정본 {items.length}개</p>
                    )}
                    <div className="rounded-xl border border-border divide-y divide-border">
                      {[...items].reverse().map((item) => {
                        const versionIdx = items.indexOf(item)
                        return (
                          <div key={item.id} className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors">
                            <button onClick={() => handleOpenAnalysis(item)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                              {items.length >= 2 && (
                                <span className="text-[11px] font-bold text-primary bg-accent rounded px-1.5 py-0.5 shrink-0">v{versionIdx + 1}</span>
                              )}
                              <span className="min-w-0">
                                <span className="block text-sm text-foreground font-medium truncate">{item.file_name}</span>
                                <span className="block text-xs text-muted-foreground">{formatShortDate(item.analyzed_at)}</span>
                              </span>
                            </button>
                            <span className={`text-lg font-black ${scoreColor(item.overall_score)}`}>{item.overall_score}</span>
                            <button onClick={() => setDeleteConfirm({ type: "analysis", id: item.id, name: item.file_name })} className="p-1 rounded text-muted-foreground/50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="삭제">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border text-center py-12">
                <FileText className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-muted-foreground mb-4">아직 이 프로젝트에 분석한 문서가 없어요</p>
                <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                  <Link href={`/analyze?projectId=${selectedProject.id}`}>문서 분석하기</Link>
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 저장 안 한 분석 → 프로젝트에 저장 */}
      {assigning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4" onClick={() => !assignBusy && setAssigning(null)}>
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-black text-foreground mb-1">{projects.length === 0 ? "프로젝트를 만드세요" : "어느 프로젝트에 저장할까요?"}</h3>
            <p className="text-sm text-muted-foreground mb-4 truncate">{assigning.file_name}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto mb-5">
              {projects.map(project => (
                <label key={project.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer ${assignTarget === project.id ? "border-primary bg-accent/50" : "border-border hover:border-primary/40"}`}>
                  <span className="flex items-center gap-2 min-w-0">
                    <input type="radio" name="assign-target" checked={assignTarget === project.id} onChange={() => setAssignTarget(project.id)} className="accent-[#0046AD]" />
                    <span className="text-sm text-foreground font-medium truncate">{project.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{project.analysis_count}개 분석</span>
                </label>
              ))}
              <label className={`block p-3 rounded-lg border cursor-pointer ${assignTarget === "new" ? "border-primary bg-accent/50" : "border-dashed border-border hover:border-primary/40"}`}>
                <span className="flex items-center gap-2">
                  <input type="radio" name="assign-target" checked={assignTarget === "new"} onChange={() => setAssignTarget("new")} className="accent-[#0046AD]" />
                  <span className="text-sm text-foreground font-medium">새 프로젝트</span>
                </span>
                {assignTarget === "new" && (
                  <input type="text" value={assignName} onChange={e => setAssignName(e.target.value)} maxLength={40} autoFocus placeholder="예: 넥슨 지원용 포트폴리오"
                    className="mt-2 w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary" />
                )}
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAssigning(null)} disabled={assignBusy} className="flex-1 border-border text-muted-foreground">취소</Button>
              <Button onClick={handleAssign} disabled={assignBusy || (assignTarget === "new" && !assignName.trim())} className="flex-1 bg-primary hover:bg-primary/90 text-white">
                {assignBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : assignTarget === "new" ? "만들고 저장" : "저장하기"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="bg-secondary border-border text-foreground max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              {deleteConfirm?.type === "project" ? "프로젝트를 삭제하시겠습니까?" : "분석 결과를 삭제하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {deleteConfirm?.type === "project"
                ? `'${deleteConfirm?.name}' 프로젝트와 포함된 모든 분석 결과가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`
                : `'${deleteConfirm?.name}' 분석 결과가 영구 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-transparent border-border text-muted-foreground hover:text-foreground hover:bg-secondary">취소</AlertDialogCancel>
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
          <div className="relative w-full max-w-4xl mx-4 my-8 bg-secondary rounded-2xl border border-border shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="sticky top-0 z-10 bg-secondary rounded-t-2xl border-b border-border p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {(() => {
                  const grade = getGrade(selectedAnalysis.overall_score)
                  return (
                    <>
                      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${grade.color} flex items-center justify-center text-white font-black text-lg`}>
                        {grade.label}
                      </div>
                      <div>
                        <h3 className="text-foreground font-semibold text-lg truncate max-w-[300px] sm:max-w-[500px]">{selectedAnalysis.file_name}</h3>
                        <p className="text-muted-foreground text-xs flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {formatDate(selectedAnalysis.analyzed_at)}
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
              <button onClick={() => setSelectedAnalysis(null)} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {loadingDetail ? (
                <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
              ) : detail ? (
                <>
                  <div className="grid lg:grid-cols-2 gap-6">
                    <ScoreCard score={detail.overall_score} ranking={detail.ranking} />
                    {detail.categories?.length > 0 && <RadarChartComponent data={detail.categories} />}
                  </div>
                  {detail.ranking && detail.ranking.total > 0 && (() => {
                    const userScore = detail.overall_score
                    const getRankGrade = (s: number) => {
                      if (s >= 90) return { label: "합격 가능", color: "text-purple-600", bg: "bg-purple-500/10 border-purple-500/20", emoji: "🏆" }
                      if (s >= 80) return { label: "경쟁력 있음", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20", emoji: "✅" }
                      if (s >= 70) return { label: "보완 필요", color: "text-primary", bg: "bg-primary/10 border-primary/20", emoji: "📝" }
                      if (s >= 60) return { label: "개선 필요", color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/20", emoji: "⚠️" }
                      return { label: "재작성 권장", color: "text-red-600", bg: "bg-red-500/10 border-red-500/20", emoji: "🔄" }
                    }
                    const rankGrade = getRankGrade(userScore)
                    return (
                      <div className="bg-gradient-to-br from-secondary to-secondary rounded-xl border border-primary/30 p-6">
                        <h4 className="text-foreground font-semibold mb-4 flex items-center gap-2">
                          <Trophy className="w-5 h-5 text-amber-600" /> 합격자 포트폴리오 {detail.ranking.total}개 중 내 위치
                        </h4>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                          <div className="text-center p-4 bg-primary/10 border border-primary/20 rounded-xl">
                            <p className="text-xs text-muted-foreground mb-2">내 점수</p>
                            <p className="text-3xl font-bold text-primary">
                              {userScore}<span className="text-base text-muted-foreground">점</span>
                            </p>
                          </div>
                          <div className={`text-center p-4 border rounded-xl ${rankGrade.bg}`}>
                            <p className="text-xs text-muted-foreground mb-2">{detail.ranking.total}개 기준 평가</p>
                            <p className={`text-2xl font-bold ${rankGrade.color}`}>
                              {rankGrade.emoji} {rankGrade.label}
                            </p>
                          </div>
                        </div>
                        <div className="mb-6">
                          <p className="text-muted-foreground text-sm mb-3">합격 가능성 등급</p>
                          <div className="flex gap-1">
                            {[
                              { label: "재작성 권장", range: "~59", color: "bg-red-500/30", textColor: "text-red-700", min: 0, max: 59 },
                              { label: "개선 필요", range: "60~69", color: "bg-amber-500/30", textColor: "text-amber-700", min: 60, max: 69 },
                              { label: "보완 필요", range: "70~79", color: "bg-primary/30", textColor: "text-blue-700", min: 70, max: 79 },
                              { label: "경쟁력 있음", range: "80~89", color: "bg-emerald-500/30", textColor: "text-emerald-700", min: 80, max: 89 },
                              { label: "합격 가능", range: "90+", color: "bg-purple-500/30", textColor: "text-purple-700", min: 90, max: 100 },
                            ].map((g, i) => (
                              <div key={i} className={`flex-1 h-10 ${g.color} rounded flex items-center justify-center text-xs ${g.textColor} relative ${userScore >= g.min && userScore <= g.max ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}>
                                <span className="hidden sm:inline">{g.label}</span>
                                <span className="sm:hidden">{g.range}</span>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-2 text-center">
                            내 점수 {userScore}점 · 재작성 권장 &lt; 개선 필요 &lt; 보완 필요 &lt; 경쟁력 있음 &lt; 합격 가능
                          </p>
                        </div>
                        {detail.company_feedback && (
                          <div>
                            <p className="text-foreground font-semibold text-sm mb-3">회사별 합격자 포트폴리오 특징 비교</p>
                            <div className="space-y-2">
                              {detail.company_feedback.split('\n\n').filter(Boolean).map((paragraph, idx) => {
                                const parts = paragraph.split(/\*\*(.*?)\*\*/)
                                return (
                                  <div key={idx} className="p-3 bg-secondary border border-border/50 rounded-xl">
                                    <p className="text-sm text-foreground/80 leading-relaxed">
                                      {parts.map((part, i) =>
                                        i % 2 === 1
                                          ? <span key={i} className="text-primary font-semibold">{part}</span>
                                          : <span key={i}>{part}</span>
                                      )}
                                    </p>
                                  </div>
                                )
                              })}
                            </div>
                            <p className="text-xs text-muted-foreground mt-3 text-center">
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
                    <div className="p-4 bg-card border border-border rounded-xl text-center">
                      <Eye className="w-6 h-6 text-muted-foreground/80 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">PDF 파일을 업로드하면 문서의 시각적 가독성 분석과 레이아웃 개선 제안을 받을 수 있습니다</p>
                    </div>
                  ) : null}
                  {selectedProject && (
                    <div className="flex justify-center pt-4">
                      <Button asChild className="bg-primary hover:bg-primary/90 text-white">
                        <Link href={`/analyze?projectId=${selectedProject.id}`} onClick={() => setSelectedAnalysis(null)}>
                          수정본 다시 분석하기
                        </Link>
                      </Button>
                    </div>
                  )}
                </>
              ) : <p className="text-muted-foreground text-center py-8">데이터를 불러올 수 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
