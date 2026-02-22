import * as XLSX from "xlsx"

export function parseExcelToText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const lines: string[] = []

  lines.push(`=== 데이터테이블 파일: ${fileName} ===\n`)

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { header: 1 })

    if (jsonData.length === 0) continue

    lines.push(`\n--- 시트: ${sheetName} ---`)

    // 첫 행을 헤더(어트리뷰트)로
    const headers = (jsonData[0] as any[]).map(h => String(h ?? ""))
    lines.push(`어트리뷰트: ${headers.join(" | ")}`)
    lines.push("")

    // 나머지 행을 인스턴스로
    for (let i = 1; i < jsonData.length; i++) {
      const row = (jsonData[i] as any[]).map(cell => String(cell ?? ""))
      if (row.every(c => c === "")) continue // 빈 행 건너뜀
      lines.push(row.join(" | "))
    }

    lines.push(`\n인스턴스 수: ${jsonData.length - 1}개`)
    lines.push(`어트리뷰트 수: ${headers.length}개`)
  }

  return lines.join("\n")
}

export function parseCsvToText(buffer: Buffer, fileName: string): string {
  const text = buffer.toString("utf-8")
  return `=== 데이터테이블 파일: ${fileName} ===\n\n${text}`
}

export function isSpreadsheetFile(mimeType: string, fileName: string): boolean {
  const ext = fileName.split(".").pop()?.toLowerCase()
  return (
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "text/csv" ||
    ext === "xlsx" || ext === "xls" || ext === "csv"
  )
}
