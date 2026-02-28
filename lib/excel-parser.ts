/**
 * Excel/CSV 파일을 텍스트로 변환하는 파서
 *
 * 사용처:
 * 1. 관리자 학습 데이터 업로드 시 (admin.ts → analyzeAndSavePortfolio)
 *    - 엑셀 데이터테이블을 텍스트로 변환 후 Gemini AI에 전달
 * 2. 사용자 분석 시 (analyze.ts → analyzeDocumentDirect)
 *    - 엑셀 파일을 텍스트로 변환 후 Claude AI에 전달
 *
 * 게임 기획 맥락에서의 용어:
 * - 어트리뷰트(Attribute) = 엑셀 컬럼 헤더 (예: HP, 공격력, 쿨타임)
 * - 인스턴스(Instance) = 데이터 행 (예: 각 스킬, 아이템, 몬스터)
 *
 * 의존성: xlsx 패키지 (SheetJS)
 */
import * as XLSX from "xlsx"

/**
 * Excel 파일(xlsx/xls)을 텍스트로 변환
 * 각 시트를 순회하며 헤더(어트리뷰트)와 행(인스턴스)을 파이프(|) 구분 텍스트로 변환.
 *
 * @param buffer - 파일 바이너리 데이터
 * @param fileName - 원본 파일명 (출력 헤더에 포함)
 * @returns 텍스트 (시트별 구분, 어트리뷰트/인스턴스 수 포함)
 */
export function parseExcelToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const lines: string[] = []

  lines.push(`=== 데이터테이블 파일: ${fileName} ===\n`)

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    // header: 1 옵션으로 순수 배열 형태 반환 (키-값 맵이 아닌)
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 })

    if (jsonData.length === 0) continue

    lines.push(`\n--- 시트: ${sheetName} ---`)

    // 첫 행을 헤더(어트리뷰트)로 사용
    const headers = (jsonData[0] as any[]).map(h => String(h ?? ""))
    lines.push(`어트리뷰트: ${headers.join(" | ")}`)
    lines.push("")

    // 나머지 행을 인스턴스(데이터)로 변환
    for (let i = 1; i < jsonData.length; i++) {
      const row = (jsonData[i] as any[]).map(cell => String(cell ?? ""))
      if (row.every(c => c === "")) continue // 빈 행 건너뜀
      lines.push(row.join(" | "))
    }

    // AI가 데이터 규모를 파악할 수 있도록 통계 추가
    lines.push(`\n인스턴스 수: ${jsonData.length - 1}개`)
    lines.push(`어트리뷰트 수: ${headers.length}개`)
  }

  return lines.join("\n")
}

/**
 * CSV 파일을 텍스트로 변환 (UTF-8 디코딩만 수행)
 *
 * @param buffer - 파일 바이너리 데이터
 * @param fileName - 원본 파일명
 * @returns 텍스트 (파일명 헤더 + 원본 CSV 내용)
 */
export function parseCsvToText(buffer: Buffer, fileName: string): string {
  const text = buffer.toString("utf-8")
  return `=== 데이터테이블 파일: ${fileName} ===\n\n${text}`
}

/**
 * 파일이 엑셀/CSV인지 판별
 * MIME 타입 또는 확장자로 확인 (브라우저가 MIME을 잘못 설정할 수 있어 확장자도 체크)
 *
 * @param mimeType - 파일의 MIME 타입
 * @param fileName - 파일명 (확장자 추출용)
 * @returns 엑셀/CSV 파일이면 true
 */
export function isSpreadsheetFile(mimeType: string, fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase()
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || // xlsx
    mimeType === "application/vnd.ms-excel" || // xls
    mimeType === "text/csv" ||
    ext === "xlsx" || ext === "xls" || ext === "csv"
  )
}
