import Link from "next/link"
import { FileText } from "lucide-react"

export function Footer() {
  return (
    <footer className="py-12 px-6 bg-[#0a1628] border-t border-[#1e3a5f]">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#5B8DEF] flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-semibold text-white">DesignIt</span>
              <p className="text-xs text-slate-400">by 문라이트커리어랩</p>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-slate-400">
            <Link
              href="/terms"
              className="hover:text-white transition-colors"
            >
              이용약관
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-white transition-colors"
            >
              환불정책
            </Link>
            <a
              href="http://pf.kakao.com/_bXgIX"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              문의하기
            </a>
          </div>
        </div>

        {/* 사업자 정보 */}
        <div className="mt-8 pt-8 border-t border-[#1e3a5f] text-sm text-slate-500 space-y-1">
          <p>상호명: 문라이트커리어랩 | 대표자: 이준규 | 사업자등록번호: 773-09-03092</p>
          <p>사업장 주소: 경기도 수원시 영통구 센트럴타운로 107, 202동 10층 1008호(이의동, 광교푸르지오 월드마크)</p>
          <p>연락처: 031-695-4230</p>
          <p className="mt-4">
            Copyright 2025. 문라이트커리어랩 All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
