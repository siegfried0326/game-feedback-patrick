/**
 * 헤더용 크레딧 조회 (서버 전용) — AuthHeader / AuthAnalyzeHeader가 함께 쓴다
 */
import type { SupabaseClient } from "@supabase/supabase-js"
import { isAdminEmail } from "@/lib/admin"

export async function getHeaderCredits(
  supabase: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<{ credits: number | null; unlimited: boolean; isStudent: boolean }> {
  if (isAdminEmail(user.email ?? undefined)) return { credits: null, unlimited: true, isStudent: false }
  const { data } = await supabase
    .from("users_subscription")
    .select("analysis_credits, is_student, plan, status, expires_at")
    .eq("user_id", user.id)
    .maybeSingle()
  // 판매 종료 전 무제한 구독이 아직 유효한 경우
  const activeSub = !!data && data.plan !== "free" && data.status === "active" && (!data.expires_at || new Date(data.expires_at) > new Date())
  return {
    credits: typeof data?.analysis_credits === "number" ? data.analysis_credits : 0,
    unlimited: activeSub && (data?.analysis_credits ?? 0) === 0,
    isStudent: data?.is_student === true,
  }
}
