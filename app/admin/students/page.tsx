/**
 * /admin/students — 수강생 크레딧 지급 페이지
 *
 * BM 개편(2026-08-05): 과외 수강생에게 매월 크레딧을 수동 지급한다.
 * 이메일 검색 → 지급(기본 20) → credit_grants 이력 기록.
 * 사전 조건: scripts/019_add_student_grants.sql 실행 (is_student, credit_grants)
 */
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { StudentsAdminClient } from "@/components/admin/students-client"

export const dynamic = "force-dynamic"

export default async function StudentsAdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) redirect("/")

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="space-y-1">
          <div className="text-xs text-amber-600">관리자</div>
          <h1 className="text-3xl font-black text-foreground">수강생 크레딧 지급</h1>
          <p className="text-sm text-muted-foreground">
            과외 수강생에게 매월 분석 크레딧을 지급합니다. 지급 시 자동으로 수강생으로 표시됩니다.
          </p>
          <div className="text-xs text-muted-foreground mt-2 p-3 rounded-lg border border-border bg-card">
            💡 매월 초에 수강생 목록(검색어 없이 조회)을 확인하고 일괄 지급하세요.
            수강 종료 시 &quot;수강생 해제&quot;를 눌러주세요. 이력은 하단에 기록됩니다.
          </div>
        </header>

        <StudentsAdminClient />
      </div>
    </div>
  )
}
