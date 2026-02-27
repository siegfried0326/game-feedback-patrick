/**
 * 클라이언트 사이드 PDF 텍스트 추출
 * 대용량 PDF(30MB 초과)를 브라우저에서 직접 텍스트 추출하여
 * 서버 업로드 없이 AI 분석 가능하게 함
 */

export type PdfExtractResult = {
  text: string
  lastPage: number    // 마지막으로 추출한 페이지 번호
  totalPages: number  // PDF 전체 페이지 수
}

export async function extractTextFromPdf(
  file: File,
  onProgress?: (current: number, total: number) => void,
  options?: { maxPages?: number; startPage?: number }
): Promise<PdfExtractResult> {
  // pdfjs-dist 동적 임포트 (번들 크기 최적화)
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const startPage = options?.startPage ?? 1
  const pageLimit = options?.maxPages ?? 200
  const endPage = Math.min(pdf.numPages, startPage + pageLimit - 1)
  const totalExtractPages = endPage - startPage + 1

  let fullText = ""
  let lastPage = startPage

  for (let i = startPage; i <= endPage; i++) {
    onProgress?.(i - startPage + 1, totalExtractPages)
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join(" ")
    fullText += `\n--- 페이지 ${i}/${pdf.numPages} ---\n${pageText}`
    lastPage = i

    // 텍스트가 충분히 모이면 조기 종료 (대용량 파일 속도 개선)
    if (fullText.length > 80000) break
  }

  // Claude 컨텍스트 제한 (100,000자)
  if (fullText.length > 100000) {
    fullText = fullText.substring(0, 100000)
  }

  return {
    text: fullText.trim(),
    lastPage,
    totalPages: pdf.numPages,
  }
}
