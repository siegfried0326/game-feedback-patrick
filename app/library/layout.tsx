/**
 * 라이브러리 섹션 공통 레이아웃
 *   - 사이트 헤더 + 좁은 라이브러리 서브 헤더
 *   - 페이지 컨테이너
 *
 * 🔒 접근제어: 라이브러리는 현재 관리자 전용. 비관리자는 홈으로 리다이렉트.
 *    (하위 모든 /library/* 라우트가 이 layout을 거치므로 한 곳에서 게이팅)
 */

import { redirect } from "next/navigation"
import Link from "next/link"
import { Library, Network, Search, Sparkles, Users, Layers } from "lucide-react"
import { AuthHeader } from "@/components/auth-header"
import { createClient } from "@/lib/supabase/server"
import { isAdminEmail } from "@/lib/admin"

export default async function LibraryLayout({ children }: { children: React.ReactNode }) {
  // 관리자 전용 게이팅 (준비 중 — 일반 공개 전까지)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isAdminEmail(user.email)) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-[#0a1628] text-slate-200">
      <AuthHeader />
      <div className="pt-16">
        <SubNav />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  )
}

function SubNav() {
  const items: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: "/library", label: "홈", icon: <Library className="w-3.5 h-3.5" /> },
    { href: "/library/topics", label: "주제별", icon: <Layers className="w-3.5 h-3.5" /> },
    { href: "/library/by-designer", label: "디자이너별", icon: <Users className="w-3.5 h-3.5" /> },
    { href: "/library/all", label: "전체 목록", icon: null },
    { href: "/library/principles", label: "원칙", icon: null },
    { href: "/library/designers", label: "인물", icon: null },
    { href: "/library/patterns", label: "패턴", icon: null },
    { href: "/library/antipatterns", label: "안티패턴", icon: null },
    { href: "/library/paths", label: "학습경로", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { href: "/library/lineage", label: "계보", icon: null },
    { href: "/library/genres", label: "장르", icon: null },
    { href: "/library/core", label: "핵심규칙", icon: null },
    { href: "/library/gdc", label: "GDC", icon: null },
    { href: "/library/sources", label: "출처", icon: null },
    { href: "/library/graph", label: "그래프", icon: <Network className="w-3.5 h-3.5" /> },
    { href: "/library/search", label: "검색", icon: <Search className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="sticky top-16 z-40 border-b border-[#1e3a5f] bg-[#0a1628]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-thin">
          {items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-[#5B8DEF] hover:bg-slate-900/50 px-3 py-1.5 rounded-full whitespace-nowrap transition-colors"
            >
              {it.icon}
              {it.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}
