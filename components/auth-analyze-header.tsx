/**
 * 분석 페이지 인증 헤더 — 서버 컴포넌트 래퍼 (16줄)
 *
 * 서버에서 Supabase 세션 조회 → 유저 정보를
 * AnalyzeHeader(클라이언트 컴포넌트)에 props로 전달.
 * 사용: 분석/마이페이지 레이아웃 (app/(analyze)/layout.tsx)
 */
import { createClient } from "@/lib/supabase/server"
import { AnalyzeHeader } from "./analyze-header"

export async function AuthAnalyzeHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
      }
    : null

  return <AnalyzeHeader user={userData} />
}
