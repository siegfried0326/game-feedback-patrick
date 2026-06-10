/**
 * /admin/interview-questions — 면접 질문 큐레이션 페이지
 *   600문항 카테고리별 표시, 검색, 단건/일괄 삭제
 *   (Patrick이 이상한 질문 솎아낼 때 사용)
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { listInterviewQuestions } from "@/app/actions/interview-admin"
import { InterviewAdminClient } from "@/components/interview/admin-client"

export const dynamic = "force-dynamic"

export default async function InterviewQuestionsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect("/")

  const result = await listInterviewQuestions()

  return (
    <div className="min-h-screen bg-[#0a1628] text-slate-200 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-amber-400">관리자</div>
          <h1 className="text-3xl font-bold text-white">면접 질문 관리</h1>
          <p className="text-sm text-slate-400">
            interview_questions 테이블 — {result.total}문항. 이상한 질문은 행 끝의 삭제 버튼으로.
          </p>
          <div className="text-xs text-slate-500 mt-2 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
            ⚠️ 삭제는 즉시 DB에서 제거됨. 복원하려면 <code className="text-amber-300">scripts/017_seed_interview_questions.sql</code>을 다시 실행.
          </div>
        </header>

        {result.error ? (
          <div className="p-4 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
            {result.error}
          </div>
        ) : (
          <InterviewAdminClient byCategory={result.byCategory} />
        )}
      </div>
    </div>
  )
}
