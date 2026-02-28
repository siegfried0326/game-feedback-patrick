# PRD: 마이페이지 (프로젝트/분석 관리)

## 1. 개요

| 항목 | 내용 |
|------|------|
| 라우트 | `/mypage` |
| 파일 | `app/mypage/page.tsx` (~987줄) |
| 접근 제한 | 로그인 필수 (미들웨어에서 보호) |
| 마지막 갱신 | 2026-02-27 |

로그인한 사용자의 프로젝트 관리, 분석 이력 조회, 구독 상태 확인, 버전 비교를 제공하는 페이지.

## 2. 기능 목록

| 번호 | 기능 | 설명 |
|------|------|------|
| 1 | 프로젝트 목록 | 사용자의 프로젝트 카드 표시 (분석 수, 최고점, 최근 점수) |
| 2 | 프로젝트 생성 | 이름 입력 → DB 삽입 (무료: 1개, 유료: 무제한) |
| 3 | 프로젝트 삭제 | 하위 분석 먼저 삭제 → 프로젝트 삭제 |
| 4 | 프로젝트 이름변경 | inline 편집 |
| 5 | 분석 이력 조회 | 프로젝트 클릭 → 해당 프로젝트의 분석 목록 |
| 6 | 분석 상세 보기 | 분석 클릭 → 점수, 카테고리, 강점/보완점 상세 표시 |
| 7 | 분석 삭제 | 개별 분석 삭제 |
| 8 | 버전 비교 | 같은 프로젝트의 2개 분석 결과 비교 |
| 9 | 구독 상태 표시 | 현재 플랜, 만료일, 해지 버튼 |
| 10 | 새 분석 하러 가기 | `/analyze?projectId={id}` 링크 |

## 3. 프로젝트 관리

### 3.1 프로젝트 목록 조회 (`getProjects`)
- `projects` 테이블에서 user_id 기준 조회
- `analysis_history` 테이블에서 각 프로젝트의 통계 계산:
  - analysis_count: 분석 횟수
  - best_score: 최고 점수
  - latest_score: 최근 점수
  - latest_file_name: 최근 파일명
  - latest_analyzed_at: 최근 분석일

### 3.2 프로젝트 생성 (`createProject`)
```
1. checkProjectAllowance() → 생성 가능 여부 확인
2. 무료: 1개 제한, 유료(active): 무제한
3. projects 테이블에 INSERT
```

### 3.3 프로젝트 삭제 (`deleteProject`)
```
1. analysis_history에서 해당 프로젝트 분석 전부 DELETE
2. projects 테이블에서 DELETE
```

### 3.4 프로젝트 이름변경 (`renameProject`)
- 빈 이름 거부
- updated_at 갱신

## 4. 분석 이력

### 4.1 조회 (`getProjectAnalyses`)
- project_id + user_id 기준 조회
- analyzed_at 내림차순

### 4.2 상세 (`getAnalysisDetail`)
- id + user_id 기준 조회
- 전체 필드 반환 (categories JSON, strengths, weaknesses 등)

### 4.3 삭제 (`deleteAnalysis`)
- id + user_id 기준 DELETE

## 5. 버전 비교 (`components/version-comparison.tsx`)

같은 프로젝트의 2개 분석 결과를 선택하여 비교.

| 비교 항목 | 표시 방식 |
|-----------|-----------|
| 종합 점수 | 좌우 큰 숫자 + 차이 표시 |
| 카테고리별 점수 | 바 차트 (subject/value 기준) |
| 강점/보완점 | 좌우 리스트 |

## 6. 구독 상태

마이페이지에서 현재 구독 정보를 표시:
- 플랜명 (free/monthly/three_month/tutoring)
- 상태 (active/cancelled/expired)
- 만료일
- 해지 버튼 (유료 플랜만)

## 7. DB 테이블

### 7.1 projects

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 프로젝트 ID |
| user_id | UUID (FK) | 사용자 ID |
| name | text | 프로젝트 이름 |
| description | text | 설명 (선택) |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

### 7.2 analysis_history

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 분석 ID |
| user_id | UUID (FK) | 사용자 ID |
| project_id | UUID (FK) | 프로젝트 ID |
| file_name | text | 파일명 |
| overall_score | integer | 종합 점수 |
| categories | jsonb | 카테고리별 점수 배열 |
| strengths | text[] | 강점 배열 |
| weaknesses | text[] | 보완점 배열 |
| ranking | jsonb | 랭킹 데이터 |
| company_feedback | text | 회사별 피드백 |
| analysis_source | text | "pdf" 또는 "url" |
| readability_categories | jsonb | 가독성 10개 항목 |
| layout_recommendations | jsonb | 레이아웃 제안 |
| analyzed_at | timestamptz | 분석일 (auto) |

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/mypage/page.tsx` (~987줄) | 마이페이지 전체 UI |
| `app/actions/subscription.ts` | 프로젝트/분석 CRUD + 구독 관리 |
| `components/version-comparison.tsx` (~250줄) | 버전 비교 UI |

## 9. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 파일 크기 (987줄) | 프로젝트 목록, 분석 상세, 구독 관리가 한 파일 → 컴포넌트 분리 필요 |
| 스크롤 위치 미보존 | 분석 상세 → 뒤로가기 시 스크롤 초기화 |
| subscription.ts 혼재 | 구독 + 프로젝트 + 분석이력이 한 파일 |
