/**
 * 관리자 페이지 내비게이션 바
 *
 * /admin 하위 페이지 간 이동을 위한 탭 네비게이션.
 * 현재 경로에 따라 활성 탭이 하이라이트됨.
 *
 * 사용: app/admin/layout.tsx에서 children 위에 배치
 */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Upload, Brain, Database, ArrowLeft } from "lucide-react"

// 관리자 페이지 목록 (탭으로 표시)
const adminTabs = [
  {
    label: "포트폴리오 업로드",
    href: "/admin",
    icon: Upload,
    // 정확히 /admin일 때만 활성화 (/admin/training 등은 제외)
    isActive: (pathname: string) => pathname === "/admin",
  },
  {
    label: "학습 데이터 관리",
    href: "/admin/training",
    icon: Brain,
    // /admin/training 또는 /admin/data일 때 활성화
    isActive: (pathname: string) =>
      pathname.startsWith("/admin/training") || pathname.startsWith("/admin/data"),
  },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <div className="bg-[#0a1628] border-b border-[#1e3a5f]">
      <div className="max-w-4xl mx-auto px-6">
        {/* 상단: 홈으로 돌아가기 + 제목 */}
        <div className="flex items-center justify-between py-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            사이트로 돌아가기
          </Link>
          <span className="text-xs text-amber-400/60 font-medium">관리자 모드</span>
        </div>

        {/* 탭 내비게이션 */}
        <div className="flex gap-1">
          {adminTabs.map((tab) => {
            const active = tab.isActive(pathname)
            const Icon = tab.icon
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors
                  ${
                    active
                      ? "bg-slate-800/80 text-[#5B8DEF] border-b-2 border-[#5B8DEF]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
