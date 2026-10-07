// pdf.js 워커를 public/에 복사 — 브라우저 텍스트 추출(lib/pdf-extract.ts, lib/pdf-compress.ts)이 같은 출처에서 워커를 받게 한다.
// 사이트 CSP(script-src 'self')가 외부 CDN 워커를 막아 운영에서 추출이 전부 실패하던 문제 (2026-10-07).
// npm run build 직전(prebuild)에 실행되어 설치된 pdfjs-dist 버전과 항상 일치한다.
import { copyFileSync } from "node:fs"

copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdf.worker.min.mjs")
console.log("[copy-pdf-worker] public/pdf.worker.min.mjs 갱신")
