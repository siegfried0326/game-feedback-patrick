/**
 * 인증 헤더 — 서버 컴포넌트 래퍼 (18줄)
 *
 * 서버에서 Supabase 세션 조회 → 유저 정보(이메일, 이름, 관리자 여부)를
 * Header(클라이언트 컴포넌트)에 props로 전달.
 * 사용: 랜딩 페이지 레이아웃 (app/(landing)/layout.tsx)
 */
/**
 * 인증 헤더 — 서버 컴포넌트 래퍼 (18줄)
 *
 * 서버에서 Supabase 세션 조회 → 유저 정보(이메일, 이름, 관리자 여부)를
 * Header(클라이언트 컴포넌트)에 props로 전달.
 * 사용: 랜딩 페이지 레이아웃 (app/(landing)/layout.tsx)
 */
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"
import { Header } from "./header"

export async function AuthHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const userData = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        isAdmin: isAdminEmail(user.email),
      }
    : null

  return <Header user={userData} />
}
