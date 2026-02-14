"use client"

import { useState, useEffect } from "react"
import { Database, Trash2, Eye, Loader2, RefreshCw, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { getPortfolioList, deletePortfolio, deleteMultiplePortfolios, getCompanyStats } from "@/app/actions/admin"

export default function DataManagementPage() {
  const [portfolios, setPortfolios] = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [companyStats, setCompanyStats] = useState<Record<string, number>>({})

  const loadData = async () => {
    setIsLoading(true)
    const result = await getPortfolioList()
    if (result.data) {
      setPortfolios(result.data)
    }
    
    // 회사별 통계도 함께 로드
    const statsResult = await getCompanyStats()
    if (statsResult.data) {
      setCompanyStats(statsResult.data)
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleDelete = async (id: string) => {
    if (!confirm("이 학습 데이터를 삭제하시겠습니까?")) return
    
    setIsDeleting(true)
    const result = await deletePortfolio(id)
    if (result.success) {
      await loadData()
    } else {
      alert("삭제 실패: " + result.error)
    }
    setIsDeleting(false)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    if (!confirm(`선택한 ${selectedIds.length}개 학습 데이터를 삭제하시겠습니까?\n\n⚠️ 삭제하면 Gemini AI도 이 데이터를 잊어버립니다.`)) return
    
    setIsDeleting(true)
    const result = await deleteMultiplePortfolios(selectedIds)
    if (result.success) {
      setSelectedIds([])
      await loadData()
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

  return (
    <div className="min-h-screen bg-[#0a1628] py-12 px-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
              <Database className="w-8 h-8 text-[#5B8DEF]" />
              학습 데이터 관리
            </h1>
            <p className="text-slate-400">
              AI가 학습한 합격 포트폴리오 데이터를 확인하고 관리하세요.
            </p>
          </div>
          <Button
            onClick={loadData}
            disabled={isLoading}
            variant="outline"
            className="border-[#1e3a5f] text-slate-300 hover:bg-slate-800"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            새로고침
          </Button>
        </div>

        {/* 회사별 학습 데이터 통계 */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#5B8DEF]" />
              회사별 학습 데이터 현황
            </CardTitle>
            <CardDescription className="text-slate-400">
              각 회사별로 학습된 포트폴리오 개수
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#5B8DEF]" />
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Object.entries(companyStats).map(([company, count]) => {
                  // 회사별 색상
                  const colors: Record<string, string> = {
                    "엔씨소프트": "from-green-500 to-emerald-600",
                    "넥슨": "from-blue-500 to-cyan-600",
                    "넷마블": "from-red-500 to-rose-600",
                    "네오위즈": "from-purple-500 to-violet-600",
                    "스마일게이트": "from-orange-500 to-amber-600",
                    "라이온하트": "from-pink-500 to-fuchsia-600",
                    "매드엔진": "from-indigo-500 to-blue-600",
                    "웹젠": "from-teal-500 to-cyan-600",
                    "일반게임회사": "from-slate-500 to-gray-600"
                  }

                  return (
                    <div
                      key={company}
                      className={`bg-gradient-to-br ${colors[company] || "from-slate-600 to-slate-700"} rounded-lg p-4 text-white shadow-lg transition-transform hover:scale-105 cursor-default`}
                    >
                      <div className="text-sm font-medium mb-1 opacity-90">
                        {company}
                      </div>
                      <div className="text-3xl font-bold">
                        {count}
                      </div>
                      <div className="text-xs opacity-75 mt-1">
                        개 학습됨
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

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
                  {portfolios.length > 0 ? Math.round(portfolios.reduce((sum, p) => sum + (p.overall_score || 0), 0) / portfolios.length) : 0}
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
              <CardTitle className="text-white">
                학습 데이터 목록
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
            {isLoading ? (
              <div className="text-center py-12">
                <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin mx-auto mb-4" />
                <p className="text-slate-400">데이터 로딩 중...</p>
              </div>
            ) : portfolios.length === 0 ? (
              <div className="text-center py-12">
                <Database className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-2">학습 데이터가 없습니다</p>
                <p className="text-slate-500 text-sm">
                  /admin/training 페이지에서 포트폴리오를 업로드하세요
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
                  {portfolios.map((portfolio) => (
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
      </div>
    </div>
  )
}
