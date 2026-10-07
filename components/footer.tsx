/**
 * 사이트 푸터 (55줄)
 *
 * 로고, 서비스명, 이용약관/개인정보처리방침 링크, 카카오톡 문의 링크.
 * 사용: 랜딩 페이지 + 분석 페이지 레이아웃
 */
import Link from "next/link"
import { BrandLogo } from "@/components/brand-logo"

export function Footer() {
  return (
    <footer className="py-12 px-6 bg-background border-t border-border">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div className="flex flex-col gap-2">
            <BrandLogo />
            <p className="text-xs text-muted-foreground">by 문라이트 커리어랩 · Build What Players Experience.</p>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              이용약관
            </Link>
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              개인정보처리방침
            </Link>
            <Link
              href="/refund-policy"
              className="hover:text-foreground transition-colors"
            >
              환불정책
            </Link>
            <a
              href="http://pf.kakao.com/_bXgIX"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              문의하기
            </a>
          </div>
        </div>

        {/* 사업자 정보 */}
        <div className="mt-8 pt-8 border-t border-border text-sm text-muted-foreground space-y-1">
          <p>상호명: 문라이트커리어랩 | 대표자: 이준규 | 사업자등록번호: 773-09-03092</p>
          <p>사업장 주소: 경기도 수원시 영통구 센트럴타운로 107(이의동, 광교푸르지오 월드마크)</p>
          <p>연락처: 031-695-4230</p>
          <p className="mt-4">
            Copyright 2025. 문라이트커리어랩 All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
