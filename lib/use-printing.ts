/**
 * 인쇄(PDF 저장) 중인지 — 접혀 있는 피드백을 인쇄할 때만 모두 펼치기 위해 쓴다
 *
 * 2026-10-13: beforeprint에서 상태만 바꾸면 React가 다시 그리기 전에 브라우저가 쪽 나눔을 끝내,
 * 펼쳐진 내용이 PDF에서 잘렸다. 그래서
 *   - 'PDF로 저장' 버튼은 printWithExpanded()로 먼저 펼쳐 그린 뒤 인쇄 창을 연다
 *   - Ctrl+P로 바로 인쇄할 때도 beforeprint 안에서 flushSync로 즉시 펼친다
 */
"use client"

import { useEffect, useSyncExternalStore } from "react"
import { flushSync } from "react-dom"

let printing = false
const listeners = new Set<() => void>()

function setPrinting(v: boolean) {
  if (printing === v) return
  printing = v
  flushSync(() => listeners.forEach(l => l()))
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

let windowHooked = false
function hookWindow() {
  if (windowHooked || typeof window === "undefined") return
  windowHooked = true
  window.addEventListener("beforeprint", () => setPrinting(true))
  window.addEventListener("afterprint", () => setPrinting(false))
}

export function usePrinting(): boolean {
  useEffect(hookWindow, [])
  return useSyncExternalStore(subscribe, () => printing, () => false)
}

/** 접힌 내용을 모두 펼쳐 그린 다음 인쇄 창을 연다 (PDF로 저장 버튼용) */
export function printWithExpanded(title?: string) {
  hookWindow()
  const prevTitle = document.title
  if (title) document.title = title
  const restore = () => {
    document.title = prevTitle
    window.removeEventListener("afterprint", restore)
  }
  window.addEventListener("afterprint", restore)
  setPrinting(true)
  // 펼친 내용이 화면에 그려지고(두 프레임) 차트 크기가 다시 잡힐 때까지 잠깐 기다린다
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => window.print(), 150)))
}
