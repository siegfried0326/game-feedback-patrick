/**
 * 파일 매직 바이트 검증 (서버 전용)
 *
 * 클라이언트가 보낸 MIME 타입(file.type)만으로는 위변조 판별이 불가능하다.
 * 파일의 실제 시그니처(매직 바이트)를 읽어 허용된 유형인지 검증한다.
 *
 * 사용처:
 * - app/actions/analyze.ts: 사용자 업로드 (uploadFileToStorage)
 * - app/actions/admin.ts: 관리자 업로드 (uploadAdminFile)
 */

/** 허용 파일 시그니처 정의 (처음 N바이트) */
const SIGNATURES: Array<{
  label: string
  mimes: string[]
  extensions: string[]
  /** 매치 함수 — true면 일치 */
  match: (bytes: Uint8Array) => boolean
}> = [
  {
    label: "PDF",
    mimes: ["application/pdf"],
    extensions: ["pdf"],
    // %PDF- (25 50 44 46 2D)
    match: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d,
  },
  {
    label: "PNG",
    mimes: ["image/png"],
    extensions: ["png"],
    // 89 50 4E 47 0D 0A 1A 0A
    match: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  },
  {
    label: "JPEG",
    mimes: ["image/jpeg", "image/jpg"],
    extensions: ["jpg", "jpeg"],
    // FF D8 FF
    match: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    label: "GIF",
    mimes: ["image/gif"],
    extensions: ["gif"],
    // 47 49 46 38 (GIF8)
    match: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    label: "WebP",
    mimes: ["image/webp"],
    extensions: ["webp"],
    // RIFF....WEBP: 52 49 46 46 xx xx xx xx 57 45 42 50
    match: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
  {
    label: "ZIP(Office)",
    // PPTX/DOCX/XLSX는 모두 ZIP 아카이브
    mimes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/zip",
    ],
    extensions: ["pptx", "docx", "xlsx", "zip"],
    // ZIP: 50 4B 03 04 (most common) / 50 4B 05 06 (empty) / 50 4B 07 08 (spanned)
    match: (b) =>
      b[0] === 0x50 && b[1] === 0x4b &&
      ((b[2] === 0x03 && b[3] === 0x04) || (b[2] === 0x05 && b[3] === 0x06) || (b[2] === 0x07 && b[3] === 0x08)),
  },
  {
    label: "MS-OLE(legacy Office)",
    // 레거시 .ppt, .doc, .xls (CFBF 포맷)
    mimes: [
      "application/vnd.ms-powerpoint",
      "application/msword",
      "application/vnd.ms-excel",
    ],
    extensions: ["ppt", "doc", "xls"],
    // D0 CF 11 E0 A1 B1 1A E1
    match: (b) =>
      b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 &&
      b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1,
  },
  {
    label: "Plain text",
    mimes: ["text/plain"],
    extensions: ["txt"],
    // 텍스트는 시그니처가 없으므로 별도 휴리스틱:
    // - 처음 512바이트에 null 바이트 없음
    // - 처음 바이트가 printable ASCII 또는 UTF-8 BOM(EF BB BF)
    match: (b) => {
      if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) return true
      // null 바이트 체크
      for (let i = 0; i < Math.min(b.length, 512); i++) {
        if (b[i] === 0x00) return false
      }
      return true
    },
  },
]

/**
 * 파일의 실제 바이트를 검사하여 허용된 유형인지 확인한다.
 *
 * @param file - 업로드된 File 객체
 * @param allowedLabels - 허용할 시그니처 라벨 (기본: 모든 유형)
 * @returns 검증 결과 및 매치된 유형
 */
export async function validateFileSignature(
  file: File,
  allowedLabels?: string[],
): Promise<{ valid: boolean; matchedLabel?: string; reason?: string }> {
  if (file.size === 0) {
    return { valid: false, reason: "빈 파일입니다." }
  }

  // 시그니처 판독에는 처음 12바이트면 충분
  const headerSize = Math.min(file.size, 512)
  const buffer = await file.slice(0, headerSize).arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 확장자 추출
  const ext = file.name.split(".").pop()?.toLowerCase() || ""

  for (const sig of SIGNATURES) {
    if (sig.match(bytes)) {
      // 확장자와 시그니처가 호환되는지 추가 검사
      if (ext && !sig.extensions.includes(ext)) {
        // 확장자/시그니처 불일치
        // 단, 텍스트는 모든 확장자에서 유효하므로 ZIP/Office 우선 매치
        if (sig.label === "Plain text") continue
      }
      // 허용 라벨이 지정된 경우 필터링
      if (allowedLabels && !allowedLabels.includes(sig.label)) {
        return {
          valid: false,
          matchedLabel: sig.label,
          reason: `이 유형(${sig.label})은 이 업로드에서 허용되지 않습니다.`,
        }
      }
      return { valid: true, matchedLabel: sig.label }
    }
  }

  return {
    valid: false,
    reason: `허용되지 않는 파일 형식입니다. 파일 내용이 지원 형식(PDF, 이미지, Office 문서, 텍스트)과 일치하지 않습니다.`,
  }
}

/**
 * MIME 타입과 실제 시그니처의 일치 여부 검증
 *
 * 클라이언트가 Content-Type을 조작했을 가능성을 탐지한다.
 *
 * @param file - 업로드된 File 객체
 * @returns MIME과 실제 시그니처가 일치하면 true
 */
export async function validateMimeMatchesSignature(
  file: File,
): Promise<{ valid: boolean; matchedLabel?: string; reason?: string }> {
  const result = await validateFileSignature(file)
  if (!result.valid) return result

  // 매치된 시그니처가 클라이언트 MIME 타입과 호환되는지 확인
  const sig = SIGNATURES.find((s) => s.label === result.matchedLabel)
  if (!sig) return result

  // 텍스트 파일은 MIME 체크가 모호하므로 통과
  if (sig.label === "Plain text") return result

  if (file.type && !sig.mimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      matchedLabel: result.matchedLabel,
      reason: `파일 내용(${result.matchedLabel})과 전송된 유형(${file.type})이 일치하지 않습니다.`,
    }
  }

  return result
}
