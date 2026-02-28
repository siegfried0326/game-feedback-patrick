/**
 * 클라이언트 사이드 PDF 텍스트 추출
 *
 * 100MB 이상 대용량 PDF를 브라우저에서 직접 텍스트 추출하여
 * 서버 업로드 없이 AI 분석 가능하게 함.
 *
 * 사용 시점: analyze-dashboard.tsx에서 파일이 100MB 초과 시 호출.
 * 텍스트만 추출하므로 이미지/레이아웃 평가(가독성 10항목, 레이아웃 개선 제안)는 불가.
 *
 * 제한:
 * - 최대 200페이지까지 추출
 * - 80,000자 도달 시 조기 종료 (충분한 텍스트 확보)
 * - 100,000자 초과 시 잘라냄 (Claude 컨텍스트 제한)
 * - 타임아웃 없음 (192MB 파일 등 대용량 대응)
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
  // CDN에서 Web Worker 로드 (메인 스레드 블로킹 방지)
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  // 파일 전체를 메모리에 로드 — 100MB+ 파일의 경우 이 단계가 가장 느림
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const maxPages = Math.min(pdf.numPages, 200) // 최대 200페이지까지만 처리
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

    // 80,000자 넘으면 조기 종료 — Claude에 보낼 텍스트가 충분
    if (fullText.length > 80000) break
  }

  // Claude 컨텍스트 제한 대비 — 100,000자 하드 리밋
  if (fullText.length > 100000) {
    fullText = fullText.substring(0, 100000)
  }

  return fullText.trim()
}
