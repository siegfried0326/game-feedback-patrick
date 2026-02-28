# PRD: 마이페이지 — 프로젝트 관리

## 1. 개요

| 항목 | 내용 |
|------|------|
| 라우트 | `/mypage` (프로젝트 목록이 기본 화면) |
| 파일 | `app/mypage/page.tsx` 내 프로젝트 관련 부분 |
| 서버 | `app/actions/subscription.ts` → getProjects, createProject, deleteProject, renameProject |
| 접근 제한 | 로그인 필수 |
| 마지막 갱신 | 2026-02-28 |

프로젝트 = 사용자가 기획서를 분류하는 단위. "넥슨 지원용", "넷마블 지원용" 같은 식으로 분류하고, 프로젝트 안에 여러 기획서를 분석해서 이력을 쌓는 구조.

---

## 2. 기능 목록

| 기능 | 설명 | 구독 제한 |
|------|------|-----------|
| 프로젝트 목록 | 카드 형태로 표시, 분석 수/최고점/최근 점수 포함 | - |
| 프로젝트 생성 | 이름 입력 → DB 삽입 | 무료: 1개, 유료: 무제한 |
| 프로젝트 삭제 | 하위 분석 먼저 삭제 → 프로젝트 삭제 | - |
| 프로젝트 이름변경 | 인라인 편집 (⋯ 메뉴) | - |
| 프로젝트 상세 진입 | 클릭 → 분석 이력 표시 (→ PRD_마이페이지_분석이력) | - |

---

## 3. 프로젝트 목록 화면

### 3.1 목록 조회 (`getProjects`)
```
1. user_id 기준으로 projects 테이블 조회
2. 각 프로젝트별 analysis_history 집계:
   - analysis_count: 분석 횟수
   - best_score: 최고 점수
   - latest_score: 최근 점수
   - latest_file_name: 최근 파일명
   - latest_analyzed_at: 최근 분석일
3. created_at 내림차순 정렬
```

### 3.2 카드 표시 정보
- 프로젝트 이름
- 분석 횟수 (예: "분석 3회")
- 최고 점수 (점수 색상: 80+ 초록, 60+ 노랑, 나머지 빨강)
- 최근 분석 파일명 + 날짜
- ⋯ 메뉴 (이름변경 / 삭제)

### 3.3 빈 상태
- 프로젝트 0개: "아직 프로젝트가 없습니다" + "프로젝트 만들기" 버튼

---

## 4. 프로젝트 생성 (`createProject`)

```
1. checkProjectAllowance() 호출
   - 무료: projects 테이블에 1개 이상이면 → "무료 플랜은 1개만 가능"
   - 유료(active, 미만료): 무제한
   - 유료(만료/해지): 차단 → "구독을 갱신해 주세요"
2. projects 테이블에 INSERT (name, user_id)
3. 생성된 프로젝트 반환
```

### 4.1 UI 흐름
1. "+" 버튼 클릭
2. 프로젝트 이름 입력 (기본값: "새 프로젝트")
3. 확인 → DB 저장 → 목록에 추가

---

## 5. 프로젝트 삭제 (`deleteProject`)

```
1. 확인 다이얼로그: "이 프로젝트와 모든 분석 기록이 삭제됩니다"
2. analysis_history에서 해당 project_id 분석 전부 DELETE
3. projects 테이블에서 DELETE
4. 목록 새로고침
```

> ⚠️ 하위 분석이 있으면 먼저 삭제해야 함 (FK 제약)

---

## 6. 프로젝트 이름변경 (`renameProject`)

```
1. ⋯ 메뉴 → "이름변경" 클릭
2. 카드가 인라인 입력 모드로 전환
3. Enter 또는 외부 클릭 → 저장
4. 빈 이름이면 → 에러 메시지
5. DB: UPDATE projects SET name=?, updated_at=now()
```

---

## 7. DB 테이블

### projects

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 프로젝트 ID |
| user_id | UUID (FK) | 사용자 ID |
| name | text | 프로젝트 이름 |
| description | text | 설명 (현재 미사용) |
| created_at | timestamptz | 생성일 |
| updated_at | timestamptz | 수정일 |

### RLS 정책
- SELECT: `auth.uid() = user_id`
- INSERT: `auth.uid() = user_id`
- UPDATE: `auth.uid() = user_id`
- DELETE: `auth.uid() = user_id`

---

## 8. 관련 파일

| 파일 | 역할 |
|------|------|
| `app/mypage/page.tsx` | 프로젝트 목록 UI, 카드, ⋯ 메뉴, 삭제 다이얼로그 |
| `app/actions/subscription.ts` | getProjects, createProject, deleteProject, renameProject |
| `components/analyze-dashboard.tsx` | 분석 시 프로젝트 선택/생성 UI |

---

## 9. 알려진 이슈

| 항목 | 설명 |
|------|------|
| 987줄 단일 파일 | 프로젝트/분석/구독이 한 파일 → 컴포넌트 분리 필요 |
| description 미사용 | DB에 있지만 UI에서 입력/표시 없음 |
| 프로젝트 정렬 | 현재 생성일순 고정 → 최근 분석순 옵션 필요 |
| subscription.ts 혼재 | 프로젝트 CRUD가 구독 파일에 있음 → 분리 필요 |
