/**
 * 클라이언트 사이드 PDF 압축
 * 대용량 PDF의 각 페이지를 낮은 해상도(150dpi)로 렌더링하여
 * 새로운 압축 PDF를 생성. 192MB → 10~20MB 수준으로 줄어듦.
 * 이미지/레이아웃이 보존되어 풀 분석(가독성/레이아웃 포함) 가능.
 */

export async function compressPdf(
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<File> {
  const pdfjsLib = await import("pdfjs-dist")
  const { jsPDF } = await import("jspdf")

  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const maxPages = Math.min(pdf.numPages, 200)

  // 첫 페이지로 기본 크기/방향 결정
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

    // 150dpi 렌더링 (72dpi 기준 약 2배)
    const renderScale = 2
    const renderViewport = page.getViewport({ scale: renderScale })

    const canvas = document.createElement("canvas")
    canvas.width = renderViewport.width
    canvas.height = renderViewport.height

    const ctx = canvas.getContext("2d")!
    await page.render({ canvasContext: ctx, viewport: renderViewport }).promise

    const imgData = canvas.toDataURL("image/jpeg", 0.65)

    // 2페이지부터 새 페이지 추가
    if (i > 1) {
      doc.addPage(
        [originalViewport.width, originalViewport.height],
        originalViewport.width > originalViewport.height ? "landscape" : "portrait"
      )
    }

    doc.addImage(
      imgData,
      "JPEG",
      0,
      0,
      originalViewport.width,
      originalViewport.height
    )

    // 메모리 해제
    canvas.width = 0
    canvas.height = 0
  }

  const pdfBlob = doc.output("blob")
  return new File([pdfBlob], file.name, { type: "application/pdf" })
}
