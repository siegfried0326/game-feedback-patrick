"use client"

import Link from "next/link"
import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PricingModal } from "@/components/pricing-modal"

export function AnalyzeHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a1628]/95 backdrop-blur-md border-b border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#5B8DEF] flex items-center justify-center">
            <FileText className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-white">문서 피드백</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-8">
          <Link href="/analyze" className="text-sm text-[#5B8DEF] font-medium transition-colors">
            분석하기
          </Link>
          <PricingModal />
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            홈으로
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link 
            href="https://v0-cafe-naver-homepage.vercel.app/" 
            target="_blank"
            className="text-sm text-slate-400 hover:text-white transition-colors hidden sm:block"
          >
            PATRICK 강의
          </Link>
          <Button asChild className="bg-[#5B8DEF] hover:bg-[#4A7CE0] text-white">
            <a href="https://desk.channel.io/#/channels/227321/team_chats/groups/536162" target="_blank" rel="noopener noreferrer">
              상담하기
            </a>
          </Button>
        </div>
      </div>
    </header>
  )
}
