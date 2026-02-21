"use client"

import Link from "next/link"
import { FileText, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PricingModal } from "@/components/pricing-modal"
import { signOut } from "@/app/actions/auth"

type AnalyzeHeaderProps = {
  user?: {
    email?: string
    name?: string
  } | null
}

export function AnalyzeHeader({ user }: AnalyzeHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-md border-b border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#5B8DEF] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">문서 피드백</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/analyze" className="text-sm text-[#5B8DEF] font-medium transition-colors">
            분석하기
          </Link>
          <PricingModal />
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            홈으로
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/mypage"
                className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {user.name || user.email?.split("@")[0] || "마이페이지"}
                </span>
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
                </button>
              </form>
            </>
          ) : (
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
