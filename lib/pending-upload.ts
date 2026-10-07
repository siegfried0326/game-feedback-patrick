/**
 * 홈 → 분석 페이지 파일 전달 (클라이언트 메모리)
 *
 * 홈 히어로의 업로드 창에 파일을 놓으면 여기 담아 두고 /analyze로 이동한다.
 * Next.js 클라이언트 내비게이션은 JS 모듈 상태를 유지하므로 별도 저장소 없이 넘길 수 있다.
 * 새로고침하면 사라진다 — 그 경우 분석 페이지에서 다시 올리면 된다.
 */

let pending: File[] | null = null

/** 분석 페이지와 같은 허용 형식 (components/analyze-dashboard.tsx useDropzone) */
export const UPLOAD_ACCEPT: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
  "application/vnd.ms-powerpoint": [".ppt"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "application/vnd.ms-excel": [".xls"],
  "text/plain": [".txt"],
}

export const UPLOAD_MAX_SIZE = 200 * 1024 * 1024

export function setPendingUpload(files: File[]) {
  pending = files.length ? files : null
}

/** 한 번 꺼내면 비워진다 */
export function takePendingUpload(): File[] | null {
  const f = pending
  pending = null
  return f
}

export function hasPendingUpload(): boolean {
  return pending !== null
}
