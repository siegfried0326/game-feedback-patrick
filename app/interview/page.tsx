/**
 * 면접 연습 페이지 (/interview)
 *
 * 🔒 관리자 + 과외 수강생 전용 (BM 개편: 수강생 혜택)
 * 그 외 사용자에게는 과외 상담 안내를 보여준다.
 */
import { redirect } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { hasPremiumAccess } from "@/lib/student-access"
import { TUTORING_KAKAO_URL } from "@/lib/tutoring-config"
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

  // 관리자·수강생이 아니면 과외 상담 안내
  if (!(await hasPremiumAccess())) {
    return (
      <main className="min-h-screen bg-[#0d1b2a]">
        <AuthHeader />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center">
          <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-10">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto mb-6 text-3xl">
              🎓
            </div>
            <h1 className="text-2xl font-bold text-white mb-3">면접 연습은 과외 수강생 전용입니다</h1>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              600개 실전 질문과 AI 평가·꼬리 질문으로 구성된 면접 연습 모드는
              <br />
              1:1 과외 수강생에게 제공되는 혜택입니다.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={TUTORING_KAKAO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                1:1 과외 상담하기 (무료)
              </a>
              <Link
                href="/analyze"
                className="px-5 py-2.5 border border-[#1e3a5f] text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
              >
                문서 분석 시작하기
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const isAdmin = isAdminEmail(user.email)

  // 관리자·수강생: 실제 면접 UI 렌더
  return (
    <main className="min-h-screen bg-[#0d1b2a]">
      <AuthHeader />
      <div className="max-w-6xl mx-auto px-4 py-6">
        {isAdmin && (
          <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-center gap-2">
            <span className="text-amber-400 text-sm">🚧</span>
            <p className="text-xs text-amber-300">관리자 모드 · 수강생에게도 동일 화면이 제공됩니다.</p>
          </div>
        )}
        <GameInterviewHome />
      </div>
    </main>
  )
}
