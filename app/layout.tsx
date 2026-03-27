/**
 * 루트 레이아웃 (53줄)
 *
 * Next.js 앱 최상위 레이아웃.
 * Geist 폰트, Vercel Analytics, ThemeProvider(다크모드), 메타데이터.
 */
import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
}

export const metadata: Metadata = {
  title: '아카이브 187(Archive187) | 게임 기획 포트폴리오 AI 피드백',
  description: '현업 기획자의 전문 피드백으로 포트폴리오의 완성도를 높이세요. 첫 1회 무료 체험, AI 즉시 분석.',
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
    <html lang="ko">
      <body className={`font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
