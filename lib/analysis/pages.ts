/**
 * 쪽수 비례 추가 차감 (2026-10-07~)
 *
 * 분석 원가는 문서 길이에 비례한다. 40쪽까지는 티어 비용만, 그 뒤로 40쪽마다 1크레딧을 더한다.
 *   1~40쪽 +0 · 41~80쪽 +1 · 81~120쪽 +2 · … (분석 상한 300쪽 → 최대 +7)
 * 기준값은 docs/PRD_가격표_요금제.md가 원본. 서버(analyze.ts)와 UI가 이 파일만 참조한다.
 *
 * 쪽수 판정
 * - 서버: PDF는 원본 파일에서 직접 센다 (app/actions/analyze.ts countPdfPages) — 클라이언트 값은 믿지 않는다
 * - 그 외 형식·서버 판정 실패 시: 클라이언트 추출 텍스트의 "--- 페이지 i/N ---" 표지에서 N
 */

/** 기본 비용에 포함되는 쪽수이자 추가 1크레딧의 단위 */
export const PAGES_PER_CREDIT = 40
/** 분석이 읽는 최대 쪽수 (lib/pdf-extract.ts와 같음) — 추가 차감도 여기서 멈춘다 */
export const MAX_BILLED_PAGES = 300

/** 사용자 안내 문구 (가격표·분석 화면 공용) */
export const LARGE_DOC_NOTICE = `${PAGES_PER_CREDIT}쪽이 넘는 문서는 ${PAGES_PER_CREDIT}쪽마다 1크레딧이 추가로 차감됩니다 (41~80쪽 +1, 81~120쪽 +2 …).`

/** lib/pdf-extract.ts가 붙이는 "--- 페이지 i/N ---" 표지에서 전체 쪽수 N을 읽는다 */
export function countPagesFromText(text?: string | null): number | null {
  if (!text) return null
  const m = text.match(/--- 페이지 \d+\/(\d+) ---/)
  return m ? Number(m[1]) : null
}

export function extraCreditsForPages(pages: number | null | undefined): number {
  if (!pages || pages <= PAGES_PER_CREDIT) return 0
  return Math.ceil(Math.min(pages, MAX_BILLED_PAGES) / PAGES_PER_CREDIT) - 1
}
