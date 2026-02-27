"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Lock, Shield, FolderOpen, Plus, ArrowRight, Link2, Globe, Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { DesignScores } from "@/components/design-scores"
import { ReadabilityScores } from "@/components/readability-scores"
import { LayoutRecommendations } from "@/components/layout-recommendations"
import { analyzeDocumentDirect, analyzeUrlDirect, deleteFileFromStorage, checkBeforeAnalysis } from "@/app/actions/analyze"
import { getProjects, createProject, checkProjectAllowance } from "@/app/actions/subscription"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import Link from "next/link"
import { useSearchParams, useRouter } from "next/navigation"

type Project = {
  id: string
  name: string
  analysis_count: number
  best_score: number | null
}

type ReadabilityCategory = {
  subject: string
  value: number
  fullMark: number
  feedback?: string
}

type LayoutSection = {
  label: string
  x: number
  y: number
  w: number
  h: number
  color: string
}

type LayoutRecommendation = {
  pageOrSection: string
  currentDescription: string
  recommendedDescription: string
  currentLayout: { sections: LayoutSection[] }
  recommendedLayout: { sections: LayoutSection[] }
}

type AnalysisResult = {
  fileName: string
  score: number
  categories: {
    subject: string
    value: number
    fullMark: number
    feedback?: string
  }[]
  strengths: string[]
  weaknesses: string[]
  detailedFeedback?: string
  companyFeedback?: string
  analysisSource?: "pdf" | "url"
  readabilityCategories?: ReadabilityCategory[]
  layoutRecommendations?: LayoutRecommendation[]
  ranking?: {
    total: number
    percentile: number
    rank?: number
    companyComparison?: {
      company: string
      avgScore: number
      userScore: number
      sampleCount?: number
    }[]
  }
}

type FileStatus = {
  file: File
  status: "pending" | "uploading" | "analyzing" | "success" | "error"
  result?: AnalysisResult
  error?: string
}

const MAX_FILES = 1

function getGrade(score: number): { grade: string; color: string } {
  if (score >= 90) return { grade: "S", color: "bg-purple-500" }
  if (score >= 80) return { grade: "A", color: "bg-emerald-500" }
  if (score >= 70) return { grade: "B", color: "bg-blue-500" }
  if (score >= 60) return { grade: "C", color: "bg-amber-500" }
  return { grade: "D", color: "bg-red-500" }
}

export function AnalyzeDashboard() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const preselectedProjectId = searchParams.get("projectId")

  const [files, setFiles] = useState<FileStatus[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showCreditError, setShowCreditError] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const [allowanceInfo, setAllowanceInfo] = useState<{
    allowed: boolean
    reason?: string
    plan?: string
    remaining?: number
    unlimited?: boolean
  } | null>(null)
  const [checkingAllowance, setCheckingAllowance] = useState(true)

  // 프로젝트 관련 상태
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(preselectedProjectId)
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProjectName, setNewProjectName] = useState("")
  const [creatingProject, setCreatingProject] = useState(false)
  const [canCreateProject, setCanCreateProject] = useState(true)
  const [uploadMode, setUploadMode] = useState<"file" | "url">("file")
  const [urlInput, setUrlInput] = useState("")
  const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)
  const isLoggedIn = allowanceInfo?.reason !== "login_required"

  // 분석 중 로딩 메시지 (순서대로 표시)
  const loadingMessages = [
    "문서 내용을 꼼꼼히 살펴보는 중...",
    "논리 구조와 흐름을 분석하는 중...",
    "게임 디자인 역량을 평가하는 중...",
    "넥슨 합격자 포트폴리오와 비교하는 중...",
    "엔씨소프트 합격자 포트폴리오와 비교하는 중...",
    "넷마블 합격자 포트폴리오와 비교하는 중...",
    "크래프톤 합격자 포트폴리오와 비교하는 중...",
    "펄어비스 합격자 포트폴리오와 비교하는 중...",
    "스마일게이트 합격자 포트폴리오와 비교하는 중...",
    "강점과 보완점을 정리하는 중...",
    "최종 점수를 계산하는 중...",
  ]

  // 시간 기반 진행률 (0~90%까지 천천히, 완료 시 100%)
  const [fakeProgress, setFakeProgress] = useState(0)

  useEffect(() => {
    if (!isAnalyzing) {
      setStatusMessage("")
      setFakeProgress(0)
      return
    }
    // 메시지를 순서대로 표시
    let msgIndex = 0
    setStatusMessage(loadingMessages[0])
    const msgTimer = setInterval(() => {
      msgIndex++
      if (msgIndex < loadingMessages.length) {
        setStatusMessage(loadingMessages[msgIndex])
      }
    }, 5000)

    // 진행률: 0 → 90%까지 60초에 걸쳐 서서히 증가
    setFakeProgress(5)
    const progressTimer = setInterval(() => {
      setFakeProgress(prev => {
        if (prev >= 90) return 90 // 90%에서 멈춤 (완료 전까지)
        // 처음엔 빠르게, 나중엔 느리게
        const increment = prev < 30 ? 3 : prev < 60 ? 2 : 0.5
        return Math.min(prev + increment, 90)
      })
    }, 1000)

    return () => {
      clearInterval(msgTimer)
      clearInterval(progressTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing])

  // 페이지 로드 시 구독 상태 + 프로젝트 목록 체크
  useEffect(() => {
    async function init() {
      try {
        const allowanceResult = await checkBeforeAnalysis()

        if (allowanceResult.reason === "login_required") {
          // 비로그인: 페이지는 보여주되 분석 시 로그인 유도
          setAllowanceInfo({ allowed: false, reason: "login_required" })
          setCheckingAllowance(false)
          return
        }

        setAllowanceInfo(allowanceResult)

        const [projectsResult, projectAllowance] = await Promise.all([
          getProjects(),
          checkProjectAllowance(),
        ])

        if (projectsResult.data) {
          setProjects(projectsResult.data as Project[])
          // preselected가 없으면 가장 최근(첫 번째) 프로젝트 자동 선택
          if (!preselectedProjectId && projectsResult.data.length > 0) {
            setSelectedProjectId(projectsResult.data[0].id)
          }
        }

        setCanCreateProject(projectAllowance.allowed)
      } catch {
        setAllowanceInfo({ allowed: true })
      } finally {
        setCheckingAllowance(false)
      }
    }
    init()
  }, [preselectedProjectId])

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return
    setCreatingProject(true)
    try {
      const result = await createProject(newProjectName.trim())
      if (result.data) {
        const newProject = { ...result.data, analysis_count: 0, best_score: null } as Project
        setProjects(prev => [newProject, ...prev])
        setSelectedProjectId(result.data.id)
        setShowNewProject(false)
        setNewProjectName("")
        setCanCreateProject(false) // 무료 플랜이면 더 이상 생성 불가
      } else if (result.error) {
        setError(result.error)
      }
    } catch {
      setError("프로젝트 생성에 실패했습니다.")
    } finally {
      setCreatingProject(false)
    }
  }

  // 여러 파일 분석
  const handleAnalyzeFiles = async (filesToAnalyze: FileStatus[]) => {
    if (!selectedProjectId) {
      setError("프로젝트를 먼저 선택해 주세요.")
      return
    }

    setIsAnalyzing(true)
    setError(null)
    setResults([])
    setCurrentIndex(0)

    const newResults: AnalysisResult[] = []

    for (let i = 0; i < filesToAnalyze.length; i++) {
      const fileStatus = filesToAnalyze[i]
      setCurrentIndex(i)

      try {
        setStatusMessage("파일을 업로드하는 중...")
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading" } : f
        ))

        // 파일 타입 체크
        const allowedTypes = [
          "application/pdf",
          "image/jpeg", "image/png", "image/webp",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/vnd.ms-powerpoint",
          "text/plain",
        ]
        if (!allowedTypes.includes(fileStatus.file.type)) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: "지원하지 않는 파일 형식입니다." } : f
          ))
          continue
        }
        if (fileStatus.file.size > 200 * 1024 * 1024) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: "파일 크기는 200MB를 초과할 수 없습니다." } : f
          ))
          continue
        }

        // 클라이언트에서 Supabase Storage로 직접 업로드
        const supabase = createClient()
        const fileExt = fileStatus.file.name.split(".").pop()
        const uniqueFileName = `${uuidv4()}.${fileExt}`
        const filePath = `uploads/${uniqueFileName}`

        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(filePath, fileStatus.file, {
            contentType: fileStatus.file.type,
            upsert: false,
          })

        if (uploadError) {
          console.error("Upload error:", uploadError)
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: "파일 업로드에 실패했습니다." } : f
          ))
          continue
        }

        const { data: urlData } = supabase.storage
          .from("resumes")
          .getPublicUrl(filePath)

        const uploadResult = {
          data: {
            fileName: fileStatus.file.name,
            filePath,
            fileUrl: urlData.publicUrl,
            mimeType: fileStatus.file.type,
          }
        }

        // 로딩 메시지는 useEffect에서 자동 순환
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "analyzing" } : f
        ))

        const analysisResult = await analyzeDocumentDirect({
          projectId: selectedProjectId,
          fileName: uploadResult.data!.fileName,
          fileUrl: uploadResult.data!.fileUrl,
          mimeType: uploadResult.data!.mimeType,
          filePath: uploadResult.data!.filePath,
        })

        if (analysisResult.error) {
          await deleteFileFromStorage(uploadResult.data!.filePath)
          if (analysisResult.error === "CREDIT_LIMIT_EXCEEDED") {
            setShowCreditError(true)
            setFiles(prev => prev.map((f, idx) =>
              idx === i ? { ...f, status: "error", error: "서비스 점검 중" } : f
            ))
            break
          }
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: analysisResult.error } : f
          ))
        } else {
          const result = {
            ...analysisResult.data,
            fileName: fileStatus.file.name
          } as AnalysisResult

          newResults.push(result)
          setResults([...newResults])

          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "success", result } : f
          ))
        }
      } catch (err) {
        console.error("Analysis error:", err)
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "error", error: "분석 실패" } : f
        ))
      }

      if (i < filesToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setStatusMessage("")
    setIsAnalyzing(false)
    // 결과 영역으로 스크롤
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 200)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (isAnalyzing) return // 분석 중에는 새 파일 업로드 차단
    if (!isLoggedIn) {
      router.push("/login?redirect=/analyze")
      return
    }
    if (!selectedProjectId) {
      setError("프로젝트를 먼저 선택해 주세요.")
      return
    }
    if (acceptedFiles.length > 0) {
      const filesToAdd = acceptedFiles.slice(0, MAX_FILES)

      const newFiles: FileStatus[] = filesToAdd.map(file => ({
        file,
        status: "pending" as const
      }))

      setFiles(newFiles)
      setResults([])
      setError(null)

      setTimeout(() => {
        handleAnalyzeFiles(newFiles)
      }, 100)
    }
  }, [selectedProjectId, isLoggedIn, router])

  // URL 분석
  const handleAnalyzeUrl = async () => {
    if (isAnalyzing) return // 분석 중에는 중복 실행 차단
    if (!isLoggedIn) {
      router.push("/login?redirect=/analyze")
      return
    }
    if (!selectedProjectId) {
      setError("프로젝트를 먼저 선택해 주세요.")
      return
    }
    if (!urlInput.trim()) {
      setError("URL을 입력해 주세요.")
      return
    }

    // URL 유효성 간단 체크
    let url = urlInput.trim()
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    setIsAnalyzingUrl(true)
    setIsAnalyzing(true)
    setError(null)
    setResults([])
    // 로딩 메시지는 useEffect에서 자동 순환

    try {
      const result = await analyzeUrlDirect({
        projectId: selectedProjectId,
        url,
      })

      if (result.error) {
        if (result.error === "CREDIT_LIMIT_EXCEEDED") {
          setShowCreditError(true)
        } else {
          setError(result.error)
        }
      } else if (result.data) {
        const analysisResult = {
          ...result.data,
          fileName: url,
        } as AnalysisResult
        setResults([analysisResult])
      }
    } catch (err) {
      console.error("URL analysis error:", err)
      setError("URL 분석 중 오류가 발생했습니다. 다시 시도해 주세요.")
    } finally {
      setIsAnalyzingUrl(false)
      setIsAnalyzing(false)
      setStatusMessage("")
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
      }, 200)
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/plain": [".txt"],
    },
    maxFiles: MAX_FILES,
    maxSize: 200 * 1024 * 1024,
    disabled: isLoggedIn && !selectedProjectId,
  })

  return (
    <div className="pt-24 pb-16 px-6 bg-[#0a1628] min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            게임 기획 문서 분석
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            기획서, 포트폴리오, 이력서를 업로드하면 AI가 원본 그대로 직접 읽고 분석합니다.
          </p>
        </div>

        {/* 로딩 중 */}
        {checkingAllowance && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
          </div>
        )}

        {/* 구독 제한 안내 (로그인은 됐지만 횟수 초과/만료) */}
        {!checkingAllowance && allowanceInfo && !allowanceInfo.allowed && allowanceInfo.reason !== "login_required" && (
          <Card className="mb-8 bg-slate-900/80 border-[#1e3a5f]">
            <CardContent className="pt-8 pb-8 text-center">
              <Lock className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              {allowanceInfo.reason === "expired" ? (
                <>
                  <h2 className="text-xl font-bold text-white mb-2">구독이 만료되었습니다</h2>
                  <p className="text-slate-400 mb-6">계속 이용하시려면 구독을 갱신해 주세요.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-2">무료 분석 횟수를 모두 사용했습니다</h2>
                  <p className="text-slate-400 mb-6">
                    무료 플랜은 총 1회 분석이 가능합니다.<br />
                    무제한 분석과 프리미엄 AI를 원하시면 구독을 시작해 주세요.
                  </p>
                </>
              )}
              <div className="flex justify-center gap-3">
                <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                  <Link href="/pricing">요금제 보기</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 무료 플랜 안내 배너 */}
        {!checkingAllowance && allowanceInfo?.allowed && allowanceInfo.plan === "free" && !allowanceInfo.unlimited && results.length === 0 && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-amber-400">
                무료 플랜은 총 <span className="font-bold">1회 분석</span>이 가능합니다.
                {allowanceInfo.remaining !== undefined && (
                  <> 현재 <span className="font-bold">{allowanceInfo.remaining}회</span> 남았습니다.</>
                )}
              </p>
              <p className="text-xs text-amber-400/70 mt-1">
                무제한 분석과 프리미엄 AI를 원하시면{" "}
                <Link href="/pricing" className="underline hover:text-amber-300">구독을 시작</Link>해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* ========== 프로젝트 선택 (로그인한 유저만) ========== */}
        {!checkingAllowance && isLoggedIn && allowanceInfo?.allowed && results.length === 0 && (
          <Card className="mb-6 bg-slate-900/80 border-[#1e3a5f]">
            {/* 프로젝트 1개 + 선택됨: 간소화 표시 */}
            {projects.length === 1 && selectedProjectId ? (
              <CardContent className="py-4 px-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-[#5B8DEF]" />
                    <span className="text-white text-sm font-medium">{projects[0].name}</span>
                    <span className="text-xs text-slate-500">
                      {projects[0].analysis_count}개 분석
                      {projects[0].best_score !== null && ` · 최고 ${projects[0].best_score}점`}
                    </span>
                  </div>
                  {canCreateProject && (
                    <button
                      onClick={() => { setShowNewProject(true); setSelectedProjectId(null) }}
                      className="text-xs text-[#5B8DEF] hover:underline"
                    >
                      + 새 프로젝트
                    </button>
                  )}
                </div>
              </CardContent>
            ) : (
            <>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <FolderOpen className="w-5 h-5 text-[#5B8DEF]" />
                프로젝트 선택
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* 기존 프로젝트 목록 */}
                {projects.map(project => (
                  <button
                    key={project.id}
                    onClick={() => { setSelectedProjectId(project.id); setShowNewProject(false) }}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      selectedProjectId === project.id
                        ? "border-[#5B8DEF] bg-[#5B8DEF]/10"
                        : "border-[#1e3a5f] hover:border-[#5B8DEF]/50 bg-[#0d1b2a]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FolderOpen className={`w-4 h-4 ${selectedProjectId === project.id ? "text-[#5B8DEF]" : "text-slate-500"}`} />
                        <span className="text-white text-sm font-medium">{project.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {project.analysis_count}개 분석
                        {project.best_score !== null && ` · 최고 ${project.best_score}점`}
                      </span>
                    </div>
                  </button>
                ))}

                {/* 새 프로젝트 만들기 */}
                {!showNewProject ? (
                  <button
                    onClick={() => {
                      if (canCreateProject) {
                        setShowNewProject(true)
                        setSelectedProjectId(null)
                      }
                    }}
                    className={`w-full text-left p-3 rounded-lg border border-dashed transition-all ${
                      canCreateProject
                        ? "border-[#1e3a5f] hover:border-[#5B8DEF]/50 cursor-pointer"
                        : "border-[#1e3a5f]/50 cursor-not-allowed opacity-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {canCreateProject ? (
                          <Plus className="w-4 h-4 text-[#5B8DEF]" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-600" />
                        )}
                        <span className={canCreateProject ? "text-[#5B8DEF] text-sm" : "text-slate-600 text-sm"}>
                          새 프로젝트 만들기
                        </span>
                      </div>
                      {!canCreateProject && (
                        <Link href="/pricing" className="text-xs text-amber-400 hover:underline" onClick={e => e.stopPropagation()}>
                          구독 필요
                        </Link>
                      )}
                    </div>
                  </button>
                ) : (
                  <div className="p-3 rounded-lg border border-[#5B8DEF] bg-[#5B8DEF]/5">
                    <p className="text-xs text-slate-400 mb-2">프로젝트 이름을 입력하세요</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newProjectName}
                        onChange={e => setNewProjectName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleCreateProject()}
                        placeholder="예: 넥슨 포트폴리오"
                        className="flex-1 bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#5B8DEF]"
                        autoFocus
                      />
                      <Button
                        onClick={handleCreateProject}
                        disabled={creatingProject || !newProjectName.trim()}
                        className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white text-sm px-4"
                      >
                        {creatingProject ? <Loader2 className="w-4 h-4 animate-spin" /> : "생성"}
                      </Button>
                      <Button
                        onClick={() => { setShowNewProject(false); setNewProjectName("") }}
                        variant="outline"
                        className="border-[#1e3a5f] text-slate-400 text-sm px-3"
                      >
                        취소
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
            </>
            )}
          </Card>
        )}

        {/* Upload Section - 비로그인도 보여줌, 분석 시작 시 로그인 유도 */}
        {!checkingAllowance && (allowanceInfo?.allowed || allowanceInfo?.reason === "login_required") && results.length === 0 && (
          <Card className="mb-8 bg-slate-900/80 border-[#1e3a5f]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-[#5B8DEF]" />
                문서 분석
              </CardTitle>
              {/* 데이터 보호 안내 */}
              <div className="mt-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
                <p className="text-xs text-emerald-400/80">
                  업로드된 문서는 분석 즉시 서버에서 완전 삭제됩니다. 분석 결과는 본인만 조회 가능합니다.
                </p>
              </div>
              {/* 파일 / URL 탭 */}
              <div className="flex gap-1 mt-3 bg-slate-800/50 rounded-lg p-1">
                <button
                  onClick={() => setUploadMode("file")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    uploadMode === "file"
                      ? "bg-[#5B8DEF] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  파일 업로드
                </button>
                <button
                  onClick={() => setUploadMode("url")}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    uploadMode === "url"
                      ? "bg-[#5B8DEF] text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Globe className="w-4 h-4" />
                  URL 링크
                </button>
              </div>
            </CardHeader>
            <CardContent>
              {/* 파일 업로드 모드 */}
              {uploadMode === "file" && (
                <>
                  {isAnalyzing ? (
                    /* 분석 진행 중 — 드롭존을 로딩 화면으로 대체 */
                    <div className="border-2 border-[#5B8DEF]/40 rounded-xl p-12 text-center bg-[#5B8DEF]/5">
                      <div className="flex flex-col items-center gap-5">
                        <div className="w-20 h-20 rounded-full bg-[#5B8DEF]/10 border-2 border-[#5B8DEF]/30 flex items-center justify-center">
                          <Loader2 className="w-10 h-10 animate-spin text-[#5B8DEF]" />
                        </div>
                        {files.length > 0 && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 rounded-lg">
                            <FileText className="w-4 h-4 text-[#5B8DEF]" />
                            <span className="text-sm text-white truncate max-w-[250px]">{files[0].file.name}</span>
                            <span className="text-xs text-slate-500">{(files[0].file.size / 1024 / 1024).toFixed(1)} MB</span>
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-white text-lg">
                            {statusMessage || "AI가 문서를 직접 읽고 분석 중..."}
                          </p>
                          <p className="text-sm text-slate-400 mt-2">보통 30초~1분 정도 소요됩니다</p>
                        </div>
                        <Progress value={fakeProgress} className="h-2 w-full max-w-sm" />
                      </div>
                    </div>
                  ) : (
                    /* 평소 — 파일 드롭존 */
                    <>
                      <div
                        {...getRootProps()}
                        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                          isLoggedIn && !selectedProjectId
                            ? "border-[#1e3a5f]/50 cursor-not-allowed opacity-50"
                            : isDragActive
                            ? "border-[#5B8DEF] bg-[#5B8DEF]/5 cursor-pointer"
                            : "border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-800/50 cursor-pointer"
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                            <Upload className="w-8 h-8 text-slate-400" />
                          </div>
                          <div>
                            {!isLoggedIn ? (
                              <>
                                <p className="font-medium text-white">무료로 문서를 분석해 보세요</p>
                                <p className="text-sm text-slate-400 mt-1">파일을 올리면 로그인 후 바로 분석이 시작됩니다</p>
                              </>
                            ) : selectedProjectId ? (
                              <>
                                <p className="font-medium text-white">문서를 업로드하고 분석하세요</p>
                                <p className="text-sm text-slate-400 mt-1">드래그 앤 드롭하거나 클릭하여 파일을 선택하세요</p>
                              </>
                            ) : (
                              <>
                                <p className="font-medium text-slate-300">위에서 프로젝트를 먼저 선택해 주세요</p>
                                <p className="text-sm text-slate-400 mt-1">프로젝트를 선택하면 문서를 업로드할 수 있습니다</p>
                              </>
                            )}
                            <p className="text-xs text-slate-500 mt-2">PDF, DOCX, PPTX, XLSX, TXT · 최대 500MB</p>
                          </div>
                        </div>
                      </div>

                      {/* 선택된 파일 목록 (에러/완료 상태) */}
                      {files.length > 0 && (
                        <div className="mt-6 space-y-2">
                          <p className="text-sm text-slate-400 mb-3">선택된 파일</p>
                          {files.map((fileStatus, index) => (
                            <div
                              key={index}
                              className={`flex items-center justify-between p-3 rounded-lg ${
                                fileStatus.status === "success" ? "bg-emerald-500/10 border border-emerald-500/30" :
                                fileStatus.status === "error" ? "bg-red-500/10 border border-red-500/30" :
                                "bg-slate-800/50 border border-transparent"
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {fileStatus.status === "success" ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                ) : fileStatus.status === "error" ? (
                                  <AlertCircle className="w-4 h-4 text-red-400" />
                                ) : (
                                  <FileText className="w-4 h-4 text-slate-400" />
                                )}
                                <div>
                                  <p className="text-sm text-white truncate max-w-[200px] sm:max-w-[300px]">{fileStatus.file.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                                    {fileStatus.result && ` · ${fileStatus.result.score}점`}
                                    {fileStatus.error && ` · ${fileStatus.error}`}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => removeFile(index)}
                                className="text-slate-500 hover:text-red-400 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* URL 링크 모드 */}
              {uploadMode === "url" && (
                <div className={`${isLoggedIn && !selectedProjectId ? "opacity-50 pointer-events-none" : ""}`}>
                  <div className="border-2 border-dashed border-[#1e3a5f] rounded-xl p-8">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                        <Link2 className="w-8 h-8 text-slate-400" />
                      </div>
                      <div className="text-center">
                        <p className="font-medium text-white">
                          {!isLoggedIn ? "무료로 URL을 분석해 보세요" : "웹 페이지 URL을 입력하세요"}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">
                          {!isLoggedIn ? "URL을 입력하고 분석 버튼을 누르면 로그인 후 바로 분석됩니다" : "노션, 웹 포트폴리오, 블로그 등의 링크를 분석합니다"}
                        </p>
                      </div>
                      <div className="w-full max-w-lg flex gap-2 mt-2">
                        <input
                          type="url"
                          value={urlInput}
                          onChange={e => setUrlInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && !isAnalyzing && handleAnalyzeUrl()}
                          placeholder="https://notion.so/... 또는 포트폴리오 URL"
                          className="flex-1 bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#5B8DEF]"
                          disabled={isAnalyzing}
                        />
                        <Button
                          onClick={handleAnalyzeUrl}
                          disabled={isAnalyzing || !urlInput.trim() || (isLoggedIn && !selectedProjectId)}
                          className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white px-6"
                        >
                          {isAnalyzingUrl ? <Loader2 className="w-4 h-4 animate-spin" /> : "분석"}
                        </Button>
                      </div>
                      <p className="text-xs text-slate-500">Notion, 개인 웹사이트, 블로그, Google Docs(공개) 등</p>
                    </div>
                  </div>
                </div>
              )}

              {/* URL 분석 중 로딩 (파일 분석은 드롭존 안에 표시) */}
              {isAnalyzing && isAnalyzingUrl && (
                <div className="mt-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#5B8DEF]" />
                    <span className="text-sm text-slate-400">
                      {statusMessage || "AI가 문서를 직접 읽고 분석 중..."}
                    </span>
                  </div>
                  <Progress value={fakeProgress} className="h-2" />
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-400">{error}</p>
                </div>
              )}
              {/* 개인정보 안내 */}
              <div className="mt-4 text-center space-y-1">
                <p className="text-slate-500 text-xs">
                  업로드 시 <span className="text-slate-400">개인정보 처리방침</span>에 동의하는 것으로 간주됩니다.
                </p>
                <p className="text-slate-600 text-xs">
                  🔒 업로드된 자료는 분석 후 즉시 서버에서 삭제됩니다.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Analysis Results */}
        {results.length > 0 && (
          <div ref={resultsRef} className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 text-[#5B8DEF]">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">
                  {results.length === 1 ? "분석 완료" : `${results.length}개 문서 분석 완료`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedProjectId && (
                  <Button
                    variant="outline"
                    asChild
                    className="border-[#5B8DEF]/30 text-[#5B8DEF] hover:bg-[#5B8DEF]/10 bg-transparent"
                  >
                    <Link href="/mypage">
                      <FolderOpen className="w-3.5 h-3.5 mr-1" /> 프로젝트로 가기
                    </Link>
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => {
                    setResults([])
                    setFiles([])
                    setCurrentIndex(0)
                  }}
                  className="border-[#1e3a5f] text-slate-300 hover:bg-slate-800 bg-transparent"
                >
                  새로운 분석 시작
                </Button>
              </div>
            </div>

            {results.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      currentIndex === idx
                        ? "bg-[#5B8DEF] text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-white ${getGrade(r.score).color}`}>
                      {getGrade(r.score).grade}
                    </span>
                    <span className="truncate max-w-[150px] inline-block align-middle">{r.fileName}</span>
                    <span className="text-xs opacity-70">{r.score}점</span>
                  </button>
                ))}
              </div>
            )}

            {results[currentIndex] && (
              <>
                {results.length > 1 && (
                  <p className="text-slate-400 text-sm">
                    현재 보기: <span className="text-white">{results[currentIndex].fileName}</span>
                  </p>
                )}

                <div className="grid lg:grid-cols-2 gap-8">
                  <ScoreCard score={results[currentIndex].score} ranking={results[currentIndex].ranking} />
                  <RadarChartComponent data={results[currentIndex].categories} />
                </div>

                {/* 합격자 포트폴리오 사이 랭킹 */}
                {results[currentIndex].ranking && results[currentIndex].ranking!.total > 0 && (() => {
                  const ranking = results[currentIndex].ranking!
                  const userScore = results[currentIndex].score
                  // 점수 기반 5단계 등급
                  const getRankGrade = (s: number) => {
                    if (s >= 90) return { label: "합격 가능", color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", emoji: "🏆" }
                    if (s >= 80) return { label: "경쟁력 있음", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", emoji: "✅" }
                    if (s >= 70) return { label: "보완 필요", color: "text-[#5B8DEF]", bg: "bg-[#5B8DEF]/10 border-[#5B8DEF]/20", emoji: "📝" }
                    if (s >= 60) return { label: "개선 필요", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", emoji: "⚠️" }
                    return { label: "재작성 권장", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", emoji: "🔄" }
                  }
                  const grade = getRankGrade(userScore)
                  return (
                  <Card className="bg-gradient-to-br from-slate-900/80 to-[#0d1b2a] border-[#5B8DEF]/30">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2 text-lg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        합격자 포트폴리오 {ranking.total}개 중 내 위치
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* 랭킹 요약 - 2컬럼 */}
                      <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="text-center p-5 bg-[#5B8DEF]/10 border border-[#5B8DEF]/20 rounded-xl">
                          <p className="text-xs text-slate-400 mb-2">내 점수</p>
                          <p className="text-4xl font-bold text-[#5B8DEF]">
                            {userScore}<span className="text-lg text-slate-400">점</span>
                          </p>
                        </div>
                        <div className={`text-center p-5 border rounded-xl ${grade.bg}`}>
                          <p className="text-xs text-slate-400 mb-2">{ranking.total}개 기준 평가</p>
                          <p className={`text-3xl font-bold ${grade.color}`}>
                            {grade.emoji} {grade.label}
                          </p>
                        </div>
                      </div>

                      {/* 5단계 등급 스케일 */}
                      <div className="mb-8">
                        <p className="text-slate-400 text-sm mb-3">합격 가능성 등급</p>
                        <div className="flex gap-1">
                          {[
                            { label: "재작성 권장", range: "~59", color: "bg-red-500/30", textColor: "text-red-300", min: 0, max: 59 },
                            { label: "개선 필요", range: "60~69", color: "bg-amber-500/30", textColor: "text-amber-300", min: 60, max: 69 },
                            { label: "보완 필요", range: "70~79", color: "bg-[#5B8DEF]/30", textColor: "text-blue-300", min: 70, max: 79 },
                            { label: "경쟁력 있음", range: "80~89", color: "bg-emerald-500/30", textColor: "text-emerald-300", min: 80, max: 89 },
                            { label: "합격 가능", range: "90+", color: "bg-purple-500/30", textColor: "text-purple-300", min: 90, max: 100 },
                          ].map((g, i) => (
                            <div
                              key={i}
                              className={`flex-1 h-10 ${g.color} rounded flex items-center justify-center text-xs ${g.textColor} relative ${userScore >= g.min && userScore <= g.max ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-900' : ''}`}
                            >
                              <span className="hidden sm:inline">{g.label}</span>
                              <span className="sm:hidden">{g.range}</span>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2 text-center">
                          내 점수 {userScore}점 · 재작성 권장 &lt; 개선 필요 &lt; 보완 필요 &lt; 경쟁력 있음 &lt; 합격 가능
                        </p>
                      </div>

                      {/* 회사별 합격자 비교 - 텍스트 코멘트 */}
                      {results[currentIndex].companyFeedback && (
                        <div>
                          <p className="text-white font-semibold text-base mb-4">회사별 합격자 포트폴리오 특징 비교</p>
                          <div className="space-y-3">
                            {results[currentIndex].companyFeedback!.split('\n\n').filter(Boolean).map((paragraph, idx) => {
                              // **회사명** 패턴을 찾아서 강조
                              const parts = paragraph.split(/\*\*(.*?)\*\*/)
                              return (
                                <div key={idx} className="p-4 bg-slate-800/50 border border-[#1e3a5f]/50 rounded-xl">
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
                          <p className="text-xs text-slate-500 mt-4 text-center">
                            * 실제 합격 포트폴리오와 비교 분석 · 데이터는 지속 업데이트됩니다
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  )
                })()}

                <FeedbackCards
                  strengths={results[currentIndex].strengths}
                  weaknesses={results[currentIndex].weaknesses}
                />

                {/* 게임 디자인 역량 점수 */}
                <DesignScores data={results[currentIndex].categories} />

                {/* 문서 가독성 (PDF만) */}
                {results[currentIndex].analysisSource === "pdf" && results[currentIndex].readabilityCategories && results[currentIndex].readabilityCategories!.length > 0 ? (
                  <>
                    <ReadabilityScores data={results[currentIndex].readabilityCategories!} />
                    {results[currentIndex].layoutRecommendations && results[currentIndex].layoutRecommendations!.length > 0 && (
                      <LayoutRecommendations data={results[currentIndex].layoutRecommendations!} />
                    )}
                  </>
                ) : results[currentIndex].analysisSource === "url" ? (
                  <Card className="bg-slate-900/80 border-[#1e3a5f]">
                    <CardContent className="p-6 text-center">
                      <Eye className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm">PDF 파일을 업로드하면 문서의 시각적 가독성 분석과 레이아웃 개선 제안을 받을 수 있습니다</p>
                    </CardContent>
                  </Card>
                ) : null}

                {/* 하단 CTA 영역 */}
                <div className="space-y-4">
                  {/* 프로젝트로 가기 + 새로운 분석 (구독자) */}
                  {allowanceInfo?.plan && allowanceInfo.plan !== "free" && selectedProjectId && (
                    <Card className="bg-gradient-to-r from-[#5B8DEF]/10 to-purple-500/10 border-[#5B8DEF]/30">
                      <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-semibold mb-1">분석 결과가 저장되었습니다</p>
                          <p className="text-sm text-slate-400">프로젝트에서 버전별 비교와 이전 분석을 확인하세요.</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                            <Link href="/mypage">
                              <FolderOpen className="w-4 h-4 mr-1" /> 프로젝트로 가기
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => { setResults([]); setFiles([]); setCurrentIndex(0) }}
                            className="border-[#1e3a5f] text-slate-300 hover:bg-slate-800 bg-transparent"
                          >
                            새로운 분석
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 구독 유도 (무료 사용자) */}
                  {(!allowanceInfo?.plan || allowanceInfo.plan === "free") && (
                    <Card className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 border-amber-400/30">
                      <CardContent className="p-6">
                        <p className="text-white font-semibold mb-1">더 많은 분석이 필요하신가요?</p>
                        <p className="text-sm text-slate-400 mb-4">구독하면 무제한 분석, 버전 비교, 프리미엄 AI를 사용할 수 있습니다.</p>
                        <div className="flex items-center gap-3">
                          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                            <Link href="/pricing">구독하기</Link>
                          </Button>
                          <a
                            href="http://pf.kakao.com/_bXgIX"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 px-4 py-2 border border-[#1e3a5f] text-slate-300 hover:bg-slate-800 rounded-lg transition-colors text-sm"
                          >
                            1:1 상담 신청
                            <ArrowRight className="w-4 h-4" />
                          </a>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* 1:1 상담 카드 (구독자용) */}
                  {allowanceInfo?.plan && allowanceInfo.plan !== "free" && (
                    <Card className="bg-slate-900/80 border-[#1e3a5f]">
                      <CardContent className="p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                          <p className="text-white font-semibold mb-1">AI 분석 결과에 대해 궁금한 점이 있으신가요?</p>
                          <p className="text-sm text-slate-400">1:1 상담을 통해 더 자세한 피드백을 받아보세요.</p>
                        </div>
                        <a
                          href="http://pf.kakao.com/_bXgIX"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white font-semibold rounded-xl transition-colors text-sm"
                        >
                          1:1 상담 신청
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 크레딧 한도 초과 팝업 */}
      {showCreditError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-[#1e3a5f] rounded-2xl p-8 max-w-sm mx-4 text-center shadow-2xl">
            <div className="w-14 h-14 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">서비스 일시 점검 중</h3>
            <p className="text-slate-400 text-sm mb-6">
              현재 AI 분석 서비스가 일시적으로 중단되었습니다.<br />
              관리자에게 문의해 주세요.
            </p>
            <button
              onClick={() => setShowCreditError(false)}
              className="w-full py-3 bg-[#5B8DEF] hover:bg-[#4a7de0] text-white rounded-xl font-medium transition-colors"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
