// pdf-parse 1.x는 타입 선언이 없다 — 쓰는 부분만 선언 (app/actions/analyze.ts 쪽수 판정, app/actions/admin.ts 텍스트 추출)
declare module "pdf-parse" {
  interface PdfParseResult {
    numpages: number
    numrender: number
    text: string
    info: unknown
    metadata: unknown
    version: string
  }
  interface PdfParseOptions {
    /** 파싱할 최대 쪽수 (0 = 전체). numpages는 이 값과 무관하게 전체 쪽수 */
    max?: number
  }
  function pdfParse(data: Buffer, options?: PdfParseOptions): Promise<PdfParseResult>
  export default pdfParse
}
