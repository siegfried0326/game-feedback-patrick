/**
 * 분석 페이지 — AnalyzeDashboard 래퍼 (22줄)
 *
 * AuthAnalyzeHeader(인증 헤더) + AnalyzeDashboard(분석 대시보드) 조합.
 * 5분 타임아웃 설정 (대용량 파일 처리).
 * 라우트: /analyze (로그인 필수)
 */
import { Suspense } from "react"
import { AnalyzeDashboard } from "@/components/analyze-dashboard"
import { AuthAnalyzeHeader } from "@/components/auth-analyze-header"

// 큰 파일 분석을 위한 타임아웃 설정 (5분)
export const maxDuration = 300

export const metadata = {
  title: "문서 분석하기 | 디자이닛(DesignIt)",
  description: "게임 기획 문서를 업로드하고 AI 분석 결과를 확인하세요.",
}

export default function AnalyzePage() {
  return (
    <main className="min-h-screen bg-background">
      <AuthAnalyzeHeader />
      <Suspense>
        <AnalyzeDashboard />
      </Suspense>
    </main>
  )
}
