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

/**
 * react-dropzone용 파일 수집기 — 표준 dataTransfer.files만 쓴다.
 *
 * 기본 수집기(file-selector 2.x)는 https 페이지에서 드롭 시 getAsFileSystemHandle().getFile()을 먼저 쓰는데,
 * 일부 내장 브라우저(Claude 앱 브라우저 등 Electron 계열)는 이를 NotAllowedError로 막아 드롭이 통째로 실패한다
 * (2026-10-07 운영 확인). 드래그 중(dragenter/over)에는 형식 검사용으로 DataTransferItem을 그대로 돌려준다.
 */
export async function getDroppedFiles(event: unknown): Promise<(File | DataTransferItem)[]> {
  // 파일 선택 창(input change)
  const target = (event as { target?: { files?: FileList | null } } | null)?.target
  if (target?.files) return Array.from(target.files)

  const dt = (event as { dataTransfer?: DataTransfer | null } | null)?.dataTransfer
  if (dt) {
    if ((event as { type?: string }).type === "drop") return Array.from(dt.files ?? [])
    return Array.from(dt.items ?? []).filter(item => item.kind === "file")
  }

  // useFsAccessApi 경로(파일 핸들 배열) — 이 프로젝트는 쓰지 않지만 안전하게 처리
  if (Array.isArray(event)) {
    return Promise.all(event.map((h: { getFile: () => Promise<File> }) => h.getFile()))
  }
  return []
}
