/**
 * 클라이언트 사이드 PDF 텍스트 추출
 *
 * 100MB 이상 대용량 PDF를 브라우저에서 직접 텍스트 추출하여
 * 서버 업로드 없이 AI 분석 가능하게 함.
 *
 * 사용 시점: analyze-dashboard.tsx에서 파일이 100MB 초과 시 호출.
 * 텍스트만 추출하므로 이미지/레이아웃 평가(가독성 10항목, 레이아웃 개선 제안)는 불가.
 *
 * 제한 (2026-10 상향 — 1M 컨텍스트 모델 기준):
 * - 최대 300페이지까지 추출
 * - 300,000자 도달 시 조기 종료
 * - 400,000자 초과 시 잘라냄 (서버 TEXT_MODE_MAX_CHARS와 동일)
 * - 타임아웃 없음 (192MB 파일 등 대용량 대응)
 *
 * 원본 PDF는 이제 서버가 Files API로 모델에 그대로 전달하므로, 이 텍스트는
 * 벡터 검색·직군 스캔용이거나 원본 전송이 실패했을 때의 폴백으로 쓰인다.
 *
 * @param file - 브라우저 File 객체 (PDF)
 * @param onProgress - 페이지 처리 진행 콜백 (current, total)
 * @returns 추출된 텍스트 (페이지 구분자 포함)
 */
export async function extractTextFromPdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  // pdfjs-dist 동적 임포트 — 번들 크기 최적화를 위해 사용 시점에 로드
  const pdfjsLib = await import("pdfjs-dist")
  // 같은 출처에서 워커 로드 — CSP가 외부 CDN 스크립트를 막는다 (scripts/copy-pdf-worker.mjs가 빌드 전 복사)
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"

  // 파일 전체를 메모리에 로드 — 100MB+ 파일의 경우 이 단계가 가장 느림
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const maxPages = Math.min(pdf.numPages, 300) // 최대 300페이지까지만 처리
  let fullText = ""

  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(i, maxPages) // UI에 "텍스트 추출 중... (3/50 페이지)" 표시용
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    // TextItem에서 문자열만 추출하여 공백으로 연결
    const pageText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join(" ")
    fullText += `\n--- 페이지 ${i}/${pdf.numPages} ---\n${pageText}`

    // 300,000자 넘으면 조기 종료 — 텍스트 폴백에도 충분한 분량
    if (fullText.length > 300000) break
  }

  // 서버 텍스트 모드 상한과 동일 — 400,000자 하드 리밋
  if (fullText.length > 400000) {
    fullText = fullText.substring(0, 400000)
  }

  return fullText.trim()
}
