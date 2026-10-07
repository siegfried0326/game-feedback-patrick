/**
 * 지원 회사 — 분석 설정에서 고르면 결과의 회사별 분석이 그 회사 중심으로 바뀐다
 * (2026-10-07, "넥슨이라고 입력하면 넥슨만 볼 것"이라는 학생 피드백)
 * 순서는 companyFeedback 프롬프트·랭킹 비교와 같다.
 */
export const TARGET_COMPANIES = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠"] as const
export type TargetCompany = (typeof TARGET_COMPANIES)[number]

export function isTargetCompany(v: unknown): v is TargetCompany {
  return typeof v === "string" && (TARGET_COMPANIES as readonly string[]).includes(v)
}

/** "**넥슨** 합격 문서들은 …" 형식의 문단을 회사별로 나눈다 */
export function splitCompanyFeedback(text: string): { company: string | null; body: string }[] {
  return text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const m = p.match(/^\*\*(.+?)\*\*\s*/)
      return m ? { company: m[1].trim(), body: p } : { company: null, body: p }
    })
}
