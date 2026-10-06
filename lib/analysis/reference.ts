/**
 * 비교 대상 합격 포트폴리오 선택 + 직군 기준표 (서버 전용)
 *
 * 2026-10-06 재구축 (data/standards/README.md):
 * - 비교 재료 = **기준 카드**(합격 문서에서 '있는 것, 합격 수준인 이유'만 뽑은 것) + 원문 발췌(벡터 검색).
 *   Gemini가 써 둔 약점(weaknesses)과 요약(summary)은 더 이상 프롬프트에 넣지 않는다.
 *   (합격 문서의 '약점'은 대개 그 직군에 필요 없는 항목이라 사용자 피드백을 오염시켰다)
 * - 같은 직군 합격작만 비교군으로 쓴다. 표본이 부족하면 무작위로 채우지 않고 부족하다고 밝힌다.
 * - 같은 문서를 회사만 바꿔 낸 사본(duplicate_of)은 비교군·통계에서 한 건으로 친다.
 * - 합격작은 파일명·게임명·작성자 없이 **anon_label(구조 설명)**로만 프롬프트에 들어간다.
 * - 정렬이 결정적(카드 있는 것 우선 → 점수 → id)이라 같은 직군이면 프롬프트가 같다 → 캐시 적중.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  classifyHeuristically,
  isDesignDomain,
  DOMAIN_LABELS,
  type DesignDomain,
} from "./domains"

export interface StandardCard {
  domain?: string
  secondary?: string[]
  docForm?: string
  pages?: number
  structure?: string[]
  artifacts?: string[]
  depth?: { numeric_tables?: number; diagrams?: number; references_analyzed?: number; intent_to_decision?: string }
  why_it_works?: string[]
  standard_elements?: string[]
  excerpt_pages?: number[]
}

export interface ReferencePortfolio {
  id: string
  tags: string[]
  companies: string[]
  overall_score: number | null
  strengths: string[]
  design_domain: string | null
  standard_card: StandardCard | null
  anon_label: string | null
  duplicate_of: string | null
  resolvedDomain: DesignDomain
  secondaryDomains: DesignDomain[]
  /** 휴리스틱 분류용 (프롬프트에는 넣지 않음) */
  _file_name: string
}

export interface ReferenceSet {
  domain: DesignDomain
  examples: ReferencePortfolio[]
  sameDomain: ReferencePortfolio[]
  all: ReferencePortfolio[]
  sameDomainCount: number
  cardedCount: number
  insufficient: boolean
  companyStats: Record<string, { total: number; count: number }>
  avgOverall: number
  topTags: string[]
  section: string
}

const MIN_SAME_DOMAIN = 5
const MAX_EXAMPLES = 12
export const PRIORITY_COMPANIES = ["넥슨", "엔씨소프트", "넷마블", "크래프톤", "스마일게이트", "펄어비스", "네오위즈", "웹젠"]

const BASE_FIELDS = "id, file_name, tags, companies, overall_score, strengths"
const SELECT_FULL = `${BASE_FIELDS}, design_domain, standard_card, anon_label, duplicate_of`
const SELECT_020 = `${BASE_FIELDS}, design_domain`

// 카드 표준 어휘 → 사용자에게 보여줄 한국어 (data/standards/README.md와 동일)
export const ELEMENT_LABELS: Record<string, string> = {
  // artifacts
  flowchart: "플로우차트", state_machine: "상태도(FSM)", data_table: "데이터 테이블", numeric_table: "수치 표",
  floor_plan: "평면도·맵 구조도", route_map: "동선·루트도", placement_table: "배치표", wireframe: "UI 와이어프레임",
  screenshot_analysis: "실제 화면 분석", reference_comparison: "레퍼런스 비교", prototype_video: "가레벨·프로토타입 영상",
  storyboard: "스토리보드", erd: "ERD", formula: "계산식", persona: "페르소나·타겟", test_list: "테스트·검증 리스트",
  schedule: "일정·산출물 계획", concept_art: "컨셉·레퍼런스 이미지",
  // standard_elements
  problem_definition: "문제 정의", intent_statement: "기획 의도", reference_to_decision: "레퍼런스 → 설계 결정",
  expected_effect: "기대 효과", scope_limits: "범위·제한 명시",
  section_intent: "구간별 기획 의도", pacing_curve: "페이싱·난이도 곡선", landmark_guidance: "랜드마크·시선 유도",
  playtest_plan: "플레이테스트 계획", spatial_metrics: "공간 규격 수치",
  pattern_telegraph: "패턴 예고·대응", ai_states: "AI 상태 설계", stat_table: "스탯·수치표", phase_design: "페이즈 설계",
  player_kit_interaction: "플레이어 기술과의 상호작용",
  rule_spec: "규칙·예외 명세", state_transition: "상태 전이", system_links: "타 시스템 연결", data_schema: "데이터 구조", ui_flow: "UI 흐름",
  sink_source: "획득·소비·소멸 경로", inflation_control: "인플레이션 제어", growth_curve: "성장 곡선", pricing_logic: "가격·보상 논리", simulation: "시뮬레이션·기대값",
  ia_structure: "정보 구조(IA)", user_flow: "사용자 흐름", component_spec: "컴포넌트 명세", before_after: "개선 전/후 비교", ux_principle: "UX 원칙",
  world_consistency: "세계관 일관성", character_arc: "캐릭터 역할·성장", branching: "분기 구조", narrative_to_system: "서사 → 시스템 연결",
  column_definition: "컬럼 정의", referential_integrity: "참조 관계", enum_usage: "Enum 활용", sample_rows: "예시 데이터", designer_tunable: "조정 가능 파라미터",
  core_loop: "코어 루프", market_target: "시장·타겟", system_map: "시스템 구조도", dev_plan: "개발 계획",
}
const label = (k: string) => ELEMENT_LABELS[k] ?? k

type Row = Omit<ReferencePortfolio, "resolvedDomain" | "secondaryDomains" | "_file_name"> & { file_name: string }

async function fetchAllPortfolios(supabase: SupabaseClient): Promise<ReferencePortfolio[]> {
  // 021 → 020 → 기본 컬럼 순으로 시도 (마이그레이션 전에도 동작)
  let data: unknown[] | null = null
  for (const select of [SELECT_FULL, SELECT_020, BASE_FIELDS]) {
    const res = await supabase.from("portfolios").select(select)
    if (!res.error) { data = res.data as unknown[]; break }
    if (!/column|does not exist|schema cache/i.test(res.error.message)) {
      console.error("[reference] portfolios 조회 실패:", res.error.message)
      return []
    }
  }
  return ((data ?? []) as Partial<Row>[]).map(r => {
    const base = {
      id: r.id!,
      tags: r.tags ?? [],
      companies: r.companies ?? [],
      overall_score: r.overall_score ?? null,
      strengths: r.strengths ?? [],
      design_domain: r.design_domain ?? null,
      standard_card: (r.standard_card as StandardCard | null) ?? null,
      anon_label: r.anon_label ?? null,
      duplicate_of: r.duplicate_of ?? null,
    }
    let domain: DesignDomain
    let secondary: DesignDomain[]
    const h = classifyHeuristically({ fileName: r.file_name, tags: base.tags })
    if (isDesignDomain(base.design_domain)) {
      domain = base.design_domain
      const cardSecondary = (base.standard_card?.secondary ?? []).filter(isDesignDomain)
      secondary = (cardSecondary.length ? cardSecondary : h.secondary).filter(d => d !== domain)
    } else {
      domain = h.domain
      secondary = h.secondary
    }
    return { ...base, resolvedDomain: domain, secondaryDomains: secondary, _file_name: r.file_name ?? "" }
  })
}

/** 사본을 원본에 합친다 — 회사 목록은 합집합 */
function dedupe(rows: ReferencePortfolio[]): ReferencePortfolio[] {
  const byId = new Map(rows.map(r => [r.id, { ...r, companies: [...r.companies] }]))
  for (const r of rows) {
    if (!r.duplicate_of) continue
    const primary = byId.get(r.duplicate_of)
    if (primary) primary.companies = [...new Set([...primary.companies, ...r.companies])]
    byId.delete(r.id)
  }
  return [...byId.values()]
}

/** 결정적 정렬: 카드 있는 것 → 점수 → id */
function stableSort(rows: ReferencePortfolio[]): ReferencePortfolio[] {
  return [...rows].sort((a, b) =>
    Number(!!b.standard_card) - Number(!!a.standard_card) ||
    (b.overall_score ?? 0) - (a.overall_score ?? 0) ||
    a.id.localeCompare(b.id)
  )
}

function pickBalanced(rows: ReferencePortfolio[], limit: number): ReferencePortfolio[] {
  const sorted = stableSort(rows)
  const picked: ReferencePortfolio[] = []
  const used = new Set<string>()
  // 카드 있는 문서는 모두 먼저 넣는다 (가장 신뢰도 높은 비교 재료)
  for (const p of sorted) {
    if (picked.length >= limit) break
    if (p.standard_card) { picked.push(p); used.add(p.id) }
  }
  for (const company of PRIORITY_COMPANIES) {
    let n = 0
    for (const p of sorted) {
      if (n >= 1 || picked.length >= limit) break
      if (!used.has(p.id) && p.companies.includes(company)) { picked.push(p); used.add(p.id); n++ }
    }
  }
  for (const p of sorted) {
    if (picked.length >= limit) break
    if (!used.has(p.id)) { picked.push(p); used.add(p.id) }
  }
  return picked
}

export async function loadReferenceSet(supabase: SupabaseClient, domain: DesignDomain): Promise<ReferenceSet> {
  const all = dedupe(await fetchAllPortfolios(supabase))

  const sameDomain = domain === "general"
    ? all
    : all.filter(p => p.resolvedDomain === domain || p.secondaryDomains[0] === domain)
  const insufficient = sameDomain.length < MIN_SAME_DOMAIN

  let examples = pickBalanced(sameDomain, MAX_EXAMPLES)
  const fillerIds = new Set<string>()
  if (examples.length < MIN_SAME_DOMAIN) {
    const generalPool = all.filter(p => p.resolvedDomain === "general" && !examples.some(e => e.id === p.id))
    const fillers = pickBalanced(generalPool, MIN_SAME_DOMAIN - examples.length)
    fillers.forEach(f => fillerIds.add(f.id))
    examples = [...examples, ...fillers]
  }

  const statsPool = sameDomain.length > 0 ? sameDomain : all
  const companyStats: Record<string, { total: number; count: number }> = {}
  for (const p of statsPool) {
    for (const c of p.companies) {
      companyStats[c] ??= { total: 0, count: 0 }
      companyStats[c].total += p.overall_score ?? 0
      companyStats[c].count += 1
    }
  }
  const avgOverall = statsPool.length > 0
    ? Math.round(statsPool.reduce((a, b) => a + (b.overall_score ?? 0), 0) / statsPool.length)
    : 85
  const tagCounts: Record<string, number> = {}
  for (const p of statsPool) for (const t of p.tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t)

  const carded = sameDomain.filter(p => p.standard_card)
  const section = buildReferenceSection({ domain, examples, fillerIds, sameDomainCount: sameDomain.length, total: all.length, insufficient, carded, topTags })

  return { domain, examples, sameDomain, all, sameDomainCount: sameDomain.length, cardedCount: carded.length, insufficient, companyStats, avgOverall, topTags, section }
}

/** 직군 기준표: 카드가 있는 합격작에서 각 요소를 몇 건이 갖췄는지 */
function buildChecklist(carded: ReferencePortfolio[]): string {
  if (carded.length === 0) return ""
  const counts: Record<string, number> = {}
  for (const p of carded) {
    const keys = new Set([...(p.standard_card?.artifacts ?? []), ...(p.standard_card?.standard_elements ?? [])])
    for (const k of keys) counts[k] = (counts[k] ?? 0) + 1
  }
  // 과반이 갖춘 요소만, 최대 10개 — 대조표가 길어지면 사용자에게 핵심이 흐려진다
  const rows = Object.entries(counts)
    .filter(([, n]) => n >= Math.max(2, Math.ceil(carded.length * 0.6)))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10)
    .map(([k, n]) => `| ${label(k)} | ${n}/${carded.length} |`)
  if (rows.length === 0) return ""
  return `### 이 직군 합격작 공통 요소 (검수된 기준 카드 ${carded.length}건 기준)
| 요소 | 갖춘 합격작 |
|---|---|
${rows.join("\n")}

→ 응답의 standardsCheck에 위 요소마다 이 문서가 "있음/부분/없음"인지 판정하고 근거를 한 줄로 적으세요.`
}

function describeCard(c: StandardCard): string {
  const parts: string[] = []
  if (c.structure?.length) parts.push(`- 구조: ${c.structure.join(" → ")}`)
  if (c.artifacts?.length) parts.push(`- 산출물: ${c.artifacts.map(label).join(", ")}`)
  if (c.depth) {
    const d = c.depth
    parts.push(`- 깊이: 수치 표 ${d.numeric_tables ?? 0} · 도식 ${d.diagrams ?? 0} · 레퍼런스 ${d.references_analyzed ?? 0} · 의도→결정 연결 ${d.intent_to_decision ?? "-"}`)
  }
  if (c.why_it_works?.length) parts.push(`- 합격 수준인 이유:\n${c.why_it_works.map(w => `  · ${w}`).join("\n")}`)
  return parts.join("\n")
}

function buildReferenceSection(p: {
  domain: DesignDomain
  examples: ReferencePortfolio[]
  fillerIds: Set<string>
  sameDomainCount: number
  total: number
  insufficient: boolean
  carded: ReferencePortfolio[]
  topTags: string[]
}): string {
  const domainLabel = DOMAIN_LABELS[p.domain]

  const exampleText = p.examples.map((e, idx) => {
    const filler = p.fillerIds.has(e.id) ? " (인접 직군 — 종합 기획 문서)" : ""
    const title = e.anon_label ?? `${DOMAIN_LABELS[e.resolvedDomain]} 합격 문서`
    if (e.standard_card) {
      return `### 비교 기준 ${idx + 1}${filler} — ${title}\n${describeCard(e.standard_card)}`
    }
    // 카드가 아직 없는 문서: Gemini 강점(긍정 서술)만 짧게. 약점·요약은 넣지 않는다.
    const strengths = e.strengths.slice(0, 3).map(s => `  · ${s}`).join("\n")
    return `### 비교 기준 ${idx + 1}${filler} — ${title} (요약 기준, 상세 카드 미작성)\n- 강점:\n${strengths || "  · (기록 없음)"}`
  }).join("\n\n")

  const sufficiencyNote = p.insufficient
    ? `\n> ⚠️ **표본 주의**: ${domainLabel} 직군 합격 문서는 ${p.sameDomainCount}건뿐이다. 종합 기획 문서로 보충했다. "${domainLabel} 합격자들은 ~"처럼 단정하지 말고 "합격 포트폴리오들은 대체로 ~"로 표현하라.\n`
    : ""

  return `## 📊 비교 기준 — ${domainLabel} 합격 문서 ${p.sameDomainCount}건 (전체 ${p.total}건 중, 중복 제외)
${sufficiencyNote}
### 🎯 절대 기준
아래 합격 문서들은 **모두 100점 기준선**이다. 사용자 문서가 이 수준에 비해 얼마나 부족한지를 평가하라.

${buildChecklist(p.carded)}

### 이 직군 합격 문서 공통 키워드
${p.topTags.join(", ") || "(데이터 부족)"}

---

## 🎯 ${domainLabel} 합격 문서 (${p.examples.length}건)
${exampleText}

---

## ⚠️ 비교 서술 규칙
- 합격 문서는 위의 **구조 설명으로만** 가리켜라. 예: "PvP 쟁탈맵 리메이크 합격작은 모든 공간에 W×L×H를 적었다", "같은 직군 합격작은 전부 루트도가 있다".
- 게임 제목, 프로젝트 고유명, 사람 이름, 파일명, "비교 기준 N번"은 절대 쓰지 마라.
- 합격 문서의 장점을 근거로 사용자 문서의 **격차**를 말하되, 합격 문서의 단점은 언급하지 마라 (우리는 합격 문서의 단점을 기록하지 않는다).
- 일반 사용자 문서의 가장 흔한 점수대는 **50~75점**이다. 70점대 후반에 수렴하지 마라.`
}
