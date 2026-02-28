/**
 * 클라이언트 사이드 PDF 압축
 *
 * 30~100MB PDF를 브라우저에서 압축하여 서버 업로드 가능한 크기로 줄임.
 * 각 페이지를 150dpi JPEG(65% 품질)로 렌더링하여 새 PDF 생성.
 * 예: 192MB → 10~20MB 수준.
 *
 * 사용 시점: analyze-dashboard.tsx에서 30MB~100MB 파일일 때 호출.
 * 이미지/레이아웃이 보존되어 풀 분석(가독성 10항목 + 레이아웃 개선 제안) 가능.
 *
 * 제한:
 * - 최대 200페이지
 * - 브라우저 메모리 한계로 매우 큰 파일에서 실패할 수 있음
 * - 3분 타임아웃 (analyze-dashboard.tsx에서 설정)
 * - 실패 시 텍스트 추출 모드(pdf-extract.ts)로 폴백
 *
 * 의존성: pdfjs-dist (PDF 읽기), jspdf (PDF 쓰기) — 둘 다 동적 임포트
 *
 * @param file - 원본 PDF 파일
 * @param onProgress - 페이지별 진행 콜백 (current, total)
 * @returns 압축된 PDF File 객체 (원본과 같은 파일명)
 */
export async function compressPdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<File> {
  // 동적 임포트 — 압축 기능 미사용 시 번들에 포함되지 않음
  const pdfjsLib = await import("pdfjs-dist")
  const { jsPDF } = await import("jspdf")

  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const maxPages = Math.min(pdf.numPages, 200)

  // 첫 페이지 크기/방향으로 jsPDF 문서 초기화
  const firstPage = await pdf.getPage(1)
  const firstViewport = firstPage.getViewport({ scale: 1 })

  const doc = new jsPDF({
    orientation: firstViewport.width > firstViewport.height ? "landscape" : "portrait",
    unit: "pt",
    format: [firstViewport.width, firstViewport.height],
  })

  for (let i = 1; i <= maxPages; i++) {
    onProgress?.(i, maxPages)

    const page = await pdf.getPage(i)
    const originalViewport = page.getViewport({ scale: 1 })

    // 150dpi 렌더링: PDF 기본 72dpi의 약 2배 → 텍스트 가독성 유지하면서 용량 절감
    const renderScale = 2
    const renderViewport = page.getViewport({ scale: renderScale })

    // 캔버스에 페이지 렌더링
    const canvas = document.createElement("canvas")
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height

    const ctx = canvas.getContext("2d")!
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise

    // JPEG 65% 품질로 변환 — 용량 대비 화질 균형점
    const imgData = canvas.toDataURL("image/jpeg", 0.65)

    // 2페이지부터 새 페이지 추가 (각 페이지의 원본 크기/방향 유지)
    if (i > 1) {
      doc.addPage(
        [originalViewport.width, originalViewport.height],
        originalViewport.width > originalViewport.height ? "landscape" : "portrait"
      )
    }

    // 페이지 전체 영역에 이미지 삽입
    doc.addImage(
      imgData,
      "JPEG",
      0,
      0,
      originalViewport.width,
      originalViewport.height
    )

    // 사용 완료된 캔버스 메모리 즉시 해제
    canvas.width = 0
    canvas.height = 0
  }

  // jsPDF 문서를 Blob으로 출력 → File 객체로 변환
  const pdfBlob = doc.output("blob")
  return new File([pdfBlob], file.name, { type: "application/pdf" })
}
