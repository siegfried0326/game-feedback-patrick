"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Lock, Shield, FolderOpen, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { uploadFileToStorage, analyzeDocumentDirect, deleteFileFromStorage, checkBeforeAnalysis } from "@/app/actions/analyze"
import { getProjects, createProject, checkProjectAllowance } from "@/app/actions/subscription"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

type Project = {
  id: string
  name: string
  analysis_count: number
  best_score: number | null
}

type AnalysisResult = {
  fileName: string
  score: number
  categories: {
    subject: string
    value: number
    fullMark: number
  }[]
  strengths: string[]
  weaknesses: string[]
  detailedFeedback?: string
  ranking?: {
    total: number
    percentile: number
    companyComparison?: {
      company: string
      avgScore: number
      userScore: number
    }[]
  }
}

type FileStatus = {
  file: File
  status: "pending" | "uploading" | "analyzing" | "success" | "error"
  result?: AnalysisResult
  error?: string
}

const MAX_FILES = 20

export function AnalyzeDashboard() {
  const searchParams = useSearchParams()
  const preselectedProjectId = searchParams.get("projectId")

  const [files, setFiles] = useState<FileStatus[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
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

  // 페이지 로드 시 구독 상태 + 프로젝트 목록 체크
  useEffect(() => {
    async function init() {
      try {
        const [allowanceResult, projectsResult, projectAllowance] = await Promise.all([
          checkBeforeAnalysis(),
          getProjects(),
          checkProjectAllowance(),
        ])
        setAllowanceInfo(allowanceResult)

        if (projectsResult.data) {
          setProjects(projectsResult.data as Project[])
          // preselected가 없고 프로젝트가 1개면 자동 선택
          if (!preselectedProjectId && projectsResult.data.length === 1) {
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

        const formData = new FormData()
        formData.append("file", fileStatus.file)

        const uploadResult = await uploadFileToStorage(formData)

        if (uploadResult.error) {
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? { ...f, status: "error", error: uploadResult.error } : f
          ))
          continue
        }

        setStatusMessage("AI가 문서를 분석하는 중...")
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
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
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
  }, [selectedProjectId])

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
    },
    maxFiles: MAX_FILES,
    maxSize: 50 * 1024 * 1024,
    disabled: !selectedProjectId,
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

        {/* 구독 제한 안내 */}
        {!checkingAllowance && allowanceInfo && !allowanceInfo.allowed && (
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
                  <h2 className="text-xl font-bold text-white mb-2">로그인이 필요합니다</h2>
                  <p className="text-slate-400 mb-6">문서 분석을 위해 로그인해 주세요.</p>
                </>
              )}
              <div className="flex justify-center gap-3">
                {allowanceInfo.reason === "login_required" ? (
                  <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                    <Link href="/login?redirect=/analyze">로그인하기</Link>
                  </Button>
                ) : (
                  <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                    <Link href="/pricing">요금제 보기</Link>
                  </Button>
                )}
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
                무료 플랜은 <span className="font-bold">프로젝트 1개</span>만 생성할 수 있습니다. 프로젝트 안에서는 자유롭게 분석 가능합니다.
              </p>
              <p className="text-xs text-amber-400/70 mt-1">
                무제한 프로젝트를 원하시면{" "}
                <Link href="/pricing" className="underline hover:text-amber-300">구독을 시작</Link>해 주세요.
              </p>
            </div>
          </div>
        )}

        {/* 데이터 보호 안내 */}
        {!checkingAllowance && allowanceInfo?.allowed && results.length === 0 && (
          <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-400 font-medium">당신의 데이터는 안전합니다</p>
              <p className="text-xs text-emerald-400/70 mt-1">
                업로드된 문서는 분석 즉시 서버에서 완전히 삭제됩니다. 분석 결과는 본인만 조회할 수 있으며, 관리자를 포함한 그 누구도 열람할 수 없습니다.
              </p>
            </div>
          </div>
        )}

        {/* ========== 프로젝트 선택 ========== */}
        {!checkingAllowance && allowanceInfo?.allowed && results.length === 0 && (
          <Card className="mb-6 bg-slate-900/80 border-[#1e3a5f]">
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
          </Card>
        )}

        {/* Upload Section */}
        {!checkingAllowance && allowanceInfo?.allowed && results.length === 0 && (
          <Card className="mb-8 bg-slate-900/80 border-[#1e3a5f]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Upload className="w-5 h-5 text-[#5B8DEF]" />
                문서 업로드
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  !selectedProjectId
                    ? "border-[#1e3a5f]/50 cursor-not-allowed opacity-50"
                    : isDragActive
                    ? "border-[#5B8DEF] bg-[#5B8DEF]/5 cursor-pointer"
                    : "border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-800/50 cursor-pointer"
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
                    {selectedProjectId ? (
                      <Upload className="w-8 h-8 text-slate-400" />
                    ) : (
                      <Lock className="w-8 h-8 text-slate-600" />
                    )}
                  </div>
                  <div>
                    {selectedProjectId ? (
                      <>
                        <p className="font-medium text-white">여러 문서를 한 번에 분석하세요</p>
                        <p className="text-sm text-slate-400 mt-1">드래그 앤 드롭하거나 클릭하여 파일을 선택하세요</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-slate-500">위에서 프로젝트를 먼저 선택해 주세요</p>
                        <p className="text-sm text-slate-600 mt-1">프로젝트를 선택하면 문서를 업로드할 수 있습니다</p>
                      </>
                    )}
                    <p className="text-xs text-slate-500 mt-2">최대 50MB / 동시 20개까지</p>
                  </div>
                </div>
              </div>

              {/* 선택된 파일 목록 */}
              {files.length > 0 && (
                <div className="mt-6 space-y-2">
                  <p className="text-sm text-slate-400 mb-3">선택된 파일 ({files.length}개)</p>
                  {files.map((fileStatus, index) => (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        fileStatus.status === "uploading" ? "bg-amber-500/10 border border-amber-500/30" :
                        fileStatus.status === "analyzing" ? "bg-[#5B8DEF]/10 border border-[#5B8DEF]/30" :
                        fileStatus.status === "success" ? "bg-emerald-500/10 border border-emerald-500/30" :
                        fileStatus.status === "error" ? "bg-red-500/10 border border-red-500/30" :
                        "bg-slate-800/50 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {fileStatus.status === "uploading" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        ) : fileStatus.status === "analyzing" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-[#5B8DEF]" />
                        ) : fileStatus.status === "success" ? (
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
                      {!isAnalyzing && (
                        <button
                          onClick={() => removeFile(index)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {isAnalyzing && (
                <div className="mt-6">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#5B8DEF]" />
                    <span className="text-sm text-slate-400">
                      {statusMessage || `AI가 PDF를 직접 읽고 분석 중... (${currentIndex + 1}/${files.length})`}
                    </span>
                  </div>
                  <Progress value={((currentIndex + 1) / files.length) * 100} className="h-2" />
                </div>
              )}

              {error && (
                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-400">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Analysis Results */}
        {results.length > 0 && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#5B8DEF]">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">
                  {results.length === 1 ? "분석 완료" : `${results.length}개 문서 분석 완료`}
                </span>
              </div>
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

            {results.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {results.map((r, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                      currentIndex === idx
                        ? "bg-[#5B8DEF] text-white"
                        : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                    }`}
                  >
                    <span className="truncate max-w-[150px] inline-block align-middle">{r.fileName}</span>
                    <span className="ml-2 text-xs opacity-70">{r.score}점</span>
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

                {results[currentIndex].ranking && results[currentIndex].ranking!.total > 0 && (
                  <Card className="bg-slate-900/80 border-[#1e3a5f]">
                    <CardHeader>
                      <CardTitle className="text-white flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        합격 포트폴리오 {results[currentIndex].ranking!.total}개 기준 랭킹
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid md:grid-cols-2 gap-8">
                        <div className="text-center">
                          <p className="text-slate-400 text-sm mb-2">전체 랭킹</p>
                          <p className="text-5xl font-bold text-[#5B8DEF] mb-2">
                            상위 {Math.max(1, 100 - results[currentIndex].ranking!.percentile)}%
                          </p>
                          <p className="text-slate-400 text-sm">
                            {results[currentIndex].ranking!.total}개 합격 포트폴리오 중
                          </p>
                        </div>
                        {results[currentIndex].ranking!.companyComparison && results[currentIndex].ranking!.companyComparison!.length > 0 && (
                          <div>
                            <p className="text-slate-400 text-sm mb-3">회사별 합격자 평균 비교</p>
                            <div className="space-y-2">
                              {results[currentIndex].ranking!.companyComparison!.map((comp, idx) => (
                                <div key={idx} className="flex items-center gap-3">
                                  <span className="text-slate-300 text-sm w-24 truncate">{comp.company}</span>
                                  <div className="flex-1 bg-slate-800 rounded-full h-4 overflow-hidden">
                                    <div
                                      className="h-full bg-slate-600 rounded-full relative"
                                      style={{ width: `${comp.avgScore}%` }}
                                    >
                                      <span className="absolute right-2 text-xs text-slate-300">{comp.avgScore}</span>
                                    </div>
                                  </div>
                                  <span className={`text-sm font-medium ${results[currentIndex].score >= comp.avgScore ? 'text-emerald-400' : 'text-amber-400'}`}>
                                    {results[currentIndex].score >= comp.avgScore ? '+' : ''}{results[currentIndex].score - comp.avgScore}
                                  </span>
                                </div>
                              ))}
                            </div>
                            <p className="text-xs text-slate-500 mt-3">
                              내 점수: {results[currentIndex].score}점
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <FeedbackCards
                  strengths={results[currentIndex].strengths}
                  weaknesses={results[currentIndex].weaknesses}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
