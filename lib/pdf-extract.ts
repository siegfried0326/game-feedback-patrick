/**
 * 클라이언트 사이드 PDF 텍스트 추출
 * 대용량 PDF(30MB 초과)를 브라우저에서 직접 텍스트 추출하여
 * 서버 업로드 없이 AI 분석 가능하게 함
 */

export async function extractTextFromPdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<string> {
  // pdfjs-dist 동적 임포트 (번들 크기 최적화)
  const pdfjsLib = await import("pdfjs-dist")
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const maxPages = Math.min(pdf.numPages, 200) // 최대 200페이지
  let fullText = ""

  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(i, maxPages)
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .filter((item): item is { str: string } => "str" in item)
      .map((item) => item.str)
      .join(" ")
    fullText += `\n--- 페이지 ${i}/${pdf.numPages} ---\n${pageText}`
  }

  // Claude 컨텍스트 제한 (100,000자)
  if (fullText.length > 100000) {
    fullText = fullText.substring(0, 100000)
  }

  return fullText.trim()
}
