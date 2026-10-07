/**
 * 분석 페이지 전용 헤더 (68줄)
 *
 * 분석/마이페이지에서 사용하는 헤더.
 * 랜딩 헤더(header.tsx)와 유사하나 관리자 링크 없음, 구독 모달 포함.
 * 사용: AuthAnalyzeHeader에서 유저 정보 주입 후 렌더링.
 */
"use client"

import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"
import { CreditChip } from "@/components/credit-chip"
import { LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PricingModal } from "@/components/pricing-modal"
import { signOut } from "@/app/actions/auth"

type AnalyzeHeaderProps = {
  user?: {
    email?: string
    name?: string
    credits?: number | null
    unlimitedCredits?: boolean
  } | null
}

export function AnalyzeHeader({ user }: AnalyzeHeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" aria-label="문라이트 아카이브 홈">
          <BrandLogo />
        </Link>

        <nav className="hidden lg:flex items-center gap-8">
          <Link href="/analyze" className="text-sm text-primary font-medium transition-colors">
            분석하기
          </Link>
          <PricingModal />
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            홈으로
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <CreditChip credits={user.credits ?? null} unlimited={user.unlimitedCredits} />
              <Link
                href="/projects"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                프로젝트
              </Link>
              <Link
                href="/mypage"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden md:inline max-w-[8rem] truncate whitespace-nowrap">
                  {user.name || user.email?.split("@")[0] || "마이페이지"}
                </span>
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline whitespace-nowrap">로그아웃</span>
                </button>
              </form>
            </>
          ) : (
            <Button asChild className="bg-primary hover:bg-primary/90 text-white">
              <Link href="/login">로그인</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
