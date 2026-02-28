# PRD: 마이페이지 — 분석 이력/결과 보기

## 1. 개요

| 항목 | 내용 |
|------|------|
| 라우트 | `/mypage` (프로젝트 클릭 후 진입) |
| 파일 | `app/mypage/page.tsx` 내 분석 관련 부분 |
| 서버 | `app/actions/subscription.ts` → getProjectAnalyses, getAnalysisDetail, deleteAnalysis |
| 마지막 갱신 | 2026-02-28 |

프로젝트를 클릭하면 나오는 분석 이력 목록, 분석 결과 상세 보기, 버전 비교 기능.

---

## 2. 기능 목록

| 기능 | 설명 |
|------|------|
| 분석 이력 목록 | 프로젝트 내 분석된 기획서 목록 (점수, 날짜) |
| 분석 상세 보기 | 점수카드, 레이더 차트, 강점/약점, 게임디자인, 가독성, 레이아웃 |
| 분석 삭제 | 개별 분석 삭제 |
| 버전 비교 | 같은 프로젝트의 2개+ 분석을 꺾은선 그래프로 비교 |
| 새 분석 바로가기 | `/analyze?projectId={id}` 링크 |

---

## 3. 분석 이력 목록

### 3.1 조회 (`getProjectAnalyses`)
```
1. project_id + user_id 기준 조회
2. analyzed_at 내림차순 정렬
3. 반환 필드: id, file_name, overall_score, analyzed_at, categories,
   strengths, weaknesses
```

### 3.2 목록 표시
- 파일명 + 분석 날짜
- 종합 점수 (색상 구분: 80+ 초록, 60+ 노랑, 그 외 빨강)
- 등급 뱃지 (S/A/B/C/D)
- 호버 시 삭제 버튼
- 빈 상태: "아직 분석 기록이 없습니다" + "분석하러 가기" 버튼

### 3.3 등급 시스템
| 점수 | 등급 | 색상 |
|------|------|------|
| 90+ | S | 금색 (amber) |
| 80+ | A | 보라 (purple) |
| 70+ | B | 파랑 (blue) |
| 60+ | C | 초록 (green) |
| ~59 | D | 회색 (slate) |

---

## 4. 분석 상세 보기

### 4.1 조회 (`getAnalysisDetail`)
```
1. id + user_id 기준 조회
2. 전체 필드 반환 (categories JSON, strengths, weaknesses,
   readability_categories, layout_recommendations, ranking 등)
3. 캐시: detailData[id]에 저장 → 같은 분석 재클릭 시 API 호출 안 함
```

### 4.2 상세 화면 구성

| 순서 | 컴포넌트 | 표시 내용 |
|------|----------|-----------|
| 1 | ScoreCard | 종합 점수 + 등급 + 랭킹 (상위 N%, 총 N명) |
| 2 | RadarChartComponent | 기본 5개 카테고리 레이더 차트 |
| 3 | FeedbackCards | 강점/보완점 리스트 (좌우 배치) |
| 4 | DesignScores | 게임디자인 10개 항목 점수 + 피드백 (아코디언) |
| 5 | ReadabilityScores | 가독성 10개 항목 점수 + 피드백 (아코디언) |
| 6 | LayoutRecommendations | 레이아웃 개선 제안 (before → after) |
| 7 | 회사 피드백 | company_feedback 텍스트 (마크다운 렌더링) |

> 가독성(5), 레이아웃(6)은 PDF/이미지 업로드일 때만 표시.
> 텍스트 추출 모드(100MB+ PDF)에서는 비활성.

---

## 5. 분석 삭제 (`deleteAnalysis`)

```
1. 삭제 버튼 클릭 → 확인 다이얼로그
2. id + user_id 기준 DELETE
3. 목록에서 제거 + 상세 캐시 제거
```

---

## 6. 버전 비교 (`VersionComparison` 컴포넌트)

### 6.1 표시 조건
- 같은 프로젝트에 2개 이상 분석이 있을 때만 "비교" 버튼 활성화

### 6.2 비교 내용

| 비교 항목 | 표시 방식 |
|-----------|-----------|
| 종합 점수 추이 | 꺾은선 그래프 (LineChart) — 시간순 |
| 카테고리별 점수 | 카테고리마다 라인 (색상 구분) |
| 증감 표시 | 최근 vs 이전 → TrendingUp/Down 아이콘 + 차이 숫자 |

### 6.3 차트 상세
- X축: 분석 날짜
- Y축: 점수 (0~100)
- 데이터: categories 배열의 각 subject별 value
- 라이브러리: recharts (LineChart, ResponsiveContainer)

---

## 7. DB 테이블

### analysis_history

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 분석 ID |
| user_id | UUID (FK) | 사용자 ID |
| project_id | UUID (FK) | 프로젝트 ID |
| file_name | text | 파일명 |
| overall_score | integer | 종합 점수 (0~100) |
| categories | jsonb | 15개 카테고리 점수 배열 `[{subject, value, fullMark, feedback}]` |
| strengths | text[] | 강점 배열 |
| weaknesses | text[] | 보완점 배열 |
| ranking | jsonb | `{total, percentile, companyComparison[]}` |
| company_feedback | text | 8개 회사 맞춤 피드백 (마크다운) |
| analysis_source | text | "pdf" 또는 "url" |
| readability_categories | jsonb | 가독성 10개 항목 `[{subject, value, fullMark, feedback}]` |
| layout_recommendations | jsonb | 레이아웃 제안 배열 |
| analyzed_at | timestamptz | 분석일 (자동) |

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/mypage/page.tsx` | 분석 목록, 상세 보기, 삭제 UI |
| `app/actions/subscription.ts` | getProjectAnalyses, getAnalysisDetail, deleteAnalysis |
| `components/version-comparison.tsx` | 버전 비교 차트 |
| `components/score-card.tsx` | 종합 점수 카드 |
| `components/radar-chart-component.tsx` | 기본 5개 레이더 차트 |
| `components/feedback-cards.tsx` | 강점/보완점 카드 |
| `components/design-scores.tsx` | 게임디자인 10개 점수 |
| `components/readability-scores.tsx` | 가독성 10개 점수 |
| `components/layout-recommendations.tsx` | 레이아웃 개선 제안 |

---

## 9. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 스크롤 위치 미보존 | 상세 → 뒤로가기 시 스크롤 초기화 |
| 상세 데이터 캐시 | 메모리에만 저장 → 페이지 이동하면 리셋 |
| 회사 피드백 렌더링 | 마크다운인데 현재 일반 텍스트로 표시 |
| 버전 비교 한계 | 카테고리 이름이 다르면 비교 불가 (이전 분석이 15개 미만일 때) |
