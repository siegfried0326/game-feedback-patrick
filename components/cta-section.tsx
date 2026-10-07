/**
 * CTA(Call-to-Action) 섹션 — 랜딩 페이지 하단 (43줄)
 *
 * "지금 바로 시작하세요" + 분석 시작/카카오톡 문의 버튼.
 * 사용: app/(landing)/page.tsx
 */
import { ArrowRight, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function CTASection() {
  return (
    <section className="py-16 md:py-20 px-4 md:px-6 bg-gradient-to-r from-card via-secondary to-card border-t border-b border-primary/30">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-2xl md:text-4xl font-black text-foreground mb-4 text-balance">
          지금 바로 시작하세요
        </h2>
        <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-2xl mx-auto text-pretty">
          첫 1회는 무료입니다.<br className="hidden sm:block" />
          부담 없이 피드백 품질을 경험해 보세요.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto bg-primary text-white hover:bg-primary/90 px-8 h-12 text-base"
          >
            <Link href="/analyze">
              <ArrowRight className="mr-2 w-4 h-4" />
              분석하기
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto border-border text-foreground/80 hover:bg-secondary hover:text-foreground px-8 h-12 text-base bg-transparent"
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
