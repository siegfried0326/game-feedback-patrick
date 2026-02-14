import Link from "next/link"
import { FileText } from "lucide-react"

export function Footer() {
  return (
    <footer className="py-12 px-6 bg-[#0a1628] border-t border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5B8DEF] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white">게임 기획 문서 피드백</span>
              <p className="text-xs text-slate-400">by PATRICK</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link 
              href="https://v0-cafe-naver-homepage.vercel.app/" 
              target="_blank"
              className="hover:text-white transition-colors"
            >
              PATRICK 강의
            </Link>
            <a 
              href="https://desk.channel.io/#/channels/227321/team_chats/groups/536162" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              문의하기
            </a>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-[#1e3a5f] text-center text-sm text-slate-500">
          <p>
            Copyright 2025. PATRICK All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
