/**
 * 로그인 페이지 (210줄)
 *
 * Google OAuth 로그인 버튼 + 서비스 소개 문구.
 * 로그인 성공 시 redirectTo 파라미터로 원래 페이지로 복귀.
 * 라우트: /login
 */
"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { FileText, Mail, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

// 보안: 오픈 리다이렉트 방지 — 내부 경로만 허용
function sanitizeRedirect(url: string): string {
  if (!url || !url.startsWith("/") || url.startsWith("//")) return "/"
  return url
}

function LoginContent() {
  const searchParams = useSearchParams()
  const redirectTo = sanitizeRedirect(searchParams.get("redirect") || "/")
  const error = searchParams.get("error")

  // 이메일 로그인 상태
  const [showEmailLogin, setShowEmailLogin] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSocialLogin = async (provider: "google" | "kakao" | "apple") => {
    const supabase = createClient()

    // OAuth 과정에서 next 파라미터가 사라질 수 있으므로 쿠키에 백업
    if (redirectTo && redirectTo !== "/") {
      document.cookie = `redirect_after_login=${encodeURIComponent(redirectTo)}; path=/; max-age=600; samesite=lax`
    }

    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    })
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailError("")
    setIsLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setEmailError("이메일 또는 비밀번호가 올바르지 않습니다.")
      } else {
        window.location.href = redirectTo
      }
    } catch {
      setEmailError("로그인 중 오류가 발생했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        {/* 로고 */}
        <Link href="/" className="flex items-center justify-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-[#5B8DEF] flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-lg font-bold text-white">DesignIt</span>
            <p className="text-xs text-slate-400">by 문라이트커리어랩</p>
          </div>
        </Link>

        {/* 카드 */}
        <div className="bg-slate-900/80 rounded-2xl border border-[#1e3a5f] p-8">
          <h1 className="text-xl font-bold text-white text-center mb-2">
            로그인
          </h1>
          <p className="text-sm text-slate-400 text-center mb-8">
            소셜 계정으로 간편하게 시작하세요
          </p>

          {error && (
            <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              로그인에 실패했습니다. 다시 시도해주세요.
            </div>
          )}

          <div className="space-y-3">
            {/* 구글 로그인 */}
            <button
              onClick={() => handleSocialLogin("google")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 active:scale-95 active:bg-gray-200 text-gray-800 font-medium transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google로 계속하기
            </button>

            {/* 카카오 로그인 */}
            <button
              onClick={() => handleSocialLogin("kakao")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] active:scale-95 active:bg-[#F5D000] text-[#191919] font-medium transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.63 1.76 4.95 4.41 6.26-.19.71-.7 2.58-.8 2.98-.13.49.18.48.37.35.16-.1 2.46-1.67 3.44-2.35.84.12 1.71.18 2.58.18 5.52 0 10-3.36 10-7.42C22 6.36 17.52 3 12 3z" />
              </svg>
              카카오로 계속하기
            </button>

            {/* Apple 로그인 */}
            <button
              onClick={() => handleSocialLogin("apple")}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-black hover:bg-gray-900 active:scale-95 active:bg-gray-800 text-white font-medium transition-all border border-gray-700"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.64-2.2.52-3.06-.4C3.79 16.17 4.36 9.53 8.82 9.28c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.3 4.11zM12.03 9.2C11.88 7.15 13.5 5.45 15.4 5.3c.27 2.32-2.1 4.06-3.37 3.9z" />
              </svg>
              Apple로 계속하기
            </button>

            {/* 구분선 */}
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-[#1e3a5f]" />
              <span className="text-xs text-slate-500">또는</span>
              <div className="flex-1 h-px bg-[#1e3a5f]" />
            </div>

            {/* 이메일 로그인 토글 */}
            {!showEmailLogin ? (
              <button
                onClick={() => setShowEmailLogin(true)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 active:bg-slate-600 text-slate-300 font-medium transition-all border border-[#1e3a5f]"
              >
                <Mail className="w-5 h-5" />
                이메일로 로그인
              </button>
            ) : (
              <form onSubmit={handleEmailLogin} className="space-y-3">
                <input
                  type="email"
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-[#1e3a5f] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#5B8DEF]"
                />
                <input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-[#1e3a5f] text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[#5B8DEF]"
                />
                {emailError && (
                  <p className="text-red-400 text-xs text-center">{emailError}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white font-medium transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Mail className="w-4 h-4" />
                  )}
                  로그인
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          로그인 시{" "}
          <Link href="/terms" className="text-[#5B8DEF] hover:underline">
            이용약관
          </Link>
          {" "}및{" "}
          <Link href="/refund-policy" className="text-[#5B8DEF] hover:underline">
            환불정책
          </Link>
          에 동의하게 됩니다.
        </p>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <div className="text-slate-400">로딩 중...</div>
      </main>
    }>
      <LoginContent />
    </Suspense>
  )
}
