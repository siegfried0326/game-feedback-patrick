import { AnalyzeDashboard } from "@/components/analyze-dashboard"
import { AuthAnalyzeHeader } from "@/components/auth-analyze-header"

// 큰 파일 분석을 위한 타임아웃 설정 (5분)
export const maxDuration = 300

export const metadata = {
  title: "문서 분석하기 | 게임 기획 문서 피드백",
  description: "게임 기획 문서를 업로드하고 AI 분석 결과를 확인하세요.",
}

export default function AnalyzePage() {
  return (
    <main className="min-h-screen bg-background">
      <AuthAnalyzeHeader />
      <AnalyzeDashboard />
    </main>
  )
}
