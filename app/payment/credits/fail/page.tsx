/**
 * 크레딧 결제 실패 페이지
 *
 * TossPayments 결제 실패/취소 시 리다이렉트.
 * 에러 코드/메시지 표시 + 다시 시도/가격표 버튼.
 * 라우트: /payment/credits/fail?code=...&message=...
 */
"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { XCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function CreditFailContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get("code") || "UNKNOWN_ERROR"
  const message = searchParams.get("message") || "결제 과정에서 오류가 발생했습니다."

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">결제에 실패했습니다</h1>
        <p className="text-slate-400 mb-2">{decodeURIComponent(message)}</p>
        <p className="text-xs text-slate-600 mb-6">오류 코드: {code}</p>
        <div className="flex gap-3 justify-center">
          <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
            <Link href="/pricing">요금제 보기</Link>
          </Button>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <Link href="/payment/credits">다시 시도</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}

export default function CreditFailPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <CreditFailContent />
    </Suspense>
  )
}
