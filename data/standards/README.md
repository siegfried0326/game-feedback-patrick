# 합격 포트폴리오 기준 카드 (data/standards)

> 2026-10-06 시작. 합격 문서에서 "약점"이 아니라 **"기준"**을 뽑아 사용자 분석의 비교 재료로 쓴다.
> 배경: `docs/TASK_서비스개선_2026-10.md`, `docs/AUDIT_학습DB_정제_2026-10-06.md` 0장.

## 왜
- 기존 비교 재료는 Gemini가 합격 문서마다 써 둔 요약·강점·**약점**이었다. 합격한 문서의 "약점"은 대개 그 직군에 필요 없는 항목이라, 모델이 그걸 배워 사용자에게 엉뚱한 지적을 했다.
- 원문 텍스트(`portfolios.content_text`)는 187건 전부 비어 있었다. Storage 사본도 지워졌지만 **원본은 `~/Dropbox/GC_수업자료/<수강생>/`에 전부 있다** (187/187 매칭).

## 설계 원칙 (2026-10-06 Patrick 확정)
- 사용자 문서 분석은 **이 카드 DB와의 비교**로 답한다: 직군 판별 → 직군 기준서 대조표 → 가장 비슷한 합격 카드 3~5건과 비교 → 잘된 점/격차/점수/다음 할 일
- 합격 문서의 **약점은 뽑지 않는다.** 기준(있는 것, 왜 합격 수준인가)만 뽑는다
- **회사별 특징은 마케팅 요소다.** 그럴듯하고 틀리지 않게 한 문단으로만 — 핵심 피드백에 섞지 않는다
- **사용자에게 나가는 답에 특정 포트폴리오를 거론하지 않는다.** 파일명·게임명·작성자명·회사+번호 모두 금지. 합격작은 `anon_label`(구조 설명)로만 가리킨다 — 예: "선형 거점 전투 구조의 2D 탐험 레벨 창작 기획서", "PvP 쟁탈맵 리메이크 합격작". 카드의 `file_name`·`student`·`gameTitle`은 내부용이며 프롬프트에 넣지 않는다
- 목표 출력 예시: `EXAMPLE_feedback_태엽장난감폐공장.md`

## 작업 흐름
1. 원본 → `~/Dev-local/portfolios-source/<portfolio_id>.<ext>` 복사 (`mapping.json`에 DB id ↔ Dropbox 경로)
2. `extract.mjs`로 텍스트 추출 → `text/<id>.txt` (로컬 Node, API 비용 0)
3. Claude Code 세션에서 텍스트(필요하면 PDF 페이지)를 읽고 **문서당 기준 카드 1개**를 `cards/<id>.json`에 작성 — 약점은 적지 않는다
4. 직군별로 카드를 집계해 `domain-standards.json` 생성 (합격작의 몇 %가 어떤 요소를 갖췄는지)
5. `scripts/021_*.sql`로 `portfolios.content_text`, `design_domain`, `standard_card` 반영 → 재임베딩
6. `lib/analysis/reference.ts`가 Gemini 요약 대신 카드·기준서·원문 발췌를 프롬프트에 넣도록 교체

## 카드 스키마 (`cards/<id>.json`)

```jsonc
{
  "id": "portfolios.id (uuid)",
  "file_name": "DB file_name",
  "domain": "level | combat | system | economy | uiux | narrative | data | general",
  "secondary": ["combat"],
  "docForm": "reverse | original | proposal | analysis | table | pr",
  "gameTitle": "분석/창작 대상 게임 (없으면 null) — 내부용, 프롬프트 미주입",
  "anon_label": "사용자 출력용 익명 설명 — 게임명·고유명 없이 구조만. 예: '선형 거점 전투 구조의 2D 탐험 레벨 창작 기획서(76p)'",
  "pages": 32,

  // 문서가 어떤 순서로 무엇을 다루는지 (섹션 제목 수준, 실제 순서대로)
  "structure": ["문서 개요·기획 의도", "레퍼런스 분석(3개)", "전체 지도·구역 분할", "구역별 설계", "테스트 리스트"],

  // 포함된 산출물 — 있는 것만. 표준 어휘를 쓴다 (아래 목록)
  "artifacts": ["flowchart", "data_table", "floor_plan", "prototype_video", "reference_comparison"],

  // 깊이 지표 — 세어서 적는다 (없으면 0)
  "depth": {
    "numeric_tables": 4,        // 수치가 들어간 표 개수
    "diagrams": 6,              // 플로우차트·구조도·평면도 등 도식 개수
    "references_analyzed": 3,   // 레퍼런스 게임/사례 수
    "intent_to_decision": "strong | partial | weak"  // 기획 의도가 설계 결정으로 이어지는 정도
  },

  // 이 문서가 합격 수준인 이유 — 긍정 서술만, 3~6개, 문서에서 실제 확인한 내용
  "why_it_works": [
    "구역마다 '학습 목표 → 배치 → 예상 플레이' 순으로 설계 근거를 일관되게 제시",
    "언리얼 가레벨 영상으로 동선 설계를 실제 플레이로 검증"
  ],

  // 이 직군 다른 문서에서도 기대할 만한 요소 (기준서 집계용 키워드, 표준 어휘)
  "standard_elements": ["section_intent", "pacing_curve", "landmark_guidance", "placement_table", "playtest_plan"],

  // 비교 발췌로 쓸 만한 원문 위치 (페이지 번호). 모델에 보여줄 핵심 부분
  "excerpt_pages": [3, 7, 12],

  "notes": "읽는 사람 메모 (선택)"
}
```

### artifacts 표준 어휘
`flowchart` 플로우차트 · `state_machine` FSM/상태도 · `data_table` 데이터 테이블 · `numeric_table` 수치표(밸런스·스탯) · `floor_plan` 평면도/맵 구조도 · `route_map` 동선도 · `wireframe` UI 와이어프레임/목업 · `screenshot_analysis` 실제 화면 캡처 분석 · `reference_comparison` 레퍼런스 비교 · `prototype_video` 프로토타입/시연 영상 · `storyboard` 스토리보드/연출 · `erd` ERD/테이블 관계도 · `formula` 계산식 · `persona` 페르소나/타겟 분석 · `test_list` 테스트/QA 리스트 · `schedule` 일정/산출물 계획 · `concept_art` 컨셉 아트/레퍼런스 이미지

### standard_elements 표준 어휘 (직군 공통 + 직군별)
공통: `problem_definition` 문제 정의 · `intent_statement` 기획 의도 · `reference_to_decision` 레퍼런스 → 설계 결정 · `expected_effect` 기대 효과 · `scope_limits` 범위·제한
레벨: `section_intent` 구역별 의도 · `pacing_curve` 페이싱/난이도 곡선 · `landmark_guidance` 랜드마크·유도 · `placement_table` 배치표 · `playtest_plan` 플레이테스트 계획 · `spatial_metrics` 규격(엄폐·점프 거리 등)
전투/AI: `pattern_telegraph` 패턴 예고·대응 · `ai_states` AI 상태 설계 · `stat_table` 스탯·수치표 · `phase_design` 페이즈 · `player_kit_interaction` 플레이어 킷과 상호작용
시스템: `rule_spec` 규칙·예외 정의 · `state_transition` 상태 전이 · `system_links` 타 시스템 연결 · `data_schema` 데이터 구조 · `ui_flow` UI 흐름
경제/BM: `sink_source` 획득·소비·소멸 · `inflation_control` 인플레 제어 · `growth_curve` 성장 곡선 · `pricing_logic` 가격·보상 논리 · `simulation` 시뮬레이션/기대값
UI/UX: `ia_structure` 정보 구조 · `user_flow` 사용자 흐름 · `component_spec` 컴포넌트 명세 · `before_after` 개선 전후 비교 · `ux_principle` UX 원칙
서사: `world_consistency` 세계관 일관성 · `character_arc` 캐릭터 역할·성장 · `branching` 분기 구조 · `narrative_to_system` 서사 → 시스템 연결
데이터: `column_definition` 컬럼 정의 · `referential_integrity` 참조 관계 · `enum_usage` Enum 활용 · `sample_rows` 예시 데이터 · `designer_tunable` 조정 가능 파라미터
종합: `core_loop` 코어 루프 · `market_target` 시장·타겟 · `system_map` 시스템 구조도 · `dev_plan` 개발 계획

## 로컬 작업 폴더 구성 (`~/Dev-local/portfolios-source/`)
| 파일 | 내용 |
|---|---|
| `mapping.json` | DB id ↔ Dropbox 원본 경로 |
| `index.json` / `index.csv` | 187건 색인: 회사명(companies), 수강생, 직군 추정, 점수, 페이지 수, 글자 수, 이미지 위주 여부 |
| `text/<id>.txt` | 추출 텍스트 (페이지 구분자 포함). 총 243만 자, 이미지 위주 22건 |
| `pages/<id>/p-NN.png` | 페이지 렌더링(50dpi, 최대 60p) — 레이아웃·도식 확인용 |
| `extract.mjs`, `extract-report.json` | 추출 스크립트와 결과 |

## 진행 현황
- [x] 원본 187건 확보 (Dropbox → `~/Dev-local/portfolios-source`)
- [x] 텍스트 추출 187/187 · 페이지 이미지 렌더링 PDF 156건 → PNG 3,854장 (2026-10-06)
- [x] DB 재구축 코드 (2026-10-06): `scripts/021_add_standard_cards.sql` + `scripts/seed-standards.mjs` (원문 187건 개인정보 제거 후 content_text, 카드 → standard_card/anon_label/design_domain, 사본 → duplicate_of). `lib/analysis/reference.ts`가 카드·기준표를 비교 재료로 사용, Gemini 약점·요약은 미사용
- [x] DB 반영 (2026-10-06): 021 SQL 적용 → `seed-standards.mjs --apply` 187/187 (원문 234만 자, 이름 30명·이메일·전화번호 제거 후 잔존 0) → `embed-portfolios.mjs`로 원문 기준 재임베딩 184건/청크 1,485개($0.04). Gemini 요약 기반 옛 청크는 전부 교체됨
- 카드 추가 후 갱신: `node --env-file=.env.local scripts/seed-standards.mjs --apply` (임베딩은 원문이 바뀔 때만 다시)
- [x] 카드 작성 158/158 + 사본 29건 연결 (2026-10-07) — system 45 · combat 33 · data 22 · level 22 · general 17 · uiux 16 · narrative 3
- [x] 카드 검사 `scripts/validate-cards.mjs` 문제 0건 · 금지어 `banned-terms.json` (출력 차단 `lib/analysis/anonymize.ts`와 공유)
- [x] DB 반영 187/187 + 사본 제외 재임베딩 (청크 1,267개)
- [x] reference.ts 교체 + 점수 보정(깊이 지표 사분위)
- [ ] 직군별 기준서 (서사 카드 3건뿐 — 표본 보강 필요)
