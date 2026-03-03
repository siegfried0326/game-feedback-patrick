/**
 * 합격자 공통점 50가지 확인 페이지
 *
 * 기능:
 * - 일반 공통점 35개 (general) + 회사별 특징 15개를 탭으로 구분
 * - 중요도별 색상 표시 (high=빨강, medium=노랑, low=회색)
 * - 카테고리 필터링
 * - 관리자 전용 (middleware에서 체크)
 * - 잘린 JSON 자동 복구 (Claude 응답이 max_tokens에 도달 시)
 *
 * 라우트: /admin/success-patterns
 */
"use client"

import { useState, useEffect } from "react"
import { Loader2, Star, Building2, Lightbulb, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getSuccessPatterns, extractSuccessPatterns } from "@/app/actions/admin"
import Link from "next/link"

// 패턴 데이터 타입
interface Pattern {
  id: string
  pattern_number: number
  category: string
  title: string
  description: string
  importance: string
  example_files: string[]
  batch_id: string
  created_at: string
}

export default function SuccessPatternsPage() {
  // 패턴 목록
  const [patterns, setPatterns] = useState<Pattern[]>([])
  // 통계
  const [stats, setStats] = useState<{ total: number; general: number; company: number; companies: string[] } | null>(null)
  // 현재 선택된 카테고리 탭
  const [activeTab, setActiveTab] = useState<string>("general")
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(true)
  // 추출 중 상태
  const [isExtracting, setIsExtracting] = useState(false)
  // 에러 메시지
  const [error, setError] = useState<string | null>(null)
  // 추출 결과 메시지
  const [extractMessage, setExtractMessage] = useState<string | null>(null)

  // 페이지 로드 시 데이터 조회
  useEffect(() => {
    loadPatterns()
  }, [])

  // 패턴 데이터 로드
  const loadPatterns = async () => {
    setIsLoading(true)
    setError(null)
    const result = await getSuccessPatterns()
    if (result.success && result.data) {
      setPatterns(result.data.patterns)
      setStats(result.data.stats)
    } else {
      setError(result.error || "데이터를 불러올 수 없습니다.")
    }
    setIsLoading(false)
  }

  // 공통점 추출 실행
  const handleExtract = async () => {
    if (isExtracting) return
    if (!confirm("합격자 공통점 50가지를 새로 추출합니다. 기존 데이터는 삭제됩니다. 약 2~3분 걸립니다. 계속하시겠습니까?")) return

    setIsExtracting(true)
    setExtractMessage(null)
    setError(null)

    const result = await extractSuccessPatterns()
    if (result.success && result.data) {
      setExtractMessage(
        `✅ ${result.data.total}개 추출 완료! (일반 ${result.data.general}개 + 회사별 ${result.data.company}개)`
      )
      // 데이터 새로고침
      await loadPatterns()
    } else {
      setError(result.error || "추출 실패")
    }
    setIsExtracting(false)
  }

  // 현재 탭에 해당하는 패턴만 필터
  const filteredPatterns = patterns.filter(p => p.category === activeTab)

  // 중요도 뱃지 색상
  const importanceBadge = (importance: string) => {
    switch (importance) {
      case "high":
        return "bg-red-500/20 text-red-300 border-red-500/30"
      case "medium":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30"
      case "low":
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  // 중요도 한글
  const importanceLabel = (importance: string) => {
    switch (importance) {
      case "high": return "핵심"
      case "medium": return "유용"
      case "low": return "참고"
      default: return importance
    }
  }

  return (
    <div className="py-12 px-6">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8">
          <Link href="/admin" className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4">
            <ArrowLeft className="w-4 h-4" />
            관리자 대시보드로 돌아가기
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
            <Lightbulb className="w-8 h-8 text-amber-400" />
            합격자 공통점 50가지
          </h1>
          <p className="text-slate-400">
            {stats ? `${stats.total}개 패턴 (일반 ${stats.general}개 + 회사별 ${stats.company}개)` : "데이터 로딩 중..."}
          </p>
        </div>

        {/* 추출 버튼 + 새로고침 */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={handleExtract}
            disabled={isExtracting}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                AI 분석 중... (2~3분 소요)
              </>
            ) : (
              <>
                <Lightbulb className="w-4 h-4 mr-2" />
                공통점 새로 추출하기
              </>
            )}
          </Button>
          <Button
            onClick={loadPatterns}
            disabled={isLoading || isExtracting}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            새로고침
          </Button>
        </div>

        {/* 추출 결과 메시지 */}
        {extractMessage && (
          <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-300 text-sm">
            {extractMessage}
          </div>
        )}

        {/* 에러 표시 */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* 로딩 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
            <span className="text-slate-400 ml-3">데이터 불러오는 중...</span>
          </div>
        )}

        {/* 데이터 없음 */}
        {!isLoading && patterns.length === 0 && !error && (
          <Card className="bg-slate-900/80 border-[#1e3a5f]">
            <CardContent className="py-16 text-center">
              <Lightbulb className="w-16 h-16 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400 text-lg mb-2">아직 추출된 공통점이 없습니다</p>
              <p className="text-slate-500 text-sm mb-6">위의 &quot;공통점 새로 추출하기&quot; 버튼을 클릭하세요</p>
            </CardContent>
          </Card>
        )}

        {/* 데이터 있을 때 */}
        {!isLoading && patterns.length > 0 && (
          <>
            {/* 카테고리 탭 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {/* 일반 공통점 탭 */}
              <button
                onClick={() => setActiveTab("general")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  activeTab === "general"
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                }`}
              >
                <Star className="w-4 h-4" />
                일반 공통점 ({stats?.general || 0})
              </button>

              {/* 회사별 탭 */}
              {stats?.companies.map(company => {
                const count = patterns.filter(p => p.category === company).length
                return (
                  <button
                    key={company}
                    onClick={() => setActiveTab(company)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                      activeTab === company
                        ? "bg-[#5B8DEF]/20 text-[#5B8DEF] border border-[#5B8DEF]/30"
                        : "bg-slate-800 text-slate-400 border border-slate-700 hover:border-slate-600"
                    }`}
                  >
                    <Building2 className="w-4 h-4" />
                    {company} ({count})
                  </button>
                )
              })}
            </div>

            {/* 패턴 카드 목록 */}
            <div className="space-y-3">
              {filteredPatterns.map((pattern) => (
                <Card
                  key={pattern.id}
                  className={`bg-slate-900/80 border-[#1e3a5f] hover:border-[#5B8DEF]/30 transition-colors`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start gap-4">
                      {/* 번호 */}
                      <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0 border border-slate-700">
                        <span className="text-[#5B8DEF] font-bold text-sm">{pattern.pattern_number}</span>
                      </div>

                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-white font-medium text-sm">{pattern.title}</h3>
                          <span className={`px-2 py-0.5 text-xs rounded-full border ${importanceBadge(pattern.importance)}`}>
                            {importanceLabel(pattern.importance)}
                          </span>
                        </div>
                        <p className="text-slate-400 text-sm leading-relaxed">{pattern.description}</p>

                        {/* 예시 파일 */}
                        {pattern.example_files && pattern.example_files.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {pattern.example_files.map((file, idx) => (
                              <span key={idx} className="text-xs px-2 py-0.5 bg-slate-800 text-slate-500 rounded">
                                📄 {file}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 하단 통계 */}
            <div className="mt-8 text-center text-slate-500 text-sm">
              총 {stats?.total}개 패턴 | 일반 {stats?.general}개 | 회사별 {stats?.company}개 ({stats?.companies.join(", ")})
            </div>
          </>
        )}
      </div>
    </div>
  )
}
