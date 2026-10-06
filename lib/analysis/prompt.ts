/**
 * 분석 시스템 프롬프트 빌더 (서버 전용, 순수 함수)
 *
 * 프롬프트는 4개 블록으로 나뉘며 "안정적인 것 → 요청마다 바뀌는 것" 순서로 배치한다.
 * 앞의 3개 블록에 cache_control을 걸어 Anthropic 프롬프트 캐시를 적중시킨다.
 *
 *   1. CORE      — 역할, 절대 규칙, 15개 카테고리 정의, 점수 규칙, 응답 JSON 형식 (모드별로 고정)
 *   2. BENCHMARK — 회사별 벤치마크 (파일 기반, 고정)
 *   3. DOMAIN    — 직군별 채점표 + 금지 목록 + 같은 직군 합격 사례 (직군별로 고정)
 *   4. VOLATILE  — 사용자 키워드, 벡터 검색 발췌, 라이브러리 인용 (요청마다 다름, 캐시 안 함)
 *
 * 기존 analyze.ts의 두 함수(analyzeDocumentDirect / analyzeUrlDirect)에 중복돼 있던 프롬프트를 하나로 합쳤다.
 */

import {
  CATEGORY_SUBJECTS,
  DOMAIN_RUBRIC,
  DOMAIN_FOCUS,
  DOMAIN_DO_NOT_ASK,
  UNIVERSAL_DO_NOT_ASK,
  DOMAIN_LABELS,
  DOC_FORM_LABELS,
  type DesignDomain,
  type DocForm,
} from "./domains"
import type { ReferenceSet } from "./reference"

/** pdf: 원본 문서를 모델이 직접 봄 / text: 추출 텍스트 / url: 웹페이지 텍스트 */
export type AnalysisMode = "pdf" | "text" | "url"

export interface PromptBlock {
  type: "text"
  text: string
  cache_control?: { type: "ephemeral" }
}

export interface PromptInput {
  domain: DesignDomain
  secondary: DesignDomain[]
  docForm: DocForm
  mode: AnalysisMode
  reference: ReferenceSet
  benchmarkSection: string
  vectorSection: string
  librarySection: string
  keywords: string[]
}

const CATEGORY_DEFINITIONS: Record<(typeof CATEGORY_SUBJECTS)[number], string> = {
  논리력: "문제 정의 → 가설 → 해결 → 결과의 논리적 흐름. 논리 비약이 있으면 감점.",
  구체성: "주장을 뒷받침하는 수치·데이터·사례. '좋다', '많다' 같은 모호한 표현은 감점.",
  가독성: "문서 구조, 시각적 정리, 다이어그램·표 활용도. 텍스트만 나열하면 감점.",
  기술이해: "게임 개발 기술·용어·파이프라인에 대한 이해도. 표면적이면 감점.",
  창의성: "독창적인 아이디어, 차별화 요소. 일반적인 내용만 있으면 감점.",
  핵심반복구조: "플레이어가 가장 자주 반복하는 행동 흐름이 정의되어 있는가. 행동 → 결과 → 피드백이 구체적인가.",
  콘텐츠분류: "다루는 요소들이 겹치지 않고 빠짐없이 분류되어 있는가. 큰 분류에서 작은 분류로 내려가는 체계가 있는가.",
  재화흐름: "자원·재화의 획득·소비·소멸 경로가 설계되어 있는가. 무한 축적을 막는 장치가 있는가.",
  플레이경험: "플레이어가 느꼈으면 하는 경험(도전, 탐험, 몰입 등)이 명확하고, 그 경험을 만드는 규칙·구조와 연결되는가.",
  수치데이터: "이 문서의 주제에 해당하는 수치가 표로 정리되어 있는가. 예시 데이터와 표 간 연결 설명이 있는가.",
  기능연결: "핵심 기능과 부가 기능이 어떤 순서로 연결·확장되는지 도표로 표현되었는가.",
  동기부여: "계속하고 싶게 만드는 단기·중기·장기 목표가 단계별로 설계되어 있는가.",
  난이도균형: "너무 쉽지도 어렵지도 않게 조절하는 설계가 있는가. 초반→후반 난이도 변화가 고려되었는가.",
  화면조작: "화면 구성·조작 방식의 밑그림이 있는가. 조작 규칙이 일관적인가.",
  개발일정: "개발 단계 계획과 실무 산출물(기능 목록, 테스트 항목, 수치 조정표)이 포함되었는가.",
}

const APPLICABILITY_LABEL = { core: "핵심", related: "관련", na: "해당 없음" } as const

// ───────────────────────────────────────────
// 블록 1: CORE (모드별 고정)
// ───────────────────────────────────────────

function coreBlock(mode: AnalysisMode): string {
  const modeRule =
    mode === "pdf"
      ? "이 문서는 원본 그대로 전달되었습니다. 레이아웃·표·도식·이미지를 직접 보고 평가하세요. readabilityCategories(10개)와 layoutRecommendations(3개)를 반드시 포함하세요."
      : mode === "text"
        ? "이 문서는 텍스트만 추출된 상태입니다. 시각적 요소(이미지, 레이아웃)는 평가할 수 없으므로 readabilityCategories와 layoutRecommendations는 출력하지 마세요. '가독성' 카테고리는 텍스트 구조(제목·단락·목록 체계)만 기준으로 평가하세요."
        : "이 문서는 웹 페이지에서 추출된 텍스트입니다. 시각적 요소는 평가할 수 없으므로 readabilityCategories와 layoutRecommendations는 출력하지 마세요."

  const categoryList = CATEGORY_SUBJECTS.map((s, i) => `${i + 1}. **${s}**: ${CATEGORY_DEFINITIONS[s]}`).join("\n")

  const readabilityAndLayout = mode === "pdf" ? `
### 문서 가독성 평가 (10개) — 원본 문서 전용
벤치마크의 '문서 가독성 — 회사별 합격자 특징'을 참고하여 각 항목을 평가하세요.
16. **글자크기구분**: 제목·소제목·본문 크기가 확실히 구분되는가.
17. **문단나누기**: 적절한 길이로 문단이 나뉘고 관련 내용끼리 묶여 있는가.
18. **여백활용**: 요소 사이 여백이 충분한가, 페이지가 빽빽하지 않은가.
19. **색상활용**: 색으로 중요한 부분을 구분·강조했는가, 대비가 충분한가.
20. **표와그림배치**: 표·차트·이미지가 관련 내용 근처에 적절한 크기로 있는가.
21. **페이지구성**: 페이지마다 요소 배치가 일관적인가.
22. **읽는순서**: 시선 흐름이 자연스러운가.
23. **강조표현**: 굵게·색상·박스 등 강조가 일관적인가.
24. **목차와번호**: 목차·페이지 번호·섹션 번호가 있는가.
25. **전체통일감**: 글꼴·색상·간격이 문서 전체에서 일관적인가.

### 레이아웃 개선 제안 (3곳)
가장 개선이 필요한 페이지/섹션 3곳을 골라 현재 상태와 개선 방향을 설명하고, 현재/개선 레이아웃을 좌표로 표현하세요.
좌표 규칙: x·y·w·h는 모두 % 단위. 섹션끼리 겹치지 않게, x+w ≤ 100, y+h ≤ 100, 섹션 사이 최소 2% 간격, 섹션 2~5개.
색상 팔레트: 제목=#5B8DEF, 본문=#64748b, 표/데이터=#22c55e, 이미지=#f59e0b, 요약/강조=#a855f7, 여백=#1e293b
` : ""

  const schemaExtra = mode === "pdf" ? `,
  "readabilityCategories": [
    { "subject": "글자크기구분", "value": 67, "fullMark": 100, "feedback": "벤치마크 대비 구체적 피드백" },
    { "subject": "문단나누기", "value": 65, "fullMark": 100, "feedback": "..." },
    { "subject": "여백활용", "value": 55, "fullMark": 100, "feedback": "..." },
    { "subject": "색상활용", "value": 72, "fullMark": 100, "feedback": "..." },
    { "subject": "표와그림배치", "value": 60, "fullMark": 100, "feedback": "..." },
    { "subject": "페이지구성", "value": 68, "fullMark": 100, "feedback": "..." },
    { "subject": "읽는순서", "value": 71, "fullMark": 100, "feedback": "..." },
    { "subject": "강조표현", "value": 50, "fullMark": 100, "feedback": "..." },
    { "subject": "목차와번호", "value": 40, "fullMark": 100, "feedback": "..." },
    { "subject": "전체통일감", "value": 62, "fullMark": 100, "feedback": "..." }
  ],
  "layoutRecommendations": [
    {
      "pageOrSection": "3페이지 - 시스템 설계",
      "currentDescription": "현재 상태 2~3문장",
      "recommendedDescription": "개선 후 모습 2~3문장",
      "currentLayout": { "sections": [{ "label": "제목", "x": 5, "y": 2, "w": 90, "h": 6, "color": "#5B8DEF" }, { "label": "본문", "x": 5, "y": 10, "w": 90, "h": 85, "color": "#64748b" }] },
      "recommendedLayout": { "sections": [{ "label": "제목", "x": 5, "y": 3, "w": 90, "h": 8, "color": "#5B8DEF" }, { "label": "본문", "x": 5, "y": 14, "w": 42, "h": 50, "color": "#64748b" }, { "label": "표", "x": 52, "y": 14, "w": 43, "h": 50, "color": "#22c55e" }] }
    }
  ]` : ""

  return `당신은 게임 업계 11년차 현업 기획자이자 채용 담당자입니다.
실제 합격 포트폴리오를 학습했으며, 그 패턴을 기준으로 지원자의 문서를 **같은 직군의 합격자 수준과 비교해** 평가합니다.

${modeRule}

## 🚨 절대 규칙
1. **문서에 실제로 있는 내용만 언급하세요.** 없는 내용을 있다고 하면 안 됩니다.
2. **거짓 칭찬 금지.** 비교연구가 없으면 "비교연구가 우수하다"고 하지 마세요. 없는 것은 보완점에 넣으세요.
3. **강점과 보완점이 모순되면 안 됩니다.** 하나의 주제는 강점 또는 보완점 중 하나에만 넣고, 부분적으로 잘 된 경우엔 어떤 부분이 잘 되고 어떤 부분이 부족한지 나눠 쓰세요.
4. **특정 합격 포트폴리오를 거론하지 마세요.** "합격 사례 N번", 파일명, 게임 제목, 작성자 이름, "~사례처럼" 표현 모두 금지. 사용자는 학습 데이터를 볼 수 없습니다. 합격작은 "선형 거점 구조의 합격 레벨 문서는 ~" 처럼 **구조로만** 가리키거나, "합격자들은 ~한 특징이 있습니다"처럼 집단으로 서술하세요.
5. **점수에 후하게 주지 마세요.** 대부분의 지원자 문서는 50~75점대입니다.
6. 강점·보완점은 **문서에서 실제로 확인된 구체적 내용**을 근거로 쓰세요.
7. **강점 6개, 보완점 6개**를 서로 다른 관점으로 쓰세요.
8. **문서 직군 밖의 것을 요구하지 마세요.** 아래 '직군별 채점표'에서 '해당 없음'인 항목은 점수를 매기지 말고(value: null, applicable: false), 보완점에도 넣지 마세요. '요구하면 안 되는 것' 목록의 내용은 어떤 형태로도 지적하지 마세요.
9. **취준생이 할 수 없는 것을 요구하지 마세요.** 실제 플레이 테스트·A/B 테스트 결과, 엔진 구현 가능성 검토, 개발 비용 산정, 라이브 KPI 예측은 보완점이 될 수 없습니다.
10. **비교는 같은 직군 합격 문서 기준으로.** 강점·보완점마다 "같은 직군 합격작은 ~하는데, 이 문서는 ~"처럼 아래 비교 기준(기준 카드)과 연결하세요. 기준 카드에 없는 요소를 지어내지 마세요.
11. **회사별 피드백은 보조 정보입니다.** 짧고 그럴듯하게만 쓰고, 핵심 판단은 strengths·weaknesses·standardsCheck에 두세요.

## 📋 평가 방법
같은 직군 합격 사례들의 공통 패턴과 비교하여 평가하세요:
1. **문서 구조**: 합격 문서들은 개요→분석→설계→검증의 체계적 구조를 가짐. 현재 문서는?
2. **수치/데이터**: 합격 문서들은 주제에 맞는 구체적 수치·표가 있음. 현재 문서는?
3. **시각 자료**: 합격 문서들은 다이어그램·플로우차트·표를 적극 활용함. 현재 문서는?
4. **비교 분석**: 합격 문서들은 레퍼런스 분석이 설계 결정으로 이어짐. 현재 문서는?
5. **직군 깊이**: 아래 '이 직군에서 특히 볼 것'을 기준으로 전문성의 깊이가 합격 수준인지?

## 평가 항목 (각 0~100점)
### 기본 역량 (5개) — 모든 직군 공통
${categoryList.split("\n").slice(0, 5).join("\n")}

### 게임 디자인 역량 (10개) — 직군에 따라 핵심/관련/해당 없음이 달라짐
${categoryList.split("\n").slice(5).join("\n")}

## 점수 기준 — 합격자 = 100점 절대 기준
### 구간별 의미
- 95-100: 합격자 사례와 동급 또는 우수 (드물게 부여)
- 85-94: 합격자에 매우 가까움, 일부 보완만 필요
- 70-84: 합격자 수준에 미흡, 다수 보완 필요 (개선 시 합격 가능)
- 50-69: 핵심 요소 다수 누락 — **가장 흔한 일반 사용자 점수대**
- 30-49: 기획서로서 미완성
- 0-29: 빈약하거나 주제 불일치

### 점수 차별화 규칙
1. 적용 가능한 카테고리의 value를 모두 다른 값으로 매기세요. 같은 점수가 3개 이상이면 안 됩니다.
2. 70점대 후반(75~79)으로 수렴하지 마세요. 잘 된 항목은 80점대로, 부족한 항목은 60점대 이하로.
3. 흔한 정수(70, 75, 78, 80)를 피하고 53, 67, 73, 84, 91 같은 다양한 숫자를 쓰세요.
4. 전체 score는 **적용 가능한 카테고리**(원본 문서 모드에서는 가독성 10개 포함)의 가중평균을 기준으로 하되, 단순 평균 ±2점 안에 머물지 마세요. 핵심(core) 항목에 더 큰 가중을 두세요.
5. 합격자 평균은 합격자 표본의 평균일 뿐 사용자 문서의 기본 점수가 아닙니다. 사용자 문서는 30점도 95점도 가능합니다.

### feedback 작성 규칙 (적용 가능한 카테고리)
각 항목의 feedback은 3줄 이상, [강점]과 [보완]을 구분해 쓰세요.
- [강점]으로 시작하는 줄: 이 문서에서 해당 항목이 잘 된 부분
- [보완]으로 시작하는 줄: 합격자들과 비교해 부족한 부분과 구체적 개선 방향. "합격자들은 ~하지만, 이 문서는 ~합니다"로 서술
- 해당 항목이 전혀 없으면 [보완]만 작성하되, 합격자들은 어떻게 하는지 설명
- '해당 없음' 항목은 value를 null로 두고 feedback에 한 줄만: "이 문서 유형에서는 평가하지 않는 항목입니다."
${readabilityAndLayout}
## 응답 형식 (반드시 JSON만 출력, 다른 텍스트 없이)
{
  "score": 63,
  "domainFit": "이 문서가 어떤 직군 문서로 읽히는지, 직군 기준에서 전반적 수준을 한두 문장으로",
  "categories": [
    { "subject": "논리력", "value": 75, "fullMark": 100, "applicable": true, "feedback": "[강점] ...\\n[보완] ... 3줄 이상" },
    { "subject": "구체성", "value": 65, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "가독성", "value": 64, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "기술이해", "value": 67, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "창의성", "value": 68, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "핵심반복구조", "value": 60, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "콘텐츠분류", "value": 55, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "재화흐름", "value": null, "fullMark": 100, "applicable": false, "feedback": "이 문서 유형에서는 평가하지 않는 항목입니다." },
    { "subject": "플레이경험", "value": 65, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "수치데이터", "value": 30, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "기능연결", "value": 50, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "동기부여", "value": 45, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "난이도균형", "value": 35, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "화면조작", "value": 55, "fullMark": 100, "applicable": true, "feedback": "..." },
    { "subject": "개발일정", "value": 40, "fullMark": 100, "applicable": true, "feedback": "..." }
  ],
  "standardsCheck": [
    { "element": "구간별 기획 의도", "status": "없음", "note": "평면도에 거점 번호만 있고 거점별 의도·배치가 없음" },
    { "element": "동선·루트도", "status": "부분", "note": "전체 흐름 화살표는 있으나 거점 내부 동선 없음" },
    { "element": "기획 의도", "status": "있음", "note": "목표–의도–설계 방향 3열 표" }
  ],
  "strengths": ["강점1 — 문서에서 확인한 내용 + 같은 직군 합격작과 비교해 왜 좋은지", "...", "강점6"],
  "weaknesses": ["보완점1 — 같은 직군 합격작은 무엇을 갖췄고 이 문서엔 무엇이 없는지 + 어떻게 채울지", "...", "보완점6"],
  "nextSteps": ["가장 먼저 할 일", "두 번째", "세 번째"],
  "companyFeedback": "**넥슨**, **엔씨소프트**, **넷마블**, **크래프톤**, **스마일게이트**, **펄어비스**, **네오위즈**, **웹젠** 8개 회사, 회사마다 1~2문장. 형식: **회사명** 합격 문서들은 ~한 경향이 있어, 이 문서의 ~가 ~하게 읽힐 것입니다. 회사마다 줄바꿈(\\n\\n). 벤치마크를 바탕으로 그럴듯하게 쓰되 단정하지 말고, 핵심 피드백(strengths/weaknesses)과 다른 새로운 지적을 여기서 만들지 마세요."${schemaExtra}
}

**핵심**: 문서를 꼼꼼히 읽고, 실제로 있는 내용만 강점으로, 실제로 없거나 부족한 내용은 보완점으로 쓰세요. 빈말 칭찬은 사용자에게 해롭습니다. 위 '직군별 채점표'의 applicable 값을 그대로 따르세요.`
}

// ───────────────────────────────────────────
// 블록 3: DOMAIN (직군별 고정)
// ───────────────────────────────────────────

function domainBlock(input: PromptInput): string {
  const { domain, secondary, docForm, reference } = input
  const rubric = DOMAIN_RUBRIC[domain]
  const rubricTable = CATEGORY_SUBJECTS.map(s => `| ${s} | ${APPLICABILITY_LABEL[rubric[s]]} |`).join("\n")
  const naList = CATEGORY_SUBJECTS.filter(s => rubric[s] === "na")
  const secondaryText = secondary.length ? ` (부차적으로 ${secondary.map(d => DOMAIN_LABELS[d]).join(", ")})` : ""

  return `## 🧭 이 문서의 직군: **${DOMAIN_LABELS[domain]}**${secondaryText} · 형식: ${DOC_FORM_LABELS[docForm]}

### 직군별 채점표
| 카테고리 | 적용 |
|---|---|
${rubricTable}

- **핵심**: 이 직군 합격자라면 반드시 갖춰야 할 항목. 점수 비중을 높게.
- **관련**: 문서에 있으면 평가하고, 없으면 짧게 언급만. 큰 감점 금지.
- **해당 없음**: ${naList.length ? naList.join(", ") : "(없음)"} → value: null, applicable: false. 보완점·companyFeedback 어디에도 요구하지 말 것.

### 이 직군에서 특히 볼 것
${DOMAIN_FOCUS[domain].map(f => `- ${f}`).join("\n")}

### 이 직군 문서에 요구하면 안 되는 것
${DOMAIN_DO_NOT_ASK[domain].map(f => `- ${f}`).join("\n")}
${UNIVERSAL_DO_NOT_ASK.map(f => `- ${f}`).join("\n")}

---

${reference.section}`
}

// ───────────────────────────────────────────
// 블록 4: VOLATILE (요청마다 다름)
// ───────────────────────────────────────────

function volatileBlock(input: PromptInput): string {
  const parts: string[] = []
  if (input.keywords.length > 0) {
    parts.push(`## 📌 사용자 확정 키워드: ${input.keywords.join(", ")}
사용자가 문서의 주제라고 확인한 키워드입니다. 이 주제에 맞게 평가하세요.`)
  }
  if (input.vectorSection) parts.push(input.vectorSection)
  if (input.librarySection) parts.push(input.librarySection)
  return parts.join("\n\n---\n\n")
}

/**
 * 시스템 프롬프트 블록 배열. 앞 3개는 cache_control 적용.
 * Anthropic SDK의 TextBlockParam / BetaTextBlockParam 양쪽에 그대로 넘길 수 있는 구조다.
 */
export function buildSystemBlocks(input: PromptInput): PromptBlock[] {
  const blocks: PromptBlock[] = [
    { type: "text", text: coreBlock(input.mode), cache_control: { type: "ephemeral" } },
  ]
  if (input.benchmarkSection) {
    blocks.push({ type: "text", text: input.benchmarkSection, cache_control: { type: "ephemeral" } })
  }
  blocks.push({ type: "text", text: domainBlock(input), cache_control: { type: "ephemeral" } })
  const volatile = volatileBlock(input)
  if (volatile) blocks.push({ type: "text", text: volatile })
  return blocks
}

/** user 메시지의 지시문 (문서/텍스트 뒤에 붙는다) */
export function buildUserInstruction(mode: AnalysisMode, fileName: string, sizeLabel?: string): string {
  const base = mode === "pdf"
    ? `위 문서("${fileName}"${sizeLabel ? `, ${sizeLabel}` : ""})를 분석해주세요.`
    : mode === "text"
      ? `아래는 "${fileName}" 문서에서 추출한 텍스트입니다. 원본의 시각 요소 없이 텍스트만으로 분석합니다.`
      : `아래는 웹 페이지(${fileName})에서 추출한 텍스트입니다.`
  return `${base} 시스템 프롬프트의 직군별 채점표·평가 기준·합격 사례를 참고하여 JSON 형식으로만 응답하세요. 반드시 15개 categories(해당 없음은 value null), strengths 6개, weaknesses 6개, companyFeedback을 포함해야 합니다.`
}
