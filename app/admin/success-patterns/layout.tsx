/**
 * 합격자 공통점 추출 라우트 설정
 *
 * maxDuration: Vercel 서버 함수 최대 실행 시간 (초)
 * - Pro 플랜 최대 300초 (5분)
 * - Claude API 호출이 오래 걸릴 수 있어서 최대치로 설정
 */

export const maxDuration = 300

export default function SuccessPatternsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
