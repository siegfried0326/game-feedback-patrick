import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-16 md:py-20 px-4 md:px-6 bg-gradient-to-r from-[#0d1f3c] via-[#162a4a] to-[#0d1f3c] border-t border-b border-[#5B8DEF]/30">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 text-balance">
          지금 바로 시작하세요
        </h2>
        <p className="text-slate-400 text-base md:text-lg mb-8 max-w-2xl mx-auto text-pretty">
          첫 1회는 무료입니다.<br className="hidden sm:block" />
          부담 없이 피드백 품질을 경험해 보세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto bg-[#5B8DEF] text-white hover:bg-[#4A7CE0] px-8 h-12 text-base"
          >
            <Link href="/analyze">
              <ArrowRight className="mr-2 w-4 h-4" />
              무료로 분석 시작
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto border-[#1e3a5f] text-slate-300 hover:bg-[#162a4a] hover:text-white px-8 h-12 text-base bg-transparent"
          >
            <a href="http://pf.kakao.com/_bXgIX" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 w-4 h-4" />
              문의하기
            </a>
          </Button>
        </div>
      </div>
    </section>
  )
}
