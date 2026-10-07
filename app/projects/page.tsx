/**
 * 프로젝트 페이지 (/projects)
 *
 * 2026-10-07 개편 — 분석은 프로젝트 없이 먼저 하고, 결과 화면의 '저장하기'로 프로젝트에 넣는다.
 * - 목록: 저장 안 한 분석(있으면) + 프로젝트 한 줄 목록 (이름·문서 수·최고점·최근일)
 * - 프로젝트 상세: 문서 목록 (문서명 · 버전 수 · 최신 점수 · 변화)
 * - 문서 상세: 그 문서의 버전별 점수 그래프 + 버전 목록 → 분석 상세 모달
 *   문서명은 사용자가 정한다 (analysis_history.document_name, scripts/022) — 파일명을 바꿔 올려도 같은 문서로 묶인다
 * - ?project=<id> 로 들어오면 그 프로젝트를 바로 연다 (저장 직후 이동)
 * 프로젝트는 무료 — 구독 시절의 잠금(슬롯·그래프) 제거
 */
"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { ArrowLeft, FileText, Calendar, Loader2, X, FolderOpen, Plus, ChevronRight, BarChart3, Eye, Trash2, Pencil, MoreVertical, Check, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getProjects, getProjectAnalyses, getAnalysisDetail, deleteAnalysis, deleteProject, renameProject, createProject, getUnsavedAnalyses, assignAnalysisToProject, setAnalysisDocument, renameDocument } from "@/app/actions/subscription"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { DesignScores } from "@/components/design-scores"
import { ReadabilityScores } from "@/components/readability-scores"
import { LayoutRecommendations } from "@/components/layout-recommendations"
import { VersionComparison } from "@/components/version-comparison"
import { CompanyFeedback } from "@/components/company-feedback"
import { GradeScale } from "@/components/grade-scale"
import { gradeOf } from "@/lib/analysis/grade"
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
  /** 프로젝트 안 문서 묶음 (scripts/022). 없으면 파일명으로 묶는다 */
  document_name?: string | null
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
  return gradeOf(score).text
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

  // 문서 (프로젝트 안)
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null)
  const [renamingDoc, setRenamingDoc] = useState(false)
  const [docRenameValue, setDocRenameValue] = useState("")
  const [showNewDoc, setShowNewDoc] = useState(false)
  const [newDocName, setNewDocName] = useState("")
  const [movingId, setMovingId] = useState<string | null>(null)
  const [moveTarget, setMoveTarget] = useState("")

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
    setSelectedDocument(null)
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

  const fileBase = (name: string) => name.replace(/\.(pdf|docx|pptx?|xlsx?|txt)$/i, "").trim()
  const docKey = (item: AnalysisItem) => item.document_name?.trim() || fileBase(item.file_name)

  // 문서별 묶음 — 버전은 오래된 순(v1 → vN)
  const documents = useMemo(() => {
    const groups: Record<string, AnalysisItem[]> = {}
    projectAnalyses.forEach(item => {
      const key = docKey(item)
      ;(groups[key] ||= []).push(item)
    })
    return Object.entries(groups)
      .map(([name, items]) => {
        const sorted = [...items].sort((a, b) => new Date(a.analyzed_at).getTime() - new Date(b.analyzed_at).getTime())
        const latest = sorted[sorted.length - 1]
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null
        return {
          name,
          items: sorted,
          latest,
          best: Math.max(...sorted.map(i => i.overall_score)),
          delta: prev ? latest.overall_score - prev.overall_score : null,
        }
      })
      .sort((a, b) => new Date(b.latest.analyzed_at).getTime() - new Date(a.latest.analyzed_at).getTime())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectAnalyses])

  const currentDoc = selectedDocument ? documents.find(d => d.name === selectedDocument) ?? null : null

  const reloadProject = async () => {
    if (!selectedProject) return
    const result = await getProjectAnalyses(selectedProject.id)
    if ("data" in result && result.data) setProjectAnalyses(result.data as AnalysisItem[])
  }

  const handleRenameDocument = async () => {
    if (!selectedProject || !currentDoc || !docRenameValue.trim()) return
    const res = await renameDocument(selectedProject.id, currentDoc.items.map(i => i.id), docRenameValue.trim())
    if ("error" in res && res.error) { setMessage({ type: "error", text: res.error }); return }
    await reloadProject()
    setSelectedDocument(docRenameValue.trim())
    setRenamingDoc(false)
  }

  const handleMoveVersion = async (analysisId: string) => {
    if (!moveTarget.trim()) return
    const res = await setAnalysisDocument(analysisId, moveTarget.trim())
    if ("error" in res && res.error) { setMessage({ type: "error", text: res.error }); return }
    await reloadProject()
    setMovingId(null)
    setMoveTarget("")
  }

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
                <Link href="/"><Plus className="w-4 h-4 mr-1" /> 분석하기</Link>
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
                  <Link href="/">분석하기</Link>
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
            {/* ── 프로젝트 상세 / 문서 상세 ── */}
            {!currentDoc ? (
              <>
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
                    <p className="text-sm text-muted-foreground mt-1">문서 {documents.length}개 · 분석 {projectAnalyses.length}회</p>
                  </div>
                  <Button asChild className="bg-primary hover:bg-primary/90 text-white shrink-0">
                    <Link href={`/analyze?projectId=${selectedProject.id}`}><Plus className="w-4 h-4 mr-1" /> 분석하기</Link>
                  </Button>
                </div>

                {loadingAnalyses ? (
                  <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 text-primary animate-spin" /></div>
                ) : (
                  <>
                    <h2 className="text-sm font-bold text-foreground mb-2">문서</h2>
                    {documents.length > 0 ? (
                      <div className="rounded-xl border border-border divide-y divide-border">
                        {documents.map(doc => (
                          <button
                            key={doc.name}
                            onClick={() => setSelectedDocument(doc.name)}
                            className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-secondary/60 transition-colors"
                          >
                            <FileText className="w-5 h-5 text-primary shrink-0" />
                            <span className="flex-1 min-w-0">
                              <span className="block text-sm font-bold text-foreground truncate">{doc.name}</span>
                              <span className="block text-xs text-muted-foreground">
                                버전 {doc.items.length}개 · 최고 {doc.best}점 · {formatShortDate(doc.latest.analyzed_at)}
                              </span>
                            </span>
                            {doc.delta !== null && doc.delta !== 0 && (
                              <span className={`text-xs font-semibold ${doc.delta > 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {doc.delta > 0 ? `+${doc.delta}` : doc.delta}
                              </span>
                            )}
                            <span className={`text-xl font-black ${scoreColor(doc.latest.overall_score)}`}>{doc.latest.overall_score}</span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-border text-center py-10 text-sm text-muted-foreground">
                        아직 이 프로젝트에 분석한 문서가 없어요
                      </div>
                    )}

                    {/* 문서 추가 — 문서명을 정하고 바로 그 문서로 분석 */}
                    {showNewDoc ? (
                      <div className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={newDocName}
                          onChange={(e) => setNewDocName(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing && newDocName.trim()) window.location.href = `/analyze?projectId=${selectedProject.id}&doc=${encodeURIComponent(newDocName.trim())}` }}
                          placeholder="문서명 (예: 레벨 디자인 기획서)"
                          maxLength={60}
                          autoFocus
                          className="flex-1 bg-card text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:border-primary outline-none"
                        />
                        <Button asChild disabled={!newDocName.trim()} className="bg-primary hover:bg-primary/90 text-white">
                          <Link href={newDocName.trim() ? `/analyze?projectId=${selectedProject.id}&doc=${encodeURIComponent(newDocName.trim())}` : "#"}>분석하기</Link>
                        </Button>
                        <Button variant="outline" onClick={() => { setShowNewDoc(false); setNewDocName("") }} className="border-border text-muted-foreground">취소</Button>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewDoc(true)} className="mt-3 text-sm text-primary hover:underline flex items-center gap-1">
                        <Plus className="w-4 h-4" /> 문서 추가
                      </button>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <button onClick={() => { setSelectedDocument(null); setRenamingDoc(false); setMovingId(null) }} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
                  <ArrowLeft className="w-4 h-4" /> {selectedProject.name}
                </button>

                <div className="flex items-start justify-between gap-4 mb-6">
                  <div className="min-w-0">
                    {renamingDoc ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={docRenameValue}
                          onChange={(e) => setDocRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleRenameDocument(); if (e.key === "Escape") setRenamingDoc(false) }}
                          maxLength={60}
                          autoFocus
                          className="bg-card text-foreground text-xl font-bold rounded-md px-2 py-1 border border-primary outline-none"
                        />
                        <button onClick={handleRenameDocument} className="p-1 rounded text-primary"><Check className="w-5 h-5" /></button>
                        <button onClick={() => setRenamingDoc(false)} className="p-1 rounded text-muted-foreground"><X className="w-5 h-5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <h1 className="text-2xl md:text-3xl font-black text-foreground truncate">{currentDoc.name}</h1>
                        <button onClick={() => { setRenamingDoc(true); setDocRenameValue(currentDoc.name) }} className="p-1 rounded text-muted-foreground/70 hover:text-foreground" title="문서명 변경">
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">버전 {currentDoc.items.length}개 · 최고 {currentDoc.best}점 · 최신 {currentDoc.latest.overall_score}점</p>
                  </div>
                  <Button asChild className="bg-primary hover:bg-primary/90 text-white shrink-0">
                    <Link href={`/analyze?projectId=${selectedProject.id}&doc=${encodeURIComponent(currentDoc.name)}`}><Plus className="w-4 h-4 mr-1" /> 분석하기</Link>
                  </Button>
                </div>

                {/* 이 문서의 버전별 점수 */}
                {currentDoc.items.length >= 2 ? (
                  <div className="mb-6 rounded-xl border border-border p-5">
                    <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-primary" /> 버전별 점수 변화
                    </h2>
                    <VersionComparison analyses={currentDoc.items} />
                  </div>
                ) : (
                  <p className="mb-6 text-sm text-muted-foreground rounded-xl bg-secondary px-4 py-3">
                    수정본을 이 문서로 한 번 더 분석하면 버전별 점수 그래프가 나와요.
                  </p>
                )}

                <h2 className="text-sm font-bold text-foreground mb-2">버전</h2>
                <div className="rounded-xl border border-border divide-y divide-border">
                  {[...currentDoc.items].reverse().map(item => {
                    const versionIdx = currentDoc.items.indexOf(item)
                    return (
                      <div key={item.id}>
                        <div className="group flex items-center gap-3 px-4 py-3 hover:bg-secondary/60 transition-colors">
                          <button onClick={() => handleOpenAnalysis(item)} className="flex-1 min-w-0 text-left flex items-center gap-3">
                            <span className="text-[11px] font-bold text-primary bg-accent rounded px-1.5 py-0.5 shrink-0">v{versionIdx + 1}</span>
                            <span className="min-w-0">
                              <span className="block text-sm text-foreground font-medium truncate">{item.file_name}</span>
                              <span className="block text-xs text-muted-foreground">{formatShortDate(item.analyzed_at)}</span>
                            </span>
                          </button>
                          <span className={`text-lg font-black ${scoreColor(item.overall_score)}`}>{item.overall_score}</span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary" aria-label="버전 메뉴">
                                <MoreVertical className="w-4 h-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-[160px]">
                              <DropdownMenuItem className="cursor-pointer" onClick={() => { setMovingId(item.id); setMoveTarget("") }}>
                                <FolderOpen className="w-3.5 h-3.5 mr-2" /> 다른 문서로 옮기기
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="cursor-pointer text-red-600 focus:text-red-700" onClick={() => setDeleteConfirm({ type: "analysis", id: item.id, name: item.file_name })}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> 삭제
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {movingId === item.id && (
                          <div className="px-4 pb-3 flex flex-wrap items-center gap-1.5">
                            <span className="text-xs text-muted-foreground mr-1">옮길 문서</span>
                            {documents.filter(d => d.name !== currentDoc.name).map(d => (
                              <button key={d.name} type="button" onClick={() => setMoveTarget(d.name)}
                                className={`text-xs rounded-full px-2.5 py-1 border ${moveTarget === d.name ? "bg-primary border-primary text-white" : "border-border text-foreground/80 hover:border-primary/50"}`}>
                                {d.name}
                              </button>
                            ))}
                            <input
                              type="text"
                              value={moveTarget}
                              onChange={e => setMoveTarget(e.target.value)}
                              placeholder="또는 새 문서명"
                              maxLength={60}
                              className="flex-1 min-w-[140px] bg-card text-foreground text-xs rounded-md px-2 py-1.5 border border-border focus:border-primary outline-none"
                            />
                            <Button size="sm" onClick={() => handleMoveVersion(item.id)} disabled={!moveTarget.trim()} className="bg-primary hover:bg-primary/90 text-white h-7">옮기기</Button>
                            <Button size="sm" variant="outline" onClick={() => setMovingId(null)} className="border-border text-muted-foreground h-7">취소</Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
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
                  {(() => {
                    const userScore = detail.overall_score
                    return (
                      <div className="rounded-xl border border-border p-6">
                        <h4 className="text-foreground font-semibold mb-4">합격 문서 기준 위치</h4>
                        <div className="mb-6"><GradeScale score={userScore} /></div>
                        {detail.company_feedback && (
                          <CompanyFeedback feedback={detail.company_feedback} targetCompany={(detail.ranking as { targetCompany?: string } | undefined)?.targetCompany} />
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
                        <Link href={`/analyze?projectId=${selectedProject.id}&doc=${encodeURIComponent(docKey(selectedAnalysis))}`} onClick={() => setSelectedAnalysis(null)}>
                          분석하기
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
