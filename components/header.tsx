/**
 * 사이트 공통 헤더 (81줄)
 *
 * 로고 + 네비게이션 + 로그인/로그아웃 버튼.
 * 로그인 상태: 분석하기, 마이페이지, 관리자(어드민만) 링크 표시.
 * 미로그인: 구독 모달(PricingModal) + Google 로그인 버튼.
 * 사용: AuthHeader(서버 컴포넌트)에서 유저 정보 주입 후 렌더링.
 */
"use client"

import Link from "next/link"
import { LogOut, User, Shield, FolderOpen, Mic, Library } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandLogo } from "@/components/brand-logo"
import { PricingModal } from "@/components/pricing-modal"
import { signOut } from "@/app/actions/auth"

type HeaderProps = {
  user?: {
    email?: string
    name?: string
    isAdmin?: boolean
    isStudent?: boolean
  } | null
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" aria-label="문라이트 아카이브 홈">
          <BrandLogo />
        </Link>

        <nav className="hidden md:flex items-center gap-7">
          <Link href="/analyze" className="text-sm text-muted-foreground hover:text-primary transition-colors font-medium">
            분석하기
          </Link>
          {(user?.isAdmin || user?.isStudent) && (
            <Link
              href="/library"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors font-medium"
            >
              <Library className="w-3.5 h-3.5" />
              라이브러리
            </Link>
          )}
          <a href="#service" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            서비스 소개
          </a>
          <PricingModal />
          <a href="#faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            FAQ
          </a>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.isAdmin && (
                <>
                  <Link
                    href="/admin/training"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-600 hover:bg-amber-500/20 transition-colors"
                  >
                    <Shield className="w-3 h-3" />
                    관리자
                  </Link>
                  <Link
                    href="/interview"
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-600 hover:bg-purple-500/20 transition-colors"
                    title="면접 연습 (관리자 테스트)"
                  >
                    <Mic className="w-3 h-3" />
                    <span className="hidden sm:inline">면접연습</span>
                  </Link>
                </>
              )}
              <Link
                href="/projects"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">프로젝트</span>
              </Link>
              <Link
                href="/mypage"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {user.name || user.email?.split("@")[0] || "마이페이지"}
                </span>
              </Link>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground/80 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">로그아웃</span>
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
