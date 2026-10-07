/**
 * 같은 문서 판별 — 파일명이 조금 달라도(버전 번호·날짜·"최종"·"수정"·"2차" 등) 같은 문서로 본다
 * 화면(저장 창 기본값·이전 버전 비교)과 서버(같은 문서 직전 분석을 점수 기준점으로)가 함께 쓴다.
 */
export function fileBaseName(name?: string | null): string {
  return (name || "").replace(/\.(pdf|docx|pptx?|xlsx?|txt)$/i, "").trim()
}

export function docKeyLoose(name?: string | null): string {
  return (name || "")
    .toLowerCase()
    .replace(/\(\d+\)|\[\d+\]/g, "")
    .replace(/(_|\s|-)?(v|ver|버전)\s*\d+(\.\d+)*/g, "")
    .replace(/최종|수정본?|복사본|copy|final|ver/g, "")
    .replace(/\d+\s*차/g, "")
    .replace(/\d{4,8}/g, "")
    .replace(/[\s_\-.()[\]]/g, "")
    .replace(/\d+$/, "")
}

/** 문서명(있으면) 또는 파일명이 같은 문서인가 */
export function isSameDocument(a: { document_name?: string | null; file_name: string }, key: string): boolean {
  const k = docKeyLoose(key)
  if (!k) return false
  return docKeyLoose(a.document_name || "") === k || docKeyLoose(fileBaseName(a.file_name)) === k
}
