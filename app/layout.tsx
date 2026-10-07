/**
 * 루트 레이아웃 (53줄)
 *
 * Next.js 앱 최상위 레이아웃.
 * 브랜드 폰트 SUIT(globals.css), Vercel Analytics, ThemeProvider(다크모드), 메타데이터.
 */
import React from "react"
import type { Metadata } from 'next'
import { Geist_Mono } from 'next/font/google'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geistMono = Geist_Mono({ subsets: ["latin"] });
// 브랜드 폰트 SUIT (SIL OFL, sun.fo/suit) — 한글·영문 공통. 제목 900 / 강조 700 / 본문 400·500 / 라벨 700
// CSP가 외부 스타일시트를 막으므로 자체 호스팅
const suit = localFont({
  src: [
    { path: './fonts/suit/SUIT-Regular.otf', weight: '400' },
    { path: './fonts/suit/SUIT-Medium.otf', weight: '500' },
    { path: './fonts/suit/SUIT-SemiBold.otf', weight: '600' },
    { path: './fonts/suit/SUIT-Bold.otf', weight: '700' },
    { path: './fonts/suit/SUIT-ExtraBold.otf', weight: '800' },
    { path: './fonts/suit/SUIT-Heavy.otf', weight: '900' },
  ],
  variable: '--font-suit',
  display: 'swap',
  preload: false,
})

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
}

export const metadata: Metadata = {
  title: '문라이트 아카이브 | 게임 기획 포트폴리오 AI 피드백',
  description: '187개의 합격 포트폴리오를 기준으로, 당신의 기획 문서가 실제로 통하는지 진단합니다. 문라이트 커리어랩.',
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={suit.variable}>
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
