"use client"

import React, { useState, useCallback } from "react"
import { Upload, FileText, Sparkles, Database, Loader2, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ScoreCard } from "@/components/score-card"
import { RadarChartComponent } from "@/components/radar-chart-component"
import { FeedbackCards } from "@/components/feedback-cards"
import { uploadFileToStorage, analyzeDocumentDirect, deleteFileFromStorage } from "@/app/actions/analyze"

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

export function HeroSection() {
  const [isDragging, setIsDragging] = useState(false)
  const [files, setFiles] = useState<FileStatus[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [results, setResults] = useState<AnalysisResult[]>([])
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("")

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      handleFileUpload(droppedFiles)
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFileUpload(Array.from(selectedFiles))
    }
  }, [])

  // 파일 분석 실행 (Supabase Storage + Gemini 직접 읽기)
  const handleAnalyzeFiles = async (filesToAnalyze: FileStatus[]) => {
    setIsAnalyzing(true)
    setError(null)
    setResults([])
    setCurrentResultIndex(0)

    const newResults: AnalysisResult[] = []

    for (let i = 0; i < filesToAnalyze.length; i++) {
      const fileStatus = filesToAnalyze[i]

      try {
        // 1단계: 파일 업로드 중 표시
        setStatusMessage("파일을 업로드하는 중...")
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "uploading" } : f
        ))

        // Supabase Storage에 업로드
        const formData = new FormData()
        formData.append("file", fileStatus.file)
        
        const uploadResult = await uploadFileToStorage(formData)
        
        if (uploadResult.error) {
          setFiles(prev => prev.map((f, idx) => 
            idx === i ? { ...f, status: "error", error: uploadResult.error } : f
          ))
          continue
        }

        // 2단계: 분석 중 표시
        setStatusMessage("AI가 문서를 분석하는 중...")
        setFiles(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: "analyzing" } : f
        ))

        // Gemini가 PDF를 직접 읽어서 분석
        const analysisResult = await analyzeDocumentDirect({
          fileName: uploadResult.data!.fileName,
          fileUrl: uploadResult.data!.fileUrl,
          mimeType: uploadResult.data!.mimeType,
          filePath: uploadResult.data!.filePath,
        })
        
        if (analysisResult.error) {
          // 분석 실패 시 Storage 파일 삭제
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

      // Rate limiting
      if (i < filesToAnalyze.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setStatusMessage("")
    setIsAnalyzing(false)
  }

  const handleFileUpload = (uploadedFiles: File[]) => {
    // 파일 타입 체크
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
    const validFiles = uploadedFiles.filter(file => {
      if (!validTypes.includes(file.type)) {
        return false
      }
      if (file.size > 50 * 1024 * 1024) {
        return false
      }
      return true
    })

    if (validFiles.length === 0) {
      alert('PDF, DOCX, TXT 파일만 업로드 가능합니다. (최대 50MB)')
      return
    }

    const newFiles: FileStatus[] = validFiles.map(file => ({
      file,
      status: "pending" as const
    }))

    setFiles(newFiles)
    setResults([])
    setError(null)

    // 바로 분석 시작
    handleAnalyzeFiles(newFiles)
  }

  const handleReset = () => {
    setFiles([])
    setResults([])
    setCurrentResultIndex(0)
    setError(null)
    setIsAnalyzing(false)
    setStatusMessage("")
  }

  // 분석 결과가 있으면 결과 화면 표시
  if (results.length > 0) {
    const currentResult = results[currentResultIndex]
    
    return (
      <section className="min-h-screen py-12 px-6 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
        <div className="max-w-6xl mx-auto">
          {/* 헤더 */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2 text-[#5B8DEF]">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">
                {results.length === 1 ? "분석 완료" : `${results.length}개 문서 분석 완료`}
              </span>
            </div>
            <Button
              variant="outline"
              onClick={handleReset}
              className="border-[#1e3a5f] text-slate-300 hover:bg-slate-800 bg-transparent"
            >
              새로운 분석 시작
            </Button>
          </div>

          {/* 여러 문서일 때 탭 */}
          {results.length > 1 && (
            <div className="flex gap-2 flex-wrap mb-6">
              {results.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentResultIndex(idx)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    currentResultIndex === idx 
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

          {currentResult && (
            <>
              {results.length > 1 && (
                <p className="text-slate-400 text-sm mb-4">
                  현재 보기: <span className="text-white">{currentResult.fileName}</span>
                </p>
              )}

              <div className="grid lg:grid-cols-2 gap-8 mb-8">
                <ScoreCard score={currentResult.score} />
                <RadarChartComponent data={currentResult.categories} />
              </div>

              {/* Ranking Section */}
              {currentResult.ranking && currentResult.ranking.total > 0 && (
                <Card className="bg-slate-900/80 border-[#1e3a5f] mb-8">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      합격 포트폴리오 {currentResult.ranking.total}개 기준 랭킹
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="text-center">
                        <p className="text-slate-400 text-sm mb-2">전체 랭킹</p>
                        <p className="text-5xl font-bold text-[#5B8DEF] mb-2">
                          상위 {100 - currentResult.ranking.percentile}%
                        </p>
                        <p className="text-slate-400 text-sm">
                          {currentResult.ranking.total}개 합격 포트폴리오 중
                        </p>
                      </div>
                      {currentResult.ranking.companyComparison && currentResult.ranking.companyComparison.length > 0 && (
                        <div>
                          <p className="text-slate-400 text-sm mb-3">회사별 합격자 평균 비교</p>
                          <div className="space-y-2">
                            {currentResult.ranking.companyComparison.map((comp, idx) => (
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
                                <span className={`text-sm font-medium ${currentResult.score >= comp.avgScore ? 'text-emerald-400' : 'text-amber-400'}`}>
                                  {currentResult.score >= comp.avgScore ? '+' : ''}{currentResult.score - comp.avgScore}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <FeedbackCards 
                strengths={currentResult.strengths} 
                weaknesses={currentResult.weaknesses} 
              />
            </>
          )}
        </div>
      </section>
    )
  }

  // 분석 중이거나 파일이 선택되어 있을 때
  if (isAnalyzing || files.length > 0) {
    return (
      <section className="min-h-[90vh] flex items-center justify-center px-6 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
        <div className="max-w-xl mx-auto w-full">
          <Card className="bg-slate-900/80 border-[#1e3a5f]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Loader2 className="w-5 h-5 text-[#5B8DEF] animate-spin" />
                문서 분석 중
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
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
                        <p className="text-sm text-white truncate max-w-[250px]">{fileStatus.file.name}</p>
                        <p className="text-xs text-slate-500">
                          {(fileStatus.file.size / 1024 / 1024).toFixed(2)} MB
                          {fileStatus.result && ` • ${fileStatus.result.score}점`}
                          {fileStatus.error && ` • ${fileStatus.error}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {isAnalyzing && (
                <div className="mt-6">
                  <Progress value={
                    (files.filter(f => f.status === "success" || f.status === "error").length / files.length) * 100
                  } className="h-2" />
                  <p className="text-center text-sm text-slate-400 mt-2">
                    {statusMessage || "AI가 PDF 문서를 직접 읽고 분석하고 있습니다..."}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    )
  }

  // 기본 업로드 화면
  return (
    <section className="min-h-[90vh] flex items-center justify-center px-6 bg-gradient-to-b from-[#0a1628] to-[#0d1f3c]">
      <div className="max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8">
          <Sparkles className="w-4 h-4" />
          첫 1회 무료
        </div>
        
        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight tracking-tight mb-4">
          게임 기획 문서 <span className="text-[#5B8DEF]">AI 피드백</span>
        </h1>
        
        {/* Subtitle */}
        <p className="text-slate-400 mb-6 flex items-center justify-center gap-2">
          <Database className="w-4 h-4 text-[#5B8DEF]" />
          <span>실제 합격 포트폴리오 <span className="text-[#5B8DEF] font-semibold">133개</span>로 학습된 AI</span>
        </p>

        {/* Upload Area */}
        <div 
          className={`relative bg-slate-900/80 border-2 border-dashed rounded-2xl p-8 md:p-12 transition-all duration-300 cursor-pointer group ${
            isDragging 
              ? 'border-[#5B8DEF] bg-[#5B8DEF]/5 scale-[1.02]' 
              : 'border-[#1e3a5f] hover:border-[#5B8DEF]/50 hover:bg-slate-900'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx,.txt"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <div className="flex flex-col items-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors ${
              isDragging ? 'bg-[#5B8DEF]/20' : 'bg-[#5B8DEF]/10 group-hover:bg-[#5B8DEF]/20'
            }`}>
              {isDragging ? (
                <FileText className="w-8 h-8 text-[#5B8DEF]" />
              ) : (
                <Upload className="w-8 h-8 text-[#5B8DEF]" />
              )}
            </div>
            
            <p className="text-white font-medium mb-2">
              {isDragging ? '여기에 놓으세요' : '문서를 드래그하거나 클릭하여 업로드'}
            </p>
            <p className="text-slate-500 text-sm">
              PDF, DOCX, TXT (최대 50MB)
            </p>
          </div>

          {/* Decorative Corner Icons */}
          <div className="absolute top-4 left-4 w-3 h-3 border-l-2 border-t-2 border-[#5B8DEF]/30 rounded-tl" />
          <div className="absolute top-4 right-4 w-3 h-3 border-r-2 border-t-2 border-[#5B8DEF]/30 rounded-tr" />
          <div className="absolute bottom-4 left-4 w-3 h-3 border-l-2 border-b-2 border-[#5B8DEF]/30 rounded-bl" />
          <div className="absolute bottom-4 right-4 w-3 h-3 border-r-2 border-b-2 border-[#5B8DEF]/30 rounded-br" />
        </div>

        {/* Bottom Note */}
        <p className="mt-6 text-slate-500 text-sm">
          업로드 시 <span className="text-slate-400">개인정보 처리방침</span>에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </section>
  )
}
