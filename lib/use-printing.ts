/**
 * 인쇄(PDF 저장) 중인지 — 접혀 있는 피드백을 인쇄할 때만 모두 펼치기 위해 쓴다
 */
"use client"

import { useEffect, useState } from "react"

export function usePrinting(): boolean {
  const [printing, setPrinting] = useState(false)
  useEffect(() => {
    const on = () => setPrinting(true)
    const off = () => setPrinting(false)
    window.addEventListener("beforeprint", on)
    window.addEventListener("afterprint", off)
    return () => {
      window.removeEventListener("beforeprint", on)
      window.removeEventListener("afterprint", off)
    }
  }, [])
  return printing
}
