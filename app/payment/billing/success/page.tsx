"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { CheckCircle, Loader2, XCircle } from "lucide-react"
import { processSubscriptionPayment } from "@/app/actions/payment"
import { Button } from "@/components/ui/button"
import Link from "next/link"

function BillingSuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing")
  const [errorMessage, setErrorMessage] = useState("")

  useEffect(() => {
    const customerKey = searchParams.get("customerKey")
    const authKey = searchParams.get("authKey")
    const plan = searchParams.get("plan") as "monthly" | "three_month"
    const discountCode = searchParams.get("discountCode")

    if (!customerKey || !authKey || !plan) {
      setStatus("error")
      setErrorMessage("결제 정보가 올바르지 않습니다.")
      return
    }

    async function processBilling() {
      const result = await processSubscriptionPayment(authKey!, customerKey!, plan, discountCode || undefined)

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

    processBilling()
  }, [searchParams, router])

  return (
    <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
      <div className="max-w-md mx-auto px-6 text-center">
        {status === "processing" && (
          <>
            <Loader2 className="w-16 h-16 text-[#5B8DEF] animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">결제 처리 중...</h1>
            <p className="text-slate-400">잠시만 기다려주세요.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">구독이 시작되었습니다!</h1>
            <p className="text-slate-400 mb-6">
              {searchParams.get("plan") === "three_month"
                ? "이제 프리미엄 Claude Opus AI로 더 정밀한 분석을 받으실 수 있습니다."
                : "이제 무제한 분석과 버전 비교 기능을 이용하실 수 있습니다."
              }
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
            <h1 className="text-2xl font-bold text-white mb-2">결제에 실패했습니다</h1>
            <p className="text-slate-400 mb-2">{errorMessage}</p>
            <p className="text-sm text-slate-500 mb-6">문제가 지속되면 고객센터에 문의해주세요.</p>
            <div className="flex gap-3 justify-center">
              <Button asChild variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                <Link href="/pricing">요금제 보기</Link>
              </Button>
              <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
                <Link href="/payment/billing">다시 시도</Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

export default function BillingSuccessPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#5B8DEF] animate-spin" />
      </main>
    }>
      <BillingSuccessContent />
    </Suspense>
  )
}
