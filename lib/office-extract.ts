/**
 * 클라이언트 사이드 Office 문서 텍스트 추출
 *
 * PPTX, DOCX, XLSX 파일에서 텍스트를 추출합니다.
 * Office 문서는 ZIP 포맷이므로 JSZip으로 압축 해제 후 XML에서 텍스트 추출.
 *
 * Claude API는 PDF/이미지만 직접 지원하므로,
 * Office 파일은 반드시 텍스트 추출 후 텍스트 기반 분석으로 처리.
 *
 * @param file - 브라우저 File 객체 (PPTX, DOCX, XLSX)
 * @returns 추출된 텍스트
 */
import JSZip from "jszip"

// 지원하는 Office MIME 타입
const OFFICE_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",   // .docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",         // .xlsx
  "application/vnd.ms-powerpoint",  // .ppt (레거시)
  "application/vnd.ms-excel",       // .xls (레거시)
]

export function isOfficeFile(mimeType: string): boolean {
  return OFFICE_MIME_TYPES.includes(mimeType)
}

export async function extractTextFromOffice(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || ""
  const arrayBuffer = await file.arrayBuffer()

  try {
    const zip = await JSZip.loadAsync(arrayBuffer)

    if (ext === "pptx") {
      return await extractFromPptx(zip)
    } else if (ext === "docx") {
      return await extractFromDocx(zip)
    } else if (ext === "xlsx") {
      return await extractFromXlsx(zip)
    }

    // 확장자로 판단 불가 시 MIME 타입으로 시도
    if (file.type.includes("presentation")) return await extractFromPptx(zip)
    if (file.type.includes("wordprocessing")) return await extractFromDocx(zip)
    if (file.type.includes("spreadsheet")) return await extractFromXlsx(zip)

    return ""
  } catch (err) {
    console.error("Office 텍스트 추출 실패:", err)
    // ZIP 파싱 실패 = 레거시 포맷(.ppt, .xls) 또는 손상된 파일
    return ""
  }
}

/**
 * PPTX 텍스트 추출
 * ppt/slides/slide*.xml 파일에서 <a:t> 태그의 텍스트 추출
 */
async function extractFromPptx(zip: JSZip): Promise<string> {
  const slideFiles: string[] = []

  // 슬라이드 파일 찾기 (slide1.xml, slide2.xml, ...)
  zip.forEach((path) => {
    if (path.match(/^ppt\/slides\/slide\d+\.xml$/)) {
      slideFiles.push(path)
    }
  })

  // 슬라이드 번호순 정렬
  slideFiles.sort((a, b) => {
    const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0")
    const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0")
    return numA - numB
  })

  let fullText = ""
  const maxSlides = Math.min(slideFiles.length, 200)

  for (let i = 0; i < maxSlides; i++) {
    const xmlContent = await zip.file(slideFiles[i])?.async("string")
    if (!xmlContent) continue

    const slideText = extractTextFromXml(xmlContent)
    if (slideText) {
      fullText += `\n--- 슬라이드 ${i + 1}/${slideFiles.length} ---\n${slideText}`
    }

    if (fullText.length > 80000) break
  }

  return fullText.trim().substring(0, 100000)
}

/**
 * DOCX 텍스트 추출
 * word/document.xml 파일에서 <w:t> 태그의 텍스트 추출
 */
async function extractFromDocx(zip: JSZip): Promise<string> {
  const docXml = await zip.file("word/document.xml")?.async("string")
  if (!docXml) return ""

  // <w:t> 태그에서 텍스트 추출
  const texts: string[] = []
  const regex = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g
  let match
  while ((match = regex.exec(docXml)) !== null) {
    texts.push(match[1])
  }

  // <w:p> 기준으로 줄바꿈 (문단 구분)
  let result = docXml
  // 문단 끝(<w:p> 종료)에 줄바꿈 삽입
  result = result.replace(/<\/w:p>/g, "\n")
  // 모든 XML 태그 제거
  result = result.replace(/<[^>]+>/g, "")
  // 연속 공백 정리
  result = result.replace(/\s+/g, " ").replace(/\n\s+/g, "\n")

  return result.trim().substring(0, 100000)
}

/**
 * XLSX 텍스트 추출
 * xl/sharedStrings.xml + xl/worksheets/sheet*.xml에서 텍스트 추출
 */
async function extractFromXlsx(zip: JSZip): Promise<string> {
  // 공유 문자열 테이블 파싱
  const sharedStrings: string[] = []
  const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string")
  if (ssXml) {
    const regex = /<t[^>]*>([\s\S]*?)<\/t>/g
    let match
    while ((match = regex.exec(ssXml)) !== null) {
      sharedStrings.push(match[1])
    }
  }

  // 시트 파일 찾기
  const sheetFiles: string[] = []
  zip.forEach((path) => {
    if (path.match(/^xl\/worksheets\/sheet\d+\.xml$/)) {
      sheetFiles.push(path)
    }
  })
  sheetFiles.sort()

  let fullText = ""
  for (const sheetFile of sheetFiles.slice(0, 20)) {
    const sheetXml = await zip.file(sheetFile)?.async("string")
    if (!sheetXml) continue

    const sheetName = sheetFile.match(/sheet(\d+)/)?.[1] || "?"
    fullText += `\n--- 시트 ${sheetName} ---\n`

    // 셀 값 추출
    const cellRegex = /<c[^>]*(?:t="s"[^>]*)?>[\s\S]*?<v>([\s\S]*?)<\/v>[\s\S]*?<\/c>/g
    const typeRegex = /t="s"/
    let cellMatch
    while ((cellMatch = cellRegex.exec(sheetXml)) !== null) {
      const cellTag = cellMatch[0]
      const value = cellMatch[1]
      if (typeRegex.test(cellTag)) {
        // 공유 문자열 참조
        const idx = parseInt(value)
        if (sharedStrings[idx]) fullText += sharedStrings[idx] + " "
      } else {
        fullText += value + " "
      }
    }

    if (fullText.length > 80000) break
  }

  return fullText.trim().substring(0, 100000)
}

/**
 * XML에서 텍스트 추출 (PPTX용)
 * <a:t> 태그의 텍스트를 추출
 */
function extractTextFromXml(xml: string): string {
  const texts: string[] = []
  // <a:t> 태그 매칭 (PowerPoint 텍스트)
  const regex = /<a:t>([\s\S]*?)<\/a:t>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    texts.push(match[1])
  }
  // <a:p> 기준으로 줄바꿈
  return texts.join(" ").replace(/\s+/g, " ").trim()
}
