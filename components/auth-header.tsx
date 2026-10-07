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
import { getHeaderCredits } from "@/lib/credits"

export async function AuthHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 크레딧(헤더 칩) + 수강생 여부(라이브러리 등 프리미엄 메뉴 노출 판단용)
  const credit = user ? await getHeaderCredits(supabase, user) : null

  const userData = user
    ? {
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name,
        isAdmin: isAdminEmail(user.email),
        isStudent: credit?.isStudent ?? false,
        credits: credit?.credits ?? null,
        unlimitedCredits: credit?.unlimited ?? false,
      }
    : null

  return <Header user={userData} />
}
