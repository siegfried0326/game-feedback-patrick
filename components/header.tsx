"use client"

import Link from "next/link"
import { FileText, LogOut, User, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PricingModal } from "@/components/pricing-modal"
import { signOut } from "@/app/actions/auth"

type HeaderProps = {
  user?: {
    email?: string
    name?: string
    isAdmin?: boolean
  } | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-md border-b border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#5B8DEF] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">DesignIt</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/analyze" className="text-sm text-slate-400 hover:text-[#5B8DEF] transition-colors font-medium">
            분석하기
          </Link>
          <a href="#service" className="text-sm text-slate-400 hover:text-white transition-colors">
            서비스 소개
          </a>
          <PricingModal />
          <a href="#faq" className="text-sm text-slate-400 hover:text-white transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.isAdmin && (
                <Link
                  href="/admin/training"
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
                >
                  <Shield className="w-3 h-3" />
                  관리자
                </Link>
              )}
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
