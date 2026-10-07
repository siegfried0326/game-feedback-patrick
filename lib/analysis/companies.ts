/**
 * 지원 회사 — 분석 설정에서 고르면 결과의 회사별 분석이 그 회사 중심으로 바뀐다
 * (2026-10-07, "넥슨이라고 입력하면 넥슨만 볼 것"이라는 학생 피드백)
 * 순서는 companyFeedback 프롬프트·랭킹 비교와 같다.
 */
export const TARGET_COMPANIES = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠", "시프트업"] as const
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

/** 분석 중 화면에 흘려 보여주는 회사별 합격 문서 경향 (한 줄, 게임명 없이) */
export const COMPANY_TRAITS: Record<TargetCompany, string> = {
  넥슨: "플레이어 행동의 인과를 플로우차트로 도식화하고, 단계별로 학습 가능한 구조를 중시해요",
  엔씨소프트: "모든 요소를 엔진·서버에서 바로 쓸 수 있는 데이터 테이블로 엄격하게 명세해요",
  넷마블: "공간과 시스템으로 플레이어의 심리적 경험을 유도하는 설계 철학이 강해요",
  크래프톤: "개발 파이프라인에 바로 투입할 수 있는 실무 산출물과 근거 데이터를 갖춰요",
  스마일게이트: "기존 시스템의 문제를 정확히 짚고 대안을 단계적으로 설득하는 구성이 많아요",
  펄어비스: "수치 시뮬레이션과 조작감·액션 디테일을 정량적으로 검증해요",
  네오위즈: "기획 의도와 결정 근거를 장면 단위로 촘촘하게 연결해요",
  웹젠: "콘텐츠 보상과 재화 흐름을 표로 정리해 장기 플레이 동기를 설계해요",
  시프트업: "캐릭터 콘셉트·스킬·연출이 한 방향으로 맞물리는 캐릭터 중심 설계를 봐요",
}
