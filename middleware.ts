/**
 * Next.js 미들웨어 — 모든 요청에서 실행
 *
 * 역할:
 * 1. Supabase 세션 갱신 (토큰 만료 임박 시 자동 refresh)
 * 2. 라우트 보호:
 *    - /mypage: 로그인 필수 → 미인증 시 /login?redirect=/mypage
 *    - /admin/*: 관리자 전용 → 비관리자는 홈으로
 *    - /login: 이미 로그인 시 홈으로
 *
 * 쿠키 설정: 30일 세션, SameSite=lax (OAuth 리다이렉트 호환)
 *
 * 참고: ADMIN_EMAILS를 직접 파싱하고 있으나 lib/admin.ts에도 동일 로직 존재 (통합 필요)
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 관리자 이메일 — 환경변수에서 쉼표 구분 파싱
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // 세션 쿠키 수명 30일 유지 (자동 로그인)
              maxAge: 60 * 60 * 24 * 30,
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
            })
          )
        },
      },
    }
  )

  // 세션 갱신 (반드시 createServerClient 직후에 호출)
  const { data: { user } } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // 보호된 라우트: 로그인 필요
  const protectedPaths = ['/mypage']
  const adminPaths = ['/admin']
  const authPaths = ['/login']

  // 비로그인 유저 → 보호된 라우트 접근 시 로그인으로
  if (!user && protectedPaths.some(path => pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  // 관리자 라우트: 관리자 이메일만 접근 가능
  if (adminPaths.some(path => pathname.startsWith(path))) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('redirect', pathname)
      return NextResponse.redirect(url)
    }
    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  }

  // 로그인된 유저 → 로그인 페이지 접근 시 홈으로
  if (user && authPaths.some(path => pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
