/**
 * 수강생/관리자 프리미엄 접근 판별 (서버 전용)
 *
 * BM 개편(2026-08-05): 면접 연습·게임 디자인 라이브러리는
 * 관리자 + 과외 수강생(is_student)에게만 공개한다.
 *
 * 사용: app/library/layout.tsx, app/interview/page.tsx, api/library/*, api/interview/*
 */
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

/** 현재 로그인 사용자가 관리자 또는 수강생인지 */
export async function hasPremiumAccess(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  if (isAdminEmail(user.email)) return true

  const { data } = await supabase
    .from("users_subscription")
    .select("is_student")
    .eq("user_id", user.id)
    .maybeSingle()

  return data?.is_student === true
}
