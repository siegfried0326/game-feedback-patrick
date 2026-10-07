/**
 * 점수 → 등급 (합격 문서 기준) — 결과 화면·프로젝트 화면 공용
 *
 * 채점 기준(lib/analysis/reference.ts "점수 보정 기준", prompt.ts 점수 구간)과 같은 경계를 쓴다.
 * 합격 문서끼리 줄 세우지 않는다 — "합격 문서 수준에 얼마나 가까운가"만 보여준다.
 */
export interface Grade {
  key: "top" | "avg" | "pass" | "improve" | "draft"
  label: string
  range: string
  min: number
  max: number
  /** 칩·막대 배경 */
  bar: string
  /** 글자색 */
  text: string
  /** 점수 링 색 */
  ring: string
  /** 한 줄 설명 */
  desc: string
}

export const GRADES: Grade[] = [
  { key: "draft", label: "초안 단계", range: "~59", min: 0, max: 59, bar: "bg-red-500/20", text: "text-red-700", ring: "#DC2626", desc: "핵심 요소가 대부분 비어 있는 초안이에요." },
  { key: "improve", label: "보완 필요", range: "60~77", min: 60, max: 77, bar: "bg-amber-500/25", text: "text-amber-700", ring: "#D97706", desc: "뼈대는 있지만 합격 문서가 갖춘 요소의 절반 이하예요." },
  { key: "pass", label: "합격선", range: "78~84", min: 78, max: 84, bar: "bg-primary/15", text: "text-primary", ring: "#3B78D1", desc: "합격 문서 하위권과 비슷한 수준이에요." },
  { key: "avg", label: "합격 평균", range: "85~90", min: 85, max: 90, bar: "bg-primary/30", text: "text-primary", ring: "#0046AD", desc: "합격 문서 평균 수준이에요." },
  { key: "top", label: "합격 상위", range: "91+", min: 91, max: 100, bar: "bg-primary/50", text: "text-primary", ring: "#002E73", desc: "합격 문서 중에서도 상위 수준이에요." },
]

export function gradeOf(score: number): Grade {
  return GRADES.find(g => score >= g.min && score <= g.max) ?? GRADES[0]
}
