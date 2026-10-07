/**
 * 404 페이지 — app/not-found.tsx
 *
 * 존재하지 않는 경로 접근 시 표시.
 */
import Link from "next/link"
import { FileText, Home, Search } from "lucide-react"

export default function NotFound() {
  return (
    <main className="min-h-screen bg-secondary flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-2xl bg-secondary border border-border flex items-center justify-center mx-auto mb-6">
          <Search className="w-8 h-8 text-muted-foreground" />
        </div>

        <h1 className="text-5xl font-black text-foreground mb-3">404</h1>
        <p className="text-lg text-foreground/80 mb-2">페이지를 찾을 수 없습니다</p>
        <p className="text-muted-foreground mb-8">
          요청하신 페이지가 존재하지 않거나 이동되었습니다.
        </p>

        <div className="flex gap-3 justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-white font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            홈으로
          </Link>
          <Link
            href="/analyze"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary hover:bg-muted text-foreground/80 font-medium transition-colors border border-border"
          >
            <FileText className="w-4 h-4" />
            분석하기
          </Link>
        </div>
      </div>
    </main>
  )
}
