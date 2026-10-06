/**
 * 합격 포트폴리오 고유명 차단 (서버 전용)
 *
 * 사용자 피드백에 합격작을 특정할 수 있는 이름(게임명·IP·프로젝트·고유 콘텐츠명·회사명)이 나오면 안 된다.
 * 프롬프트 규칙만으로는 부족했다 — 원문 발췌에 같은 팀 프로젝트 문서가 걸리면 모델이 지역명을 그대로 옮겼다
 * (2026-10-07 테스트). 그래서 두 겹으로 막는다:
 *   1) maskForPrompt  — 발췌를 프롬프트에 넣기 전에 금지어를 [고유명]으로 가린다
 *   2) scrubOutput    — 모델 응답(JSON)의 모든 문자열에서 금지어를 지운다
 * 둘 다 **사용자 자기 문서에 등장하는 단어는 건드리지 않는다** (사용자가 메이플스토리 역기획을 올렸으면 그 이름은 써도 된다).
 *
 * 금지어 원본: data/standards/banned-terms.json (scripts/validate-cards.mjs와 공유)
 */

import bannedTerms from "@/data/standards/banned-terms.json"

const COMPANY_NAMES = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠", "매드엔진"]

// PDF 추출 텍스트는 띄어쓰기가 원본과 다르게 나오는 일이 잦다("계몽의 성역" ↔ "계몽의  성역" ↔ "계몽의성역").
// 비교·매칭 모두 공백을 무시해야 사용자 자기 문서의 이름을 잘못 지우지 않고, 띄어 쓴 금지어도 놓치지 않는다.
const squash = (s: string) => s.replace(/\s+/g, "").toLowerCase()

function termsNotIn(userText: string): string[] {
  const own = squash(userText)
  return (bannedTerms.games as string[])
    .filter(t => t.length >= 2 && !own.includes(squash(t)))
    .sort((a, b) => b.length - a.length)
}

function escapeRx(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function buildRx(terms: string[]): RegExp | null {
  if (terms.length === 0) return null
  const flexible = (t: string) => [...t.replace(/\s+/g, "")].map(escapeRx).join("\\s*")
  return new RegExp(terms.map(flexible).join("|"), "gi")
}

/** 프롬프트용: 합격작 발췌 속 고유명을 [고유명]으로 가린다. 회사명은 발췌 헤더에 쓰이므로 여기선 두지 않는다. */
export function maskForPrompt(text: string, userText: string): string {
  const rx = buildRx(termsNotIn(userText))
  return rx ? text.replace(rx, "[고유명]") : text
}

/**
 * 출력용: 응답 객체의 모든 문자열에서 고유명을 지운다.
 * companyFeedback의 **회사명** 표기는 서비스 기능이므로 회사명은 지우지 않는다.
 * @returns 지운 횟수 (로그용)
 */
export function scrubOutput<T>(value: T, userText: string): { value: T; removed: number } {
  const rx = buildRx(termsNotIn(userText))
  if (!rx) return { value, removed: 0 }
  let removed = 0
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      return v.replace(rx, () => { removed++; return "한 합격 문서" })
        .replace(/\[고유명\]/g, () => { removed++; return "한 합격 문서" })
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    }
    return v
  }
  return { value: walk(value) as T, removed }
}

export { COMPANY_NAMES }
