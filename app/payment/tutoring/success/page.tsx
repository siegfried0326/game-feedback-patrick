"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { confirmTutoringPayment } from "@/app/actions/tutoring"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function TutoringSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const paymentKey = searchParams.get("paymentKey")
    const orderId = searchParams.get("orderId")
    const amount = searchParams.get("amount")

    if (!paymentKey || !orderId || !amount) {
      setStatus("error")
      setErrorMessage("결제 정보가 올바르지 않습니다.")
      return
    }

    async function confirm() {
      const result = await confirmTutoringPayment(paymentKey!, orderId!, Number(amount))

      if (result.error) {
        setStatus("error")
        setErrorMessage(result.error)
      } else {
        setStatus("success")
        setTimeout(() => {
          router.push("/mypage")
        }, 3000)
      }
    }

    confirm()
  }, [searchParams, router])

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        {status === "processing" && (
          <>
            <Loader2 className="w-16 h-16 text-[#5B8DEF] animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">결제 확인 중...</h1>
            <p className="text-slate-400">잠시만 기다려주세요.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">결제가 완료되었습니다!</h1>
            <p className="text-slate-400 mb-6">
              과외 일정은 카카오톡 상담을 통해 안내드리겠습니다.
              <br />
              잠시 후 마이페이지로 이동합니다.
            </p>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/mypage">마이페이지로 이동</Link>
            </Button>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">결제 확인에 실패했습니다</h1>
            <p className="text-slate-400 mb-2">{errorMessage}</p>
            <p className="text-sm text-slate-500 mb-6">문제가 지속되면 고객센터에 문의해주세요.</p>
            <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
              <Link href="/tutoring">다시 시도</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  )
}

export default function TutoringSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <TutoringSuccessContent />
    </Suspense>
  )
}
