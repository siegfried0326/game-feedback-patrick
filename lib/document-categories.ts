/**
 * 포트폴리오 문서 유형 카테고리 정의
 *
 * 사용처:
 * - components/analyze-dashboard.tsx — 카테고리 선택 UI
 * - app/actions/analyze.ts — DB 태그 필터링 + 시스템 프롬프트 유형 주입
 *
 * DB portfolios 테이블의 tags(text[]) 필드와 매핑.
 */

export interface DocumentCategory {
  key: string
  label: string
  icon: string
  tags: string[] // DB tags 필드와 매칭되는 값들
  description: string // UI에 표시할 간단한 설명
}

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  {
    key: "system_design",
    label: "시스템기획",
    icon: "⚙️",
    tags: ["시스템기획", "시스템 기획", "시스템", "게임 시스템"],
    description: "재화, 강화, 매칭 등 게임 시스템",
  },
  {
    key: "level_design",
    label: "레벨디자인",
    icon: "🗺️",
    tags: ["레벨디자인", "레벨 디자인", "레벨", "맵", "맵 디자인"],
    description: "맵, 스테이지, 레벨 구성",
  },
  {
    key: "combat_balance",
    label: "전투/밸런스",
    icon: "⚔️",
    tags: ["밸런싱", "밸런스", "전투", "전투 시스템", "스킬"],
    description: "전투, 스킬, 수치 밸런싱",
  },
  {
    key: "character_monster",
    label: "캐릭터/몬스터",
    icon: "👾",
    tags: ["캐릭터", "몬스터", "보스", "NPC", "캐릭터 디자인"],
    description: "캐릭터, 몬스터, 보스 설계",
  },
  {
    key: "ui_ux",
    label: "UI/UX",
    icon: "🎨",
    tags: ["UI/UX", "UI", "UX", "인터페이스", "화면설계", "화면 설계"],
    description: "인터페이스, 화면 구성, UX 흐름",
  },
  {
    key: "reverse_engineer",
    label: "역기획",
    icon: "🔍",
    tags: ["역기획", "게임 분석", "역기획서"],
    description: "기존 게임의 시스템 분석",
  },
  {
    key: "data_table",
    label: "데이터테이블",
    icon: "📊",
    tags: ["데이터 테이블", "테이블 설계", "데이터테이블", "수치 설계", "데이터"],
    description: "수치 테이블, 데이터 설계",
  },
  {
    key: "content_design",
    label: "콘텐츠기획",
    icon: "📝",
    tags: ["콘텐츠", "퀘스트", "스토리", "이벤트", "콘텐츠 기획", "내러티브"],
    description: "퀘스트, 스토리, 이벤트 기획",
  },
  {
    key: "game_proposal",
    label: "게임제안서",
    icon: "📋",
    tags: ["기획서", "제안서", "게임 컨셉", "컨셉", "게임 제안서"],
    description: "신규 게임 컨셉, 기획 제안서",
  },
  {
    key: "other",
    label: "기타",
    icon: "📄",
    tags: [],
    description: "위 분류에 해당하지 않는 문서",
  },
]

/**
 * 카테고리 key로 카테고리 정보 조회
 */
export function getCategoryByKey(key: string): DocumentCategory | undefined {
  return DOCUMENT_CATEGORIES.find((c) => c.key === key)
}

/**
 * 유형별 맞춤 평가 기준
 * 시스템 프롬프트에 주입하여 해당 유형에 특화된 평가를 유도
 */
export function getTypeSpecificCriteria(categoryKey: string): string {
  const criteria: Record<string, string> = {
    system_design: `- 시스템의 목적과 핵심 루프가 명확하게 정의되었는가
- 시스템 간 상호작용과 연결 관계(의존성)가 다이어그램이나 표로 표현되었는가
- 예외 처리와 엣지 케이스(극단값, 오류 상황)를 고려했는가
- 시스템 수치 테이블(재화 획득량, 확률, 쿨다운 등)이 포함되어 있는가
- 확장성을 고려한 설계인가 (향후 콘텐츠 추가 시 대응 가능한 구조)`,

    level_design: `- 레벨의 목적과 플레이어가 느꼈으면 하는 경험(긴장, 탐험, 성취 등)이 명확한가
- 레벨 구조(동선, 구역 분배, 높낮이)가 탑뷰/사이드뷰 맵으로 시각화되었는가
- 난이도 곡선과 페이싱(전투→휴식→보상 리듬)이 설계되었는가
- 레퍼런스 게임의 레벨을 분석하고 차별화 요소를 도출했는가
- 플레이어 동선과 시선 유도 장치(랜드마크, 조명, 길 안내)가 고려되었는가`,

    combat_balance: `- 전투 공식(데미지 = 공격력 × 계수 - 방어력 등)과 수치 계산 근거가 명확한가
- 밸런스 시뮬레이션이나 예상 전투 결과 테이블이 있는가
- 캐릭터/무기/스킬 간 상성 관계가 설계되었는가
- 성장 곡선(레벨별 스탯, 장비별 수치)이 그래프나 표로 제시되었는가
- 전투 시나리오별(1:1, 1:N, 보스전) 예상 플레이를 시뮬레이션했는가`,

    character_monster: `- 캐릭터/몬스터의 역할(탱커, 딜러, 힐러 등)과 차별화 포인트가 명확한가
- 기본 스탯, 성장 계수, 스킬 데이터가 테이블로 정리되어 있는가
- AI 행동 패턴(공격, 회피, 패턴 변화 조건)이 구체적으로 설계되었는가
- 시각적 디자인 컨셉과 게임플레이 역할의 연결이 설명되었는가
- 다른 캐릭터/몬스터와의 시너지나 상성이 고려되었는가`,

    ui_ux: `- 화면별 와이어프레임이나 목업이 포함되어 있는가
- 사용자 흐름(User Flow)이 다이어그램으로 시각화되었는가
- 터치/클릭 영역, 버튼 크기, 접근성이 고려되었는가
- 정보 계층 구조(어떤 정보가 먼저 보이는지)가 명확한가
- 레퍼런스 UI를 분석하고 개선점을 도출했는가`,

    reverse_engineer: `- 분석 대상 게임의 선택 이유와 분석 목적이 명확한가
- 핵심 시스템의 구조를 플로우차트나 다이어그램으로 역분석했는가
- 수치 데이터(확률, 보상량, 성장 곡선 등)를 실제 플레이를 통해 추출/추정했는가
- 해당 시스템의 장단점을 객관적으로 분석했는가
- 분석 결과를 바탕으로 자신만의 개선안이나 인사이트를 도출했는가`,

    data_table: `- 데이터 테이블의 구조(컬럼, 관계)가 명확하게 정의되었는가
- 테이블 간 참조 관계(외래키, 조인 조건)가 다이어그램으로 표현되었는가
- 실제 예시 데이터가 충분히 포함되어 있는가 (빈 테이블이 아닌지)
- 수치의 근거(공식, 기준값, 밸런스 의도)가 설명되었는가
- 확장성(신규 콘텐츠 추가 시 테이블 구조 변경 불필요)이 고려되었는가`,

    content_design: `- 콘텐츠의 목적(플레이어 경험, 보상, 스토리 전달)이 명확한가
- 퀘스트/이벤트 흐름이 플로우차트로 시각화되었는가
- 보상 테이블과 난이도 조건이 구체적으로 설계되었는가
- 반복 플레이 동기(일일/주간 퀘스트 등)가 고려되었는가
- 스토리/내러티브가 있는 경우 게임플레이와의 연결이 설계되었는가`,

    game_proposal: `- 게임의 핵심 재미(Core Fun)와 타겟 유저가 명확하게 정의되었는가
- 경쟁 타이틀 분석과 차별화 포인트가 제시되었는가
- 핵심 게임 루프와 주요 시스템이 개괄적으로 설계되었는가
- 비즈니스 모델(BM)이 포함되어 있는가
- 개발 범위와 우선순위(MVP)가 정리되어 있는가`,
  }
  return criteria[categoryKey] || ""
}
