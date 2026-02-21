"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Link from "next/link"
import { FileText } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

function LoginContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"
  const error = searchParams.get("error")

  const handleSocialLogin = async (provider: "google" | "kakao" | "naver") => {
    const supabase = createClient()

    const redirectUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    })
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
            <span className="text-lg font-bold text-white">게임 기획 문서 피드백</span>
            <p className="text-xs text-slate-400">by PATRICK</p>
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
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white hover:bg-gray-100 text-gray-800 font-medium transition-colors"
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
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#FEE500] hover:bg-[#FDD800] text-[#191919] font-medium transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
                <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.63 1.76 4.95 4.41 6.26-.19.71-.7 2.58-.8 2.98-.13.49.18.48.37.35.16-.1 2.46-1.67 3.44-2.35.84.12 1.71.18 2.58.18 5.52 0 10-3.36 10-7.42C22 6.36 17.52 3 12 3z" />
              </svg>
              카카오로 계속하기
            </button>

            {/* 네이버 로그인 */}
            <button
              onClick={() => handleSocialLogin("naver" as any)}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-[#03C75A] hover:bg-[#02B550] text-white font-medium transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                <path d="M16.27 3H7.73C5.12 3 3 5.12 3 7.73v8.54C3 18.88 5.12 21 7.73 21h8.54C18.88 21 21 18.88 21 16.27V7.73C21 5.12 18.88 3 16.27 3zm-2.1 12.1h-2.35l-2.4-3.44v3.44H7.07V8.9h2.35l2.4 3.44V8.9h2.35v6.2z" />
              </svg>
              네이버로 계속하기
            </button>
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
