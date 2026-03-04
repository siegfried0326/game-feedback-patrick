/**
 * 학습 데이터 상세 관리 페이지 (823줄)
 *
 * 기능:
 * - 포트폴리오 업로드 (드래그&드롭, PDF만)
 * - Gemini AI 분석: 회사 파싱, 데이터 테이블 추출, JSON 변환
 * - 분석 결과 미리보기 (회사별, 연도별 통계)
 * - portfolios 테이블 CRUD
 *
 * 접근: 관리자 전용
 * 라우트: /admin/training
 */
"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload, FileText, Loader2, CheckCircle2, XCircle, Database, Brain,
  AlertTriangle, TrendingUp, Trash2, Eye, RefreshCw
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  analyzeAndSavePortfolio, getPortfolioList,
  getCompanyStats, deletePortfolio, deleteMultiplePortfolios,
  reclassifyAllCompanies, rebuildAllPortfolioChunks,
  analyzePortfoliosBatch, getPortfolioAnalysisStats
} from "@/app/actions/admin"
import { createClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"
import { extractCompanyFromFileName } from "@/lib/company-parser"

interface TrainingFile {
  file: File
  status: "pending" | "uploading" | "analyzing" | "success" | "error" | "skipped"
  message?: string
  score?: number
  companies?: string[]
}

type TabType = "upload" | "data"

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<TabType>("upload")

  // ── 공통 상태 ──
  const [companyStats, setCompanyStats] = useState<Record<string, number>>({})
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [isReclassifying, setIsReclassifying] = useState(false)
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [rebuildProgress, setRebuildProgress] = useState({ processed: 0, total: 0, remaining: 0 })
  const [isDeepAnalyzing, setIsDeepAnalyzing] = useState(false)
  const [deepAnalysisProgress, setDeepAnalysisProgress] = useState({ analyzed: 0, total: 0, remaining: 0 })

  // ── 업로드 탭 상태 ──
  const [files, setFiles] = useState<TrainingFile[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [existingFiles, setExistingFiles] = useState<string[]>([])

  // ── 데이터 관리 탭 상태 ──
  const [portfolios, setPortfolios] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // 초기 로드
  useEffect(() => {
    loadAll()
  }, [])

  const loadAll = async () => {
    await Promise.all([loadExistingFiles(), loadCompanyStats(), loadPortfolios()])
  }

  const loadExistingFiles = async () => {
    const result = await getPortfolioList()
    if (result.data) {
      const fileNames = result.data.map((p: any) => p.file_name)
      setExistingFiles(fileNames)
    }
  }

  const loadCompanyStats = async () => {
    setIsLoadingStats(true)
    const result = await getCompanyStats()
    if (result.data) {
      setCompanyStats(result.data)
    }
    setIsLoadingStats(false)
  }

  const loadPortfolios = async () => {
    setIsLoadingData(true)
    const result = await getPortfolioList()
    if (result.data) {
      setPortfolios(result.data)
    }
    setIsLoadingData(false)
  }

  // ── 업로드 로직 ──
  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => {
        return errors.map((e: any) => {
          if (e.code === 'file-too-large') return `${file.name}: 파일이 너무 큽니다 (최대 200MB)`
          if (e.code === 'file-invalid-type') return `${file.name}: 지원하지 않는 파일 형식입니다`
          return `${file.name}: ${e.message}`
        }).join('\n')
      }).join('\n')
      alert(`❌ 업로드 실패:\n\n${errors}`)
    }

    const duplicates: string[] = []
    const newFiles: TrainingFile[] = acceptedFiles.map(file => {
      const isDuplicate = existingFiles.includes(file.name)
      if (isDuplicate) duplicates.push(file.name)
      return {
        file,
        status: isDuplicate ? "skipped" : "pending",
        message: isDuplicate ? "이미 학습된 파일" : undefined
      }
    })

    if (duplicates.length > 0) {
      alert(`⚠️ 중복 파일 발견:\n\n${duplicates.join('\n')}\n\n이미 학습된 파일은 건너뜁니다.`)
    }

    setFiles(prev => [...prev, ...newFiles])
  }, [existingFiles])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
      "text/csv": [".csv"],
    },
    multiple: true,
    maxSize: 200 * 1024 * 1024
  })

  const startTraining = async () => {
    if (files.length === 0) {
      alert("파일을 먼저 추가해주세요.")
      return
    }

    const pendingFiles = files.filter(f => f.status === "pending")
    if (pendingFiles.length === 0) {
      alert("학습할 파일이 없습니다. (모두 중복 파일)")
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setCompletedCount(0)

    const totalFiles = files.length

    for (let i = 0; i < files.length; i++) {
      const fileData = files[i]

      if (fileData.status === "skipped") {
        setProgress(((i + 1) / totalFiles) * 100)
        continue
      }

      try {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "uploading", message: "업로드 중..." } : f
        ))

        // 클라이언트에서 직접 Supabase Storage에 업로드 (Vercel 4.5MB 제한 우회)
        const supabase = createClient()
        const fileExt = fileData.file.name.split(".").pop()
        const uniqueFileName = `${uuidv4()}.${fileExt}`
        const filePath = `admin/${uniqueFileName}`

        const { error: uploadError } = await supabase.storage
          .from("resumes")
          .upload(filePath, fileData.file, {
            contentType: fileData.file.type,
            upsert: false,
          })

        if (uploadError) {
          throw new Error(`업로드 실패: ${uploadError.message}`)
        }

        const { data: urlData } = supabase.storage
          .from("resumes")
          .getPublicUrl(filePath)

        // 회사명 추출
        const extractedCompanies = extractCompanyFromFileName(fileData.file.name)

        setFiles(prev => prev.map((f, idx) =>
          idx === i ? { ...f, status: "analyzing", message: "AI 분석 중..." } : f
        ))

        let companies = extractedCompanies.length > 0 ? extractedCompanies : []

        if (companies.length === 0) {
          const fileName = fileData.file.name.normalize('NFC')
          if (fileName.includes('넷마블')) companies.push('넷마블')
          if (fileName.includes('넥슨')) companies.push('넥슨')
          if (fileName.includes('네오위즈')) companies.push('네오위즈')
          if (fileName.includes('엔씨소프트')) companies.push('엔씨소프트')
          else if (fileName.includes('엔씨')) companies.push('엔씨소프트')
          if (fileName.includes('스마일게이트')) companies.push('스마일게이트')
          if (fileName.includes('크래프톤')) companies.push('크래프톤')
          if (fileName.includes('펄어비스')) companies.push('펄어비스')
          if (fileName.includes('라이온하트')) companies.push('라이온하트')
          if (fileName.includes('매드엔진')) companies.push('매드엔진')
          if (fileName.includes('웹젠')) companies.push('웹젠')
          if (fileName.includes('컴투스')) companies.push('컴투스')
          if (fileName.includes('위메이드')) companies.push('위메이드')
          if (fileName.includes('카카오')) companies.push('카카오게임즈')
          if (fileName.includes('데브시스터즈')) companies.push('데브시스터즈')
          if (fileName.includes('시프트업')) companies.push('시프트업')
        }

        const result = await analyzeAndSavePortfolio({
          fileName: fileData.file.name,
          fileUrl: urlData.publicUrl,
          mimeType: fileData.file.type,
          filePath: filePath,
          companies: companies,
          year: new Date().getFullYear(),
          documentType: "학습데이터"
        })

        if (result.success) {
          const companyMsg = companies.length > 0 ? ` (${companies.join(", ")})` : ""
          setFiles(prev => prev.map((f, idx) =>
            idx === i ? {
              ...f,
              status: "success",
              message: `완료${companyMsg}`,
              score: result.score,
              companies: companies
            } : f
          ))
          setCompletedCount(prev => prev + 1)
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        setFiles(prev => prev.map((f, idx) =>
          idx === i ? {
            ...f,
            status: "error",
            message: error instanceof Error ? error.message : "분석 실패"
          } : f
        ))
      }

      setProgress(((i + 1) / totalFiles) * 100)

      if (i < files.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }

    setIsProcessing(false)
    await loadAll()
  }

  const clearAll = () => {
    setFiles([])
    setProgress(0)
    setCompletedCount(0)
  }

  const retryFailed = () => {
    setFiles(prev => prev.map(f =>
      f.status === "error" ? { ...f, status: "pending" as const, message: undefined } : f
    ))
    setProgress(0)
    setCompletedCount(0)
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const successCount = files.filter(f => f.status === "success").length
  const errorCount = files.filter(f => f.status === "error").length
  const skippedCount = files.filter(f => f.status === "skipped").length
  const pendingCount = files.filter(f => f.status === "pending").length

  // ── 데이터 관리 로직 ──
  const handleDelete = async (id: string) => {
    if (!confirm("이 학습 데이터를 삭제하시겠습니까?")) return

    setIsDeleting(true)
    const result = await deletePortfolio(id)
    if (result.success) {
      await loadAll()
    } else {
      alert("삭제 실패: " + result.error)
    }
    setIsDeleting(false)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개 학습 데이터를 삭제하시겠습니까?\n\n⚠️ 삭제하면 AI도 이 데이터를 잊어버립니다.`)) return

    setIsDeleting(true)
    const result = await deleteMultiplePortfolios(selectedIds)
    if (result.success) {
      setSelectedIds([])
      await loadAll()
      alert(`✅ ${result.count}개 데이터가 삭제되었습니다.`)
    } else {
      alert("삭제 실패: " + result.error)
    }
    setIsDeleting(false)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === portfolios.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(portfolios.map(p => p.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // ── 회사별 색상 맵 ──
  const companyColors: Record<string, string> = {
    "넥슨": "from-blue-500 to-cyan-600",
    "넷마블": "from-red-500 to-rose-600",
    "크래프톤": "from-yellow-500 to-orange-600",
    "엔씨소프트": "from-green-500 to-emerald-600",
    "스마일게이트": "from-orange-500 to-amber-600",
    "네오위즈": "from-purple-500 to-violet-600",
    "펄어비스": "from-indigo-500 to-blue-600",
    "웹젠": "from-teal-500 to-cyan-600",
    "컴투스": "from-pink-500 to-rose-600",
    "위메이드": "from-lime-500 to-green-600",
    "카카오게임즈": "from-amber-500 to-yellow-600",
    "데브시스터즈": "from-fuchsia-500 to-purple-600",
    "시프트업": "from-sky-500 to-blue-600",
    "라이온하트": "from-rose-500 to-pink-600",
    "매드엔진": "from-violet-500 to-indigo-600",
    "라이엇게임즈": "from-red-600 to-orange-600",
    "블리자드": "from-blue-600 to-indigo-600",
    "미호요": "from-cyan-500 to-teal-600",
    "일반게임회사": "from-slate-500 to-gray-600",
    "전체 합격자": "from-[#5B8DEF] to-blue-600",
  }

  return (
    <div className="py-12 px-6">
      <div className="max-w-5xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Brain className="w-8 h-8 text-[#5B8DEF]" />
              학습 데이터 관리
            </h1>
            <p className="text-slate-400">
              합격 포트폴리오를 업로드하고, 학습된 데이터를 관리하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                if (!confirm("전체 포트폴리오의 벡터 임베딩을 재생성합니다.\n기존 청크를 삭제하고 메타데이터 기반으로 다시 생성합니다.\n\n계속하시겠습니까?")) return
                setIsRebuilding(true)
                setRebuildProgress({ processed: 0, total: 0, remaining: 0 })
                try {
                  // 10개씩 배치 처리 반복
                  let totalProcessed = 0
                  let hasMore = true
                  while (hasMore) {
                    const result = await rebuildAllPortfolioChunks(10)
                    if (!result.success) {
                      alert("재임베딩 실패: " + result.error)
                      break
                    }
                    totalProcessed += result.processed
                    setRebuildProgress({
                      processed: totalProcessed,
                      total: totalProcessed + result.remaining,
                      remaining: result.remaining,
                    })
                    hasMore = result.remaining > 0
                  }
                  if (totalProcessed > 0) {
                    alert(`✅ 전체 재임베딩 완료! ${totalProcessed}개 포트폴리오 처리됨`)
                  }
                } catch (err: any) {
                  alert("재임베딩 오류: " + err.message)
                }
                setIsRebuilding(false)
              }}
              disabled={isRebuilding}
              variant="outline"
              className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
            >
              {isRebuilding ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Database className="w-4 h-4 mr-2" />
              )}
              {isRebuilding
                ? `재임베딩 중... (${rebuildProgress.processed}/${rebuildProgress.processed + rebuildProgress.remaining})`
                : "전체 재임베딩"}
            </Button>
            <Button
              onClick={async () => {
                if (!confirm("187개 포트폴리오를 Claude로 심층 분석합니다.\n(portfolio_analysis 테이블 필요)\n미분석 포트폴리오만 처리됩니다.\n\n계속하시겠습니까?")) return
                setIsDeepAnalyzing(true)
                setDeepAnalysisProgress({ analyzed: 0, total: 0, remaining: 0 })
                try {
                  let hasMore = true
                  while (hasMore) {
                    const result = await analyzePortfoliosBatch(5)
                    if (!result.success) {
                      alert("심층 분석 실패: " + result.error)
                      break
                    }
                    setDeepAnalysisProgress({
                      analyzed: result.data.analyzed,
                      total: result.data.total,
                      remaining: result.data.remaining,
                    })
                    hasMore = result.data.remaining > 0
                  }
                  const stats = await getPortfolioAnalysisStats()
                  if (stats.success) {
                    alert(`심층 분석 완료! ${stats.data.analyzed}/${stats.data.total}개 분석됨 (평균 ${stats.data.avgScore}점)`)
                  }
                } catch (err: any) {
                  alert("심층 분석 오류: " + err.message)
                }
                setIsDeepAnalyzing(false)
              }}
              disabled={isDeepAnalyzing}
              variant="outline"
              className="border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            >
              {isDeepAnalyzing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              {isDeepAnalyzing
                ? `심층 분석 중... (${deepAnalysisProgress.analyzed}/${deepAnalysisProgress.total})`
                : "심층 분석"}
            </Button>
            <Button
              onClick={async () => {
                setIsReclassifying(true)
                const result = await reclassifyAllCompanies()
                if (result.success) {
                  alert(`재분류 완료! ${result.total}개 중 ${result.updated}개 수정됨`)
                  await loadAll()
                } else {
                  alert("재분류 실패: " + result.error)
                }
                setIsReclassifying(false)
              }}
              disabled={isReclassifying}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              {isReclassifying ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              회사 재분류
            </Button>
            <Button
              onClick={loadAll}
              disabled={isLoadingStats || isLoadingData}
              variant="outline"
              className="border-[#1e3a5f] text-slate-300 hover:bg-slate-800"
            >
              {(isLoadingStats || isLoadingData) ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              새로고침
            </Button>
          </div>
        </div>

        {/* 회사별 학습 데이터 통계 (공통) */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-lg text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#5B8DEF]" />
              회사별 학습 데이터 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingStats ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#5B8DEF]" />
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                {Object.entries(companyStats).map(([company, count]) => (
                  <div
                    key={company}
                    className={`bg-gradient-to-br ${companyColors[company] || "from-slate-600 to-slate-700"} rounded-lg p-3 text-white shadow-md`}
                  >
                    <div className="text-xs font-medium mb-0.5 opacity-90">{company}</div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-[10px] opacity-75">개 학습됨</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 탭 전환 */}
        <div className="flex gap-1 mb-6 bg-slate-900/80 p-1 rounded-xl border border-[#1e3a5f]">
          <button
            onClick={() => setActiveTab("upload")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "upload"
                ? "bg-[#5B8DEF] text-white shadow-lg"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Upload className="w-4 h-4" />
            파일 업로드
          </button>
          <button
            onClick={() => setActiveTab("data")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
              activeTab === "data"
                ? "bg-[#5B8DEF] text-white shadow-lg"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            }`}
          >
            <Database className="w-4 h-4" />
            데이터 관리
            <span className="text-xs opacity-75">({portfolios.length})</span>
          </button>
        </div>

        {/* ═══════════════════════════════════ */}
        {/* 업로드 탭 */}
        {/* ═══════════════════════════════════ */}
        {activeTab === "upload" && (
          <>
            {/* 업로드 통계 */}
            {files.length > 0 && (
              <Card className="bg-slate-900/80 border-[#1e3a5f] mb-6">
                <CardContent className="pt-6">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-3xl font-bold text-[#5B8DEF]">{files.length}</p>
                      <p className="text-slate-400 text-sm mt-1">총 파일</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-emerald-400">{successCount}</p>
                      <p className="text-slate-400 text-sm mt-1">성공</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-amber-400">{skippedCount}</p>
                      <p className="text-slate-400 text-sm mt-1">중복</p>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-red-400">{errorCount}</p>
                      <p className="text-slate-400 text-sm mt-1">실패</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 드롭존 */}
            <Card className="bg-slate-900/80 border-[#1e3a5f] mb-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-[#5B8DEF]" />
                  파일 선택
                </CardTitle>
                <CardDescription className="text-slate-400">
                  PDF, Excel, CSV, TXT, JPG, PNG 파일을 드래그하거나 클릭하여 선택하세요. (최대 200MB)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                    isDragActive
                      ? "border-[#5B8DEF] bg-[#5B8DEF]/10 scale-[1.02]"
                      : "border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-800/30"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Database className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-300 text-lg mb-1">
                    {isDragActive ? "여기에 놓으세요" : "파일을 여기에 드래그"}
                  </p>
                  <p className="text-slate-500 text-sm">또는 클릭하여 선택</p>
                </div>

                {/* 파일 목록 */}
                {files.length > 0 && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[#5B8DEF] text-sm font-medium">
                        {files.length}개 파일 선택됨
                      </p>
                      {!isProcessing && (
                        <Button
                          onClick={clearAll}
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          전체 삭제
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 max-h-64 overflow-auto">
                      {files.map((fileData, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            fileData.status === "success" ? "bg-emerald-500/10 border border-emerald-500/20" :
                            fileData.status === "error" ? "bg-red-500/10 border border-red-500/20" :
                            fileData.status === "skipped" ? "bg-amber-500/10 border border-amber-500/20" :
                            fileData.status === "analyzing" ? "bg-[#5B8DEF]/10 border border-[#5B8DEF]/20" :
                            fileData.status === "uploading" ? "bg-amber-500/10 border border-amber-500/20" :
                            "bg-slate-800/50 border border-transparent"
                          }`}
                        >
                          {fileData.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-slate-500" />}
                          {fileData.status === "uploading" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                          {fileData.status === "analyzing" && <Loader2 className="w-4 h-4 text-[#5B8DEF] animate-spin" />}
                          {fileData.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                          {fileData.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                          {fileData.status === "skipped" && <AlertTriangle className="w-4 h-4 text-amber-400" />}

                          <FileText className="w-4 h-4 text-[#5B8DEF] shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-slate-300 text-sm truncate">{fileData.file.name}</p>
                            <p className="text-slate-500 text-xs">{(fileData.file.size / 1024 / 1024).toFixed(2)}MB</p>
                          </div>

                          {fileData.score && (
                            <span className="text-[#5B8DEF] font-bold text-sm">{fileData.score}점</span>
                          )}

                          {fileData.message && (
                            <span className={`text-xs ${
                              fileData.status === "error" ? "text-red-400" : "text-slate-400"
                            }`}>{fileData.message}</span>
                          )}

                          {!isProcessing && fileData.status === "pending" && (
                            <button
                              onClick={() => removeFile(idx)}
                              className="text-slate-400 hover:text-red-400 transition-colors"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 실행 버튼 */}
            <Card className="bg-slate-900/80 border-[#1e3a5f]">
              <CardContent className="pt-6">
                <Button
                  onClick={startTraining}
                  disabled={isProcessing || files.length === 0 || pendingCount === 0}
                  className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white h-14 text-lg disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      AI 학습 중... ({completedCount}/{files.length})
                    </>
                  ) : (
                    <>
                      <Brain className="w-5 h-5 mr-2" />
                      학습 시작 ({pendingCount}개 파일{skippedCount > 0 ? `, ${skippedCount}개 중복` : ''})
                    </>
                  )}
                </Button>

                {isProcessing && (
                  <div className="mt-4">
                    <div className="flex justify-between text-sm text-slate-400 mb-2">
                      <span>진행률</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                {!isProcessing && completedCount > 0 && (
                  <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <p className="text-emerald-400 text-center font-medium">
                      총 {successCount}개 데이터 학습 완료!
                      {errorCount > 0 && ` (${errorCount}개 실패)`}
                    </p>
                  </div>
                )}

                {!isProcessing && errorCount > 0 && (
                  <Button
                    onClick={retryFailed}
                    className="w-full mt-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 h-12"
                    variant="outline"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    실패 {errorCount}개 재시도
                  </Button>
                )}

                <p className="text-slate-500 text-xs text-center mt-4">
                  * Gemini AI가 각 파일을 분석하여 점수, 태그, 요약을 추출하고 DB에 저장합니다.<br/>
                  * 큰 파일은 처리 시간이 오래 걸릴 수 있습니다. (최대 200MB)
                </p>
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════════════════════════════════ */}
        {/* 데이터 관리 탭 */}
        {/* ═══════════════════════════════════ */}
        {activeTab === "data" && (
          <>
            {/* 전체 통계 */}
            <Card className="bg-slate-900/80 border-[#1e3a5f] mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-3xl font-bold text-[#5B8DEF]">{portfolios.length}</p>
                    <p className="text-slate-400 text-sm mt-1">총 학습 데이터</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-emerald-400">{selectedIds.length}</p>
                    <p className="text-slate-400 text-sm mt-1">선택됨</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-slate-400">
                      {portfolios.length > 0 ? Math.round(portfolios.reduce((sum: number, p: any) => sum + (p.overall_score || 0), 0) / portfolios.length) : 0}
                    </p>
                    <p className="text-slate-400 text-sm mt-1">평균 점수</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 데이터 목록 */}
            <Card className="bg-slate-900/80 border-[#1e3a5f]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white">학습 데이터 목록</CardTitle>
                  {selectedIds.length > 0 && (
                    <Button
                      onClick={handleBulkDelete}
                      disabled={isDeleting}
                      variant="destructive"
                      size="sm"
                      className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      선택 삭제 ({selectedIds.length})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingData ? (
                  <div className="text-center py-12">
                    <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin mx-auto mb-4" />
                    <p className="text-slate-400">데이터 로딩 중...</p>
                  </div>
                ) : portfolios.length === 0 ? (
                  <div className="text-center py-12">
                    <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400 mb-2">학습 데이터가 없습니다</p>
                    <p className="text-slate-500 text-sm">
                      &ldquo;파일 업로드&rdquo; 탭에서 포트폴리오를 업로드하세요
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 전체 선택 */}
                    <div className="flex items-center gap-3 pb-3 border-b border-[#1e3a5f] mb-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === portfolios.length && portfolios.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#5B8DEF]"
                      />
                      <span className="text-slate-400 text-sm">전체 선택</span>
                    </div>

                    {/* 목록 */}
                    <div className="space-y-2 max-h-[600px] overflow-auto">
                      {portfolios.map((portfolio: any) => (
                        <div
                          key={portfolio.id}
                          className={`flex items-center gap-3 p-4 rounded-lg transition-colors ${
                            selectedIds.includes(portfolio.id)
                              ? "bg-[#5B8DEF]/10 border border-[#5B8DEF]/30"
                              : "bg-slate-800/50 border border-transparent hover:bg-slate-800"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(portfolio.id)}
                            onChange={() => toggleSelect(portfolio.id)}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#5B8DEF]"
                          />

                          <div className="flex-1 min-w-0">
                            <p className="text-slate-200 font-medium truncate">{portfolio.file_name}</p>
                            <div className="flex items-center gap-3 mt-2">
                              {portfolio.companies?.length > 0 ? (
                                <div className="flex items-center gap-2">
                                  {portfolio.companies.map((company: string, idx: number) => (
                                    <span key={idx} className="text-xs px-2 py-1 bg-[#5B8DEF]/10 text-[#5B8DEF] rounded">
                                      {company}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-slate-500">회사 미지정</span>
                              )}
                              <span className="text-xs text-slate-500">{portfolio.year}년</span>
                              <span className="text-xs text-slate-500">{portfolio.document_type}</span>
                            </div>
                            {portfolio.tags?.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                {portfolio.tags.slice(0, 5).map((tag: string, idx: number) => (
                                  <span key={idx} className="text-xs px-2 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                                    {tag}
                                  </span>
                                ))}
                                {portfolio.tags.length > 5 && (
                                  <span className="text-xs text-slate-500">+{portfolio.tags.length - 5}</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-[#5B8DEF] font-bold text-lg">{portfolio.overall_score}점</p>
                            <div className="flex gap-1 mt-1">
                              <span className="text-xs text-slate-500">논리 {portfolio.logic_score}</span>
                              <span className="text-xs text-slate-500">구체 {portfolio.specificity_score}</span>
                              <span className="text-xs text-slate-500">가독 {portfolio.readability_score}</span>
                            </div>
                            <p className="text-slate-500 text-xs mt-1">
                              {new Date(portfolio.created_at).toLocaleDateString('ko-KR')}
                            </p>
                          </div>

                          {portfolio.file_url && (
                            <a
                              href={portfolio.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-500 hover:text-[#5B8DEF] transition-colors p-2"
                              title="파일 보기"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}

                          <button
                            onClick={() => handleDelete(portfolio.id)}
                            disabled={isDeleting}
                            className="text-slate-500 hover:text-red-400 transition-colors p-2"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-amber-400 text-sm">
                    ⚠️ <strong>주의:</strong> 학습 데이터를 삭제하면 AI가 해당 데이터를 더 이상 참고하지 않습니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
