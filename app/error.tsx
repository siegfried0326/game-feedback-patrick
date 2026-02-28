/**
 * 전역 에러 핸들러 — app/error.tsx
 *
 * 서버/클라이언트 컴포넌트에서 예상치 못한 에러 발생 시 표시.
 * 사용자에게 친절한 안내 + "다시 시도" 버튼 제공.
 * 내부 에러 메시지/스택트레이스는 노출하지 않음.
 */
"use client"

import { useEffect } from "react"
import Link from "next/link"
import { FileText, RefreshCw, Home } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // 서버 로그에만 기록 (사용자에게는 노출하지 않음)
    console.error("[App Error]", error.digest || error.message)
  }, [error])

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <FileText className="w-8 h-8 text-red-400" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          문제가 발생했습니다
        </h1>
        <p className="text-slate-400 mb-8 leading-relaxed">
          일시적인 오류가 발생했습니다.<br />
          잠시 후 다시 시도해 주세요.
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            다시 시도
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors border border-[#1e3a5f]"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
        </div>

        {error.digest && (
          <p className="text-xs text-slate-600 mt-6">
            오류 코드: {error.digest}
          </p>
        )}
      </div>
    </main>
  )
}
