/**
 * 게임 기획 문서 직군(도메인) 분류 체계 + 직군별 채점표
 *
 * 왜 필요한가:
 * - 기존에는 모든 문서를 시스템 기획 중심 15개 카테고리로 똑같이 채점했다.
 *   그래서 레벨 기획서에 "재화 흐름이 없다", 캐릭터 기획서에 "몬스터 데이터가 없다" 같은
 *   직군과 무관한 피드백이 나왔다.
 * - 이 파일은 문서를 8개 직군으로 나누고, 직군마다 15개 카테고리 중
 *   핵심(core) / 관련(related) / 해당 없음(na) 을 정한다.
 *   해당 없음 항목은 점수를 매기지 않고 UI에 "해당 없음"으로 표시한다.
 *
 * 클라이언트·서버 양쪽에서 import 가능 (외부 의존성 없음).
 */

export type DesignDomain =
  | "level"      // 레벨 디자인 (맵, 던전, 동선, 배치)
  | "combat"     // 전투·AI (몬스터, 보스, 스킬, 캐릭터 전투)
  | "system"     // 시스템 기획 (인벤토리, 성장, 매칭, 퀘스트 등 규칙 설계)
  | "economy"    // 경제·BM (재화, 상점, 과금, 밸런싱 테이블)
  | "uiux"       // UI/UX (화면 흐름, 인터페이스, 플로우차트 중심)
  | "narrative"  // 캐릭터·서사 (세계관, 캐릭터 설정, 시나리오)
  | "data"       // 데이터 테이블 (xlsx, 스키마, ERD)
  | "general"    // 종합 (제안서, 게임 개요, 자기 PR 등 여러 영역)

export type DocForm =
  | "reverse"    // 역기획서
  | "original"   // 창작 기획서
  | "proposal"   // 개선 제안서 / 게임 제안서
  | "analysis"   // 분석서 / 레퍼런스 분석
  | "table"      // 데이터 테이블
  | "pr"         // 자기 PR / 이력서
  | "unknown"

export const DOMAIN_LABELS: Record<DesignDomain, string> = {
  level: "레벨 디자인",
  combat: "전투·AI",
  system: "시스템 기획",
  economy: "경제·BM",
  uiux: "UI/UX",
  narrative: "캐릭터·서사",
  data: "데이터 테이블",
  general: "종합 기획",
}

export const DOC_FORM_LABELS: Record<DocForm, string> = {
  reverse: "역기획서",
  original: "창작 기획서",
  proposal: "제안서",
  analysis: "분석서",
  table: "데이터 테이블",
  pr: "자기 PR",
  unknown: "기획 문서",
}

export const ALL_DOMAINS: DesignDomain[] = ["level", "combat", "system", "economy", "uiux", "narrative", "data", "general"]

/** 15개 카테고리 subject (프롬프트·UI·DB가 모두 이 문자열을 쓴다) */
export const CATEGORY_SUBJECTS = [
  "논리력", "구체성", "가독성", "기술이해", "창의성",
  "핵심반복구조", "콘텐츠분류", "재화흐름", "플레이경험", "수치데이터",
  "기능연결", "동기부여", "난이도균형", "화면조작", "개발일정",
] as const
export type CategorySubject = (typeof CATEGORY_SUBJECTS)[number]

export type Applicability = "core" | "related" | "na"

/**
 * 직군별 채점표.
 * 기본 역량 5개(논리력~창의성)는 모든 직군에서 core.
 * 게임 디자인 역량 10개는 직군에 따라 core / related / na.
 */
export const DOMAIN_RUBRIC: Record<DesignDomain, Record<CategorySubject, Applicability>> = {
  level: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "related", 콘텐츠분류: "related", 재화흐름: "na", 플레이경험: "core", 수치데이터: "core",
    기능연결: "related", 동기부여: "na", 난이도균형: "core", 화면조작: "na", 개발일정: "related",
  },
  combat: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "core", 콘텐츠분류: "related", 재화흐름: "na", 플레이경험: "core", 수치데이터: "core",
    기능연결: "related", 동기부여: "na", 난이도균형: "core", 화면조작: "na", 개발일정: "related",
  },
  system: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "core", 콘텐츠분류: "core", 재화흐름: "related", 플레이경험: "core", 수치데이터: "core",
    기능연결: "core", 동기부여: "related", 난이도균형: "related", 화면조작: "related", 개발일정: "related",
  },
  economy: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "related", 콘텐츠분류: "related", 재화흐름: "core", 플레이경험: "related", 수치데이터: "core",
    기능연결: "related", 동기부여: "core", 난이도균형: "core", 화면조작: "na", 개발일정: "related",
  },
  uiux: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "related", 콘텐츠분류: "related", 재화흐름: "na", 플레이경험: "core", 수치데이터: "related",
    기능연결: "core", 동기부여: "na", 난이도균형: "na", 화면조작: "core", 개발일정: "related",
  },
  narrative: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "related", 창의성: "core",
    핵심반복구조: "na", 콘텐츠분류: "related", 재화흐름: "na", 플레이경험: "core", 수치데이터: "related",
    기능연결: "na", 동기부여: "related", 난이도균형: "na", 화면조작: "na", 개발일정: "na",
  },
  data: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "related",
    핵심반복구조: "related", 콘텐츠분류: "core", 재화흐름: "related", 플레이경험: "na", 수치데이터: "core",
    기능연결: "core", 동기부여: "na", 난이도균형: "related", 화면조작: "na", 개발일정: "na",
  },
  general: {
    논리력: "core", 구체성: "core", 가독성: "core", 기술이해: "core", 창의성: "core",
    핵심반복구조: "core", 콘텐츠분류: "core", 재화흐름: "related", 플레이경험: "core", 수치데이터: "core",
    기능연결: "core", 동기부여: "related", 난이도균형: "related", 화면조작: "related", 개발일정: "core",
  },
}

/** 직군별로 "이 문서에서 특히 봐야 할 것" — 프롬프트에 그대로 들어간다 */
export const DOMAIN_FOCUS: Record<DesignDomain, string[]> = {
  level: [
    "공간 구조·동선이 의도한 플레이 경험(탐험, 긴장, 휴식)을 만들어내는지",
    "구간별 목표와 페이싱(난이도 곡선, 체류 시간)이 설계되어 있는지",
    "랜드마크·시야·유도 장치로 플레이어를 길 잃지 않게 안내하는지",
    "오브젝트·적 배치의 이유가 설명되어 있는지 (배치표, 평면도, 가레벨)",
    "레퍼런스 공간·게임 분석이 설계 결정으로 이어지는지",
  ],
  combat: [
    "적·보스의 패턴이 플레이어에게 읽히고 대응 가능한 구조인지 (텔레그래프, 회피 창)",
    "FSM/비헤이비어 트리 등 AI 상태 설계가 명확한지",
    "스탯·데미지·쿨타임 수치와 그 근거(계산식, 테스트)가 있는지",
    "페이즈 전환·난이도 조절 장치가 있는지",
    "플레이어 킷(스킬, 조작)과의 상호작용이 고려됐는지",
  ],
  system: [
    "시스템의 기획 의도(어떤 문제를 풀고 어떤 경험을 주는가)가 선명한지",
    "규칙·예외·상태 전이가 빠짐없이 정의되어 있는지 (플로우차트, 조건표)",
    "다른 시스템과의 연결과 영향 범위가 정리되어 있는지",
    "필요한 데이터 구조(테이블, 필드)가 정의되어 있는지",
    "레퍼런스 분석이 설계 선택의 근거로 쓰였는지",
  ],
  economy: [
    "재화의 획득·소비·소멸 경로가 닫힌 순환으로 설계되어 있는지",
    "인플레이션·고착화를 막는 장치(싱크, 상한)가 있는지",
    "수치 테이블과 성장 곡선, 그 산출 근거가 있는지",
    "과금·보상 설계가 플레이 동기와 연결되는지",
    "밸런스 검증 방법(시뮬레이션, 기대값)이 있는지",
  ],
  uiux: [
    "사용자 흐름(진입→행동→피드백)이 플로우차트·화면 흐름으로 명확한지",
    "정보 구조(IA)와 화면 위계가 설계되어 있는지",
    "문제 정의 → 개선안 → 기대 효과의 논리가 이어지는지",
    "컴포넌트별 기능·상태·예외가 정의되어 있는지",
    "레퍼런스 UI 분석이 개선안의 근거로 쓰였는지",
  ],
  narrative: [
    "세계관·캐릭터 설정이 일관되고 게임 플레이와 연결되는지",
    "캐릭터의 역할·갈등·성장이 플레이어 경험에 어떻게 작용하는지",
    "시나리오 구조(기승전결, 분기)가 설계되어 있는지",
    "연출·대사·비주얼 레퍼런스가 설정을 뒷받침하는지",
    "서사가 시스템(퀘스트, 보상)으로 어떻게 구현되는지",
  ],
  data: [
    "테이블 설계의 목적(어떤 시스템을 데이터로 제어하는가)이 분명한지",
    "컬럼 정의(자료형, 단위, 참조 관계, Enum)가 명확한지",
    "테이블 간 참조 무결성과 확장성이 고려됐는지",
    "예시 데이터가 충분하고 밸런스 의도를 읽을 수 있는지",
    "기획자가 실제로 조정 가능한 파라미터 구조인지",
  ],
  general: [
    "게임의 핵심 재미와 코어 루프가 한 문장으로 정의되는지",
    "타겟·시장·레퍼런스 분석이 설계 결정의 근거로 쓰였는지",
    "주요 시스템들이 서로 어떻게 연결되는지 구조도가 있는지",
    "개발 범위·일정·우선순위가 현실적인지",
    "수치와 시각 자료로 주장을 뒷받침하는지",
  ],
}

/**
 * 직군별 "이 문서에서 요구하면 안 되는 것" — 프롬프트 금지 목록.
 * 학습 DB에서 실제로 발견된 오류 유형을 그대로 반영했다 (AUDIT_학습DB_정제_2026-10-06.md).
 */
export const DOMAIN_DO_NOT_ASK: Record<DesignDomain, string[]> = {
  level: ["BM·과금·재화 흐름", "몬스터 스탯·데미지 수치", "UI/HUD 디자인", "사운드", "최적화·성능", "경제 시스템 영향"],
  combat: ["BM·과금·경제 시스템 영향", "UI/UX 목업", "시장·타겟 분석", "최적화·성능"],
  system: ["몬스터 AI·보스 패턴", "레벨 지형·동선", "사운드", "최적화·성능"],
  economy: ["몬스터 AI·패턴", "레벨 지형·동선", "UI 목업", "서사·세계관"],
  uiux: ["BM·경제 시스템 영향", "몬스터 스탯", "레벨 지형", "최적화·성능", "서사"],
  narrative: ["수치 테이블·데이터 구조", "플로우차트", "BM·재화", "몬스터 스탯", "UI 목업", "최적화"],
  data: ["UI/UX 디자인", "서사·세계관", "플레이 영상", "시장 분석"],
  general: ["엔진 구현 가능성 검토", "A/B 테스트 결과", "최적화·성능"],
}

/** 모든 직군 공통 — 취준생 포트폴리오에 요구하면 안 되는 상투 문구 */
export const UNIVERSAL_DO_NOT_ASK = [
  "실제 플레이 테스트·A/B 테스트·사용자 피드백 결과 (취준생은 수행 불가)",
  "실제 게임 엔진에서의 구현 가능성·기술적 제약 검토",
  "개발 비용·인력·일정 산정",
  "DAU·매출 등 라이브 KPI 예측",
]

// ───────────────────────────────────────────
// 휴리스틱 분류 (Haiku 분류 실패 시 폴백, 학습 DB 직군 추정에도 사용)
// ───────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<Exclude<DesignDomain, "general">, RegExp> = {
  level: /레벨\s?디자인|레벨디자인|레벨 ?기획|맵\b|맵 |던전|스테이지|동선|지형|랜드마크|오픈월드|가레벨|평면도|배치도|전장|라스트라|성역.*레벨/i,
  combat: /전투|스킬|보스|몬스터|적 ?시스템|적\s?세부|패턴|비헤이비어|FSM|상태 ?머신|\bAI\b|유닛|영웅|TTK|히트박스|데미지|어그로|타격감|무기|총기/i,
  economy: /재화|\bBM\b|과금|경제|상점|가챠|뽑기|보상 ?테이블|수익|결제|밸런싱 ?테이블|성장 ?곡선|인플레|천장|확률형/i,
  uiux: /UI|UX|HUD|미니맵|화면|메뉴|플로우차트|인터페이스|게이지|IA\b|와이어프레임|목업/i,
  narrative: /캐릭터 ?기획|캐릭터 ?컨셉|캐릭터 ?설정|세계관|스토리|서사|시나리오|NPC|대사|퀘스트 ?디자인|스토리텔링/i,
  data: /데이터 ?테이블|테이블 ?설계|Table ?data|스키마|ERD|데이터 ?정의|Define|\.xlsx$/i,
  system: /시스템|인벤토리|성장|강화|매칭|퀘스트|포획|그래플링|이동|추격|심볼|체형|규격|튜토리얼|콘텐츠|컨텐츠|요리|도감|장비|유물|토핑|트라이포드/i,
}

const FORM_KEYWORDS: Array<[DocForm, RegExp]> = [
  ["pr", /자기 ?PR|이력서|자기소개|포트폴리오 소개|프로젝트 경험 정리/i],
  ["table", /데이터 ?테이블|테이블 ?설계|Table ?data|\.xlsx$/i],
  ["proposal", /제안서|개선 ?제안|개선안|신규 ?콘텐츠|신규 ?컨텐츠|신규 ?유닛|신규 ?영웅/i],
  ["analysis", /분석서|분석 ?자료|레퍼런스 ?분석|패치 ?분석|비교 ?분석/i],
  ["reverse", /역기획|모드 ?역기획/i],
  ["original", /창작|기획서/i],
]

export interface HeuristicClassification {
  domain: DesignDomain
  secondary: DesignDomain[]
  docForm: DocForm
  scores: Partial<Record<DesignDomain, number>>
}

/**
 * 파일명·태그·요약·본문 앞부분으로 직군을 추정한다.
 * 파일명과 태그는 가중치 3, 요약/본문은 1.
 * 아무것도 매칭되지 않거나 여러 직군이 비슷하게 매칭되면 general.
 */
export function classifyHeuristically(input: {
  fileName?: string
  tags?: string[]
  summary?: string
  text?: string
}): HeuristicClassification {
  const strong = [input.fileName ?? "", ...(input.tags ?? [])].join(" ")
  const weak = `${input.summary ?? ""} ${(input.text ?? "").slice(0, 4000)}`
  const scores: Partial<Record<DesignDomain, number>> = {}

  for (const [domain, rx] of Object.entries(DOMAIN_KEYWORDS) as Array<[Exclude<DesignDomain, "general">, RegExp]>) {
    const g = new RegExp(rx.source, rx.flags.includes("g") ? rx.flags : rx.flags + "g")
    const s = (strong.match(g)?.length ?? 0) * 3 + (weak.match(g)?.length ?? 0)
    if (s > 0) scores[domain] = s
  }

  const ranked = (Object.entries(scores) as Array<[DesignDomain, number]>).sort((a, b) => b[1] - a[1])
  let docForm: DocForm = "unknown"
  for (const [form, rx] of FORM_KEYWORDS) {
    if (rx.test(strong) || rx.test(weak.slice(0, 500))) { docForm = form; break }
  }

  if (ranked.length === 0 || docForm === "pr") {
    return { domain: "general", secondary: ranked.slice(0, 2).map(([d]) => d), docForm, scores }
  }

  // 데이터 테이블 형식이면 data 우선 (xlsx 등)
  if (docForm === "table" && scores.data) {
    return { domain: "data", secondary: ranked.filter(([d]) => d !== "data").slice(0, 2).map(([d]) => d), docForm, scores }
  }

  const [top, topScore] = ranked[0]
  const second = ranked[1]
  // 1·2위 점수가 비슷하고 서로 다른 축이면 종합 문서로 본다 (예: 시스템 + UI + 경제가 모두 있는 제안서)
  if (second && second[1] >= topScore * 0.8 && ranked.length >= 3 && ranked[2][1] >= topScore * 0.6) {
    return { domain: "general", secondary: ranked.slice(0, 3).map(([d]) => d), docForm, scores }
  }

  return { domain: top, secondary: ranked.slice(1, 3).map(([d]) => d), docForm, scores }
}

export function isDesignDomain(value: unknown): value is DesignDomain {
  return typeof value === "string" && (ALL_DOMAINS as string[]).includes(value)
}

export function isDocForm(value: unknown): value is DocForm {
  return typeof value === "string" && Object.keys(DOC_FORM_LABELS).includes(value)
}

/** 직군 기준으로 평가하지 않는 카테고리 목록 */
export function notApplicableSubjects(domain: DesignDomain): CategorySubject[] {
  return CATEGORY_SUBJECTS.filter(s => DOMAIN_RUBRIC[domain][s] === "na")
}


/** 직군별로 함께 다뤄지기 쉬운 이웃 직군 — AI가 보조 직군을 2개 못 고를 때 채우는 순서 */
const NEIGHBOR_DOMAINS: Record<DesignDomain, DesignDomain[]> = {
  level: ["combat", "narrative", "general"],
  combat: ["system", "level", "data"],
  system: ["economy", "data", "combat"],
  economy: ["system", "data", "general"],
  uiux: ["system", "general", "narrative"],
  narrative: ["level", "general", "uiux"],
  data: ["system", "economy", "combat"],
  general: ["system", "level", "combat"],
}

/** 주 직군 + 보조 직군을 정확히 3개로 맞춘다 (분석 설정 화면의 AI 기본 선택) */
export function pickThreeDomains(primary: DesignDomain, secondary: DesignDomain[] = []): DesignDomain[] {
  const out: DesignDomain[] = [primary]
  for (const d of [...secondary, ...NEIGHBOR_DOMAINS[primary]]) {
    if (out.length >= 3) break
    if (!out.includes(d)) out.push(d)
  }
  return out
}
