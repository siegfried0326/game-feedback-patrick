/**
 * 면접 연습 페이지 (/interview)
 *
 * 🚧 현재: 관리자 전용 테스트 단계
 * 출시 준비 완료 후 일반 사용자에게 공개 예정.
 */
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { AuthHeader } from "@/components/auth-header"
import GameInterviewHome from "@/components/interview/game-interview-home"

// 타임아웃 연장 (AI 평가 시간 고려)
export const maxDuration = 60

export default async function InterviewPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 비로그인 → 로그인 페이지로
  if (!user) {
    redirect("/login?redirect=/interview")
  }

  // 관리자가 아니면 "준비 중" 안내
  if (!isAdminEmail(user.email)) {
    return (
      <main className="min-h-screen bg-[#0d1b2a]">
        <AuthHeader />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-10">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 text-3xl">
              🚧
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">면접 연습 기능 준비 중</h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              AI 기반 면접 연습 플랫폼을 준비하고 있습니다.
              <br />
              600개의 질문과 Gemini AI 평가 시스템으로 곧 찾아뵙겠습니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/analyze"
                className="px-5 py-2.5 bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white rounded-lg text-sm font-medium transition-colors"
              >
                문서 분석 시작하기
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 border border-[#1e3a5f] text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                홈으로
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  // 관리자: 실제 면접 UI 렌더
  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <AuthHeader />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
          <span className="text-amber-400 text-sm">🚧</span>
          <p className="text-xs text-amber-300">관리자 테스트 모드 · 출시 전 검증 단계입니다.</p>
        </div>
        <GameInterviewHome />
      </div>
    </main>
  )
}
