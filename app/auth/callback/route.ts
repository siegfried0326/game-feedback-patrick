import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { ensureSubscription } from "@/app/actions/auth"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const nextParam = searchParams.get("next") ?? "/"

  // OAuth 과정에서 next 파라미터가 사라질 수 있으므로 쿠키에서 백업값 확인
  const cookieHeader = request.headers.get("cookie") || ""
  const redirectCookieMatch = cookieHeader.match(/redirect_after_login=([^;]+)/)
  const cookieRedirect = redirectCookieMatch ? decodeURIComponent(redirectCookieMatch[1]) : "/"

  // next 파라미터 우선, 없으면 쿠키 값 사용
  const finalRedirect = nextParam !== "/" ? nextParam : cookieRedirect

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // 첫 로그인 시 free 구독 생성
      await ensureSubscription(data.user.id)

      // 리다이렉트 쿠키 삭제
      const response = NextResponse.redirect(`${origin}${finalRedirect}`)
      response.cookies.set("redirect_after_login", "", { maxAge: 0, path: "/" })
      return response
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
