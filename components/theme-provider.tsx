/**
 * 테마 프로바이더 — next-themes 래퍼 (11줄)
 *
 * 다크/라이트 모드 지원용. 현재는 다크 모드 고정.
 * 사용: app/layout.tsx 최상위
 */
'use client'

import * as React from 'react'
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from 'next-themes'

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
