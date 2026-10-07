/**
 * 공통 앱 헤더(크레딧 칩 포함) + 본문. 헤더가 fixed라 본문을 16만큼 내린다.
 */
import { AuthAnalyzeHeader } from "@/components/auth-analyze-header"

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthAnalyzeHeader />
      <div className="pt-16">{children}</div>
    </>
  )
}
