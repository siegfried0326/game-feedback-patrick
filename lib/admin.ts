/**
 * 관리자 이메일 판별 유틸리티
 *
 * ADMIN_EMAILS 환경변수(쉼표 구분)에 등록된 이메일인지 확인.
 *
 * 사용처:
 * - components/auth-header.tsx: 헤더에 관리자 뱃지 표시 여부
 *
 * 주의: middleware.ts와 app/actions/admin.ts에서도 동일한 파싱 로직이
 * 별도로 존재함 (통합 필요 — TODO_BACKLOG.md 참고)
 */
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase()).filter(Boolean)

export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
