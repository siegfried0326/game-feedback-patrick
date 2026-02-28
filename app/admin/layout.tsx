/**
 * 관리자 레이아웃
 *
 * 모든 /admin 하위 페이지에 공통 적용:
 * - AdminNav: 관리자 페이지 간 탭 내비게이션
 * - maxDuration: 큰 파일 처리용 5분 타임아웃
 *
 * 접근: middleware에서 관리자 이메일 인증 확인 후 진입
 */
import { AdminNav } from "@/components/admin-nav"

// 큰 파일 처리를 위한 타임아웃 설정 (5분)
export const maxDuration = 300

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0a1628]">
      {/* 관리자 페이지 공통 내비게이션 */}
      <AdminNav />
      {/* 각 관리자 페이지 콘텐츠 */}
      {children}
    </div>
  )
}
