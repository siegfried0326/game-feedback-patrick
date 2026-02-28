/**
 * 관리자 대시보드 — 학습 데이터 관리 (465줄)
 *
 * 기능:
 * - 포트폴리오 PDF 업로드 → Supabase Storage 저장
 * - Gemini AI 분석 실행 (회사/데이터 테이블 생성)
 * - 기존 포트폴리오 목록 조회/삭제
 * - 분석 상태 실시간 표시 (분석중/완료/실패)
 *
 * 접근: 관리자 이메일만 허용 (middleware + 서버 액션 이중 체크)
 * 라우트: /admin
 */
"use client"

import { useState, useCallback, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import { Upload, FileText, Loader2, CheckCircle2, XCircle, Database, Trash2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { uploadAdminFile, analyzeAndSavePortfolio, getPortfolioStats, getPortfolioList, deletePortfolio, deleteMultiplePortfolios } from "@/app/actions/admin"

interface UploadStatus {
  fileName: string
  status: "pending" | "uploading" | "analyzing" | "success" | "error"
  message?: string
  score?: number
}

export default function AdminPage() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([])
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stats, setStats] = useState<{ total: number; companies: string[] } | null>(null)
  const [portfolioList, setPortfolioList] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    loadStats()
    loadPortfolioList()
  }, [])

  // PDF 파일 드롭존
  const onPdfDrop = useCallback((acceptedFiles: File[]) => {
    setPdfFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps: getPdfRootProps, getInputProps: getPdfInputProps, isDragActive: isPdfDragActive } = useDropzone({
    onDrop: onPdfDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"]
    }
  })

  // 일괄 분석 시작 (Supabase Storage + Gemini 직접 읽기)
  const startBatchAnalysis = async () => {
    if (pdfFiles.length === 0) {
      alert("파일을 업로드해주세요.")
      return
    }

    setIsProcessing(true)
    setProgress(0)

    // 초기 상태 설정
    const initialStatuses: UploadStatus[] = pdfFiles.map(file => ({
      fileName: file.name,
      status: "pending"
    }))
    setUploadStatuses(initialStatuses)

    // 각 파일 처리
    for (let i = 0; i < pdfFiles.length; i++) {
      const file = pdfFiles[i]

      try {
        // 1단계: Supabase Storage에 업로드
        setUploadStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "uploading", message: "업로드 중..." } : s
        ))

        const formData = new FormData()
        formData.append("file", file)
        
        const uploadResult = await uploadAdminFile(formData)
        
        if (uploadResult.error) {
          throw new Error(uploadResult.error)
        }

        // 2단계: Gemini가 PDF를 직접 읽어서 분석
        setUploadStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "analyzing", message: "AI 분석 중..." } : s
        ))
        
        const result = await analyzeAndSavePortfolio({
          fileName: uploadResult.data!.fileName,
          fileUrl: uploadResult.data!.fileUrl,
          mimeType: uploadResult.data!.mimeType,
          filePath: uploadResult.data!.filePath,
          companies: [], // 나중에 추가 가능
          year: new Date().getFullYear(),
          documentType: "미분류"
        })

        if (result.success) {
          setUploadStatuses(prev => prev.map((s, idx) => 
            idx === i ? { ...s, status: "success", message: `점수: ${result.score}점`, score: result.score } : s
          ))
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        setUploadStatuses(prev => prev.map((s, idx) => 
          idx === i ? { ...s, status: "error", message: error instanceof Error ? error.message : "알 수 없는 오류" } : s
        ))
      }

      setProgress(((i + 1) / pdfFiles.length) * 100)
      
      // Rate limiting - 각 요청 사이 2초 대기
      if (i < pdfFiles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    setIsProcessing(false)
    
    // 분석 완료 후 파일 목록 초기화
    setPdfFiles([])
    
    // 통계 및 목록 새로고침
    loadStats()
    loadPortfolioList()
  }

  const loadStats = async () => {
    const result = await getPortfolioStats()
    if (result.success) {
      setStats(result.data)
    }
  }

  const loadPortfolioList = async () => {
    const result = await getPortfolioList()
    if (result.success && result.data) {
      setPortfolioList(result.data)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("이 포트폴리오를 삭제하시겠습니까?")) return
    
    setIsDeleting(true)
    const result = await deletePortfolio(id)
    if (result.success) {
      loadPortfolioList()
      loadStats()
    } else {
      alert("삭제 실패: " + result.error)
    }
    setIsDeleting(false)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개 포트폴리오를 삭제하시겠습니까?`)) return
    
    setIsDeleting(true)
    const result = await deleteMultiplePortfolios(selectedIds)
    if (result.success) {
      setSelectedIds([])
      loadPortfolioList()
      loadStats()
    } else {
      alert("삭제 실패: " + result.error)
    }
    setIsDeleting(false)
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === portfolioList.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(portfolioList.map(p => p.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const clearAll = () => {
    setPdfFiles([])
    setUploadStatuses([])
    setProgress(0)
  }

  const removePdf = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="min-h-screen bg-[#0a1628] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">포트폴리오 학습 관리</h1>
          <p className="text-slate-400">PDF 파일을 업로드하면 AI가 원본 그대로 직접 읽고 분석합니다. (화질 저하 없음)</p>
        </div>

        {/* 통계 카드 */}
        <Card className="bg-slate-900/80 border-[#1e3a5f] mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-white flex items-center gap-2 text-lg">
              <Database className="w-5 h-5 text-[#5B8DEF]" />
              현재 학습된 데이터
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              <div>
                <p className="text-5xl font-bold text-[#5B8DEF]">{stats?.total || 0}개</p>
                <p className="text-slate-400 text-sm mt-1">합격 포트폴리오</p>
              </div>
              {stats?.companies && stats.companies.length > 0 && (
                <div className="flex-1">
                  <p className="text-slate-400 text-sm mb-2">합격 회사</p>
                  <div className="flex flex-wrap gap-2">
                    {stats.companies.slice(0, 8).map((company, idx) => (
                      <span key={idx} className="px-2 py-1 bg-[#5B8DEF]/10 text-[#5B8DEF] text-xs rounded-full">
                        {company}
                      </span>
                    ))}
                    {stats.companies.length > 8 && (
                      <span className="px-2 py-1 bg-slate-800 text-slate-400 text-xs rounded-full">
                        +{stats.companies.length - 8}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* PDF 업로드 */}
        <Card className="bg-slate-900/80 border-[#1e3a5f] mb-6">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#5B8DEF]" />
              PDF 파일 업로드
            </CardTitle>
            <CardDescription className="text-slate-400">
              합격 포트폴리오 PDF를 드래그하거나 클릭하여 업로드하세요. 여러 개 가능합니다. (최대 500MB)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              {...getPdfRootProps()}
              className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                isPdfDragActive 
                  ? "border-[#5B8DEF] bg-[#5B8DEF]/10 scale-[1.02]" 
                  : "border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-800/30"
              }`}
            >
              <input {...getPdfInputProps()} />
              <Upload className="w-12 h-12 text-slate-500 mx-auto mb-4" />
              <p className="text-slate-300 text-lg mb-1">PDF 파일을 여기에 드래그</p>
              <p className="text-slate-500 text-sm">또는 클릭하여 선택 (.pdf, .docx, .txt)</p>
            </div>

            {/* 업로드된 파일 목록 */}
            {pdfFiles.length > 0 && (
              <div className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[#5B8DEF] text-sm font-medium">
                    {pdfFiles.length}개 파일 선택됨
                  </p>
                  <Button
                    onClick={clearAll}
                    variant="ghost"
                    size="sm"
                    className="text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    모두 삭제
                  </Button>
                </div>
                <div className="space-y-2 max-h-48 overflow-auto">
                  {pdfFiles.map((file, idx) => (
                    <div 
                      key={idx} 
                      className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg group"
                    >
                      <FileText className="w-4 h-4 text-[#5B8DEF]" />
                      <span className="text-slate-300 text-sm flex-1 truncate">{file.name}</span>
                      <span className="text-slate-500 text-xs">{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                      <button
                        onClick={() => removePdf(idx)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-400 transition-opacity"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 분석 시작 버튼 */}
        <Card className="bg-slate-900/80 border-[#1e3a5f]">
          <CardContent className="pt-6">
            <Button
              onClick={startBatchAnalysis}
              disabled={isProcessing || pdfFiles.length === 0}
              className="w-full bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white h-14 text-lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  AI 분석 중... ({Math.round(progress)}%)
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 mr-2" />
                  AI 분석 시작 ({pdfFiles.length}개 파일)
                </>
              )}
            </Button>

            {/* 진행률 */}
            {isProcessing && (
              <div className="mt-4">
                <Progress value={progress} className="h-2" />
              </div>
            )}

            {/* 분석 결과 리스트 */}
            {uploadStatuses.length > 0 && (
              <div className="mt-6 space-y-2 max-h-64 overflow-auto">
                {uploadStatuses.map((status, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      status.status === "success" ? "bg-emerald-500/10 border border-emerald-500/20" :
                      status.status === "error" ? "bg-red-500/10 border border-red-500/20" :
                      status.status === "uploading" ? "bg-amber-500/10 border border-amber-500/20" :
                      status.status === "analyzing" ? "bg-[#5B8DEF]/10 border border-[#5B8DEF]/20" :
                      "bg-slate-800/50 border border-transparent"
                    }`}
                  >
                    {status.status === "pending" && <div className="w-4 h-4 rounded-full border-2 border-slate-500" />}
                    {status.status === "uploading" && <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />}
                    {status.status === "analyzing" && <Loader2 className="w-4 h-4 text-[#5B8DEF] animate-spin" />}
                    {status.status === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                    {status.status === "error" && <XCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-slate-300 text-sm flex-1 truncate">{status.fileName}</span>
                    {status.score && (
                      <span className="text-[#5B8DEF] font-bold">{status.score}점</span>
                    )}
                    {status.message && status.status !== "success" && (
                      <span className={`text-xs truncate max-w-[150px] ${
                        status.status === "error" ? "text-red-400" : "text-slate-400"
                      }`}>{status.message}</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 안내 메시지 */}
            <p className="text-slate-500 text-xs text-center mt-4">
              * Gemini AI가 PDF를 원본 그대로 직접 읽어서 분석합니다. 화질 저하 없이 모든 페이지를 분석합니다.
            </p>
          </CardContent>
        </Card>

        {/* 학습된 데이터 목록 */}
        {portfolioList.length > 0 && (
          <Card className="bg-slate-900/80 border-[#1e3a5f] mt-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#5B8DEF]" />
                  학습된 포트폴리오 목록 ({portfolioList.length}개)
                </CardTitle>
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
              {/* 전체 선택 */}
              <div className="flex items-center gap-3 pb-3 border-b border-[#1e3a5f] mb-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === portfolioList.length && portfolioList.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-[#5B8DEF]"
                />
                <span className="text-slate-400 text-sm">전체 선택</span>
              </div>

              {/* 목록 */}
              <div className="space-y-2 max-h-96 overflow-auto">
                {portfolioList.map((portfolio) => (
                  <div
                    key={portfolio.id}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
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
                    <FileText className="w-4 h-4 text-[#5B8DEF] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-200 text-sm truncate">{portfolio.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {portfolio.companies?.length > 0 ? (
                          portfolio.companies.map((company: string, idx: number) => (
                            <span key={idx} className="text-xs px-2 py-0.5 bg-[#5B8DEF]/10 text-[#5B8DEF] rounded">
                              {company}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">회사 미지정</span>
                        )}
                        <span className="text-xs text-slate-500">{portfolio.year}년</span>
                        <span className="text-xs text-slate-500">{portfolio.document_type}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[#5B8DEF] font-bold">{portfolio.overall_score}점</p>
                      <p className="text-slate-500 text-xs">
                        {new Date(portfolio.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(portfolio.id)}
                      disabled={isDeleting}
                      className="text-slate-500 hover:text-red-400 transition-colors p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
