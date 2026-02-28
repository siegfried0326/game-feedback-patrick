# PRD: 관리자 대시보드 (학습 데이터 관리)

## 1. 개요

| 항목 | 내용 |
|------|------|
| 라우트 | `/admin`, `/admin/training` |
| AI 엔진 | Google Gemini 2.0 Flash (학습 데이터 분석용) |
| 접근 제한 | ADMIN_EMAILS 환경변수 기반 |
| 마지막 갱신 | 2026-02-27 |

합격자 포트폴리오를 업로드하면 Gemini AI가 분석하여 `portfolios` 테이블에 저장. 이 데이터는 일반 사용자 분석 시 비교 기준(벤치마크)으로 활용됨.

## 2. 접근 제한

| 조건 | 동작 |
|------|------|
| 비로그인 | `/login?redirect=/admin` |
| 로그인 + 비관리자 | `/` (홈) |
| 관리자 이메일 | 정상 접근 |

미들웨어 + 서버 액션 이중 확인.

## 3. 페이지 구조

| 라우트 | 파일 | 설명 |
|--------|------|------|
| `/admin` | `app/admin/page.tsx` (~465줄) | 초기 버전 대시보드 |
| `/admin/training` | `app/admin/training/page.tsx` (~823줄) | 통합 관리 (업로드+데이터) |
| `/admin/data` | `app/admin/data/page.tsx` | training으로 리다이렉트 |

모든 admin 레이아웃: `maxDuration = 300` (5분)

## 4. 핵심 기능

### 4.1 파일 업로드 + AI 분석

지원 형식: PDF, Excel, CSV, TXT, JPG/PNG
크기 제한: 관리자 500MB

```
파일 드래그 → 중복 체크 → "학습 시작" 클릭
  ├─ Supabase Storage에 업로드 (admin/{uuid}.ext)
  ├─ 파일명에서 회사명 추출 (company-parser.ts)
  ├─ analyzeAndSavePortfolio() 호출
  │   ├─ Excel/CSV: 텍스트 변환 후 분석
  │   ├─ 15MB 미만: inline_data (base64)
  │   └─ 15MB 이상: Gemini File API 업로드 → 폴링 → 분석
  ├─ portfolios 테이블에 저장
  └─ Storage 원본 파일 삭제 (분석 결과만 보관)
```

파일 간 3초 간격 (Rate limiting).

### 4.2 회사명 자동 추출 (`lib/company-parser.ts`)

40+ 회사 지원. 파일명 → 유니코드 정규화 → 긴 이름 우선 매칭 → 정규화.

### 4.3 Gemini 분석 프롬프트
- PDF용: 11년 경력 게임 기획 포트폴리오 전문가 역할
- Excel용: 데이터테이블 설계 전문가 역할
- 5개 항목 점수 + 태그 + 요약 + 강점 4개 + 약점 3개

### 4.4 데이터 관리
- 목록 조회/검색
- 단건/일괄 삭제
- 전체 회사 재분류 (`reclassifyAllCompanies`)

## 5. 학습 데이터 활용

사용자가 분석 요청 시:
1. portfolios에서 상위 50개 로드
2. 회사별 균형 샘플링 (8개 회사 x 상위 2개 + 나머지)
3. 통계 + 샘플 12개를 Claude 시스템 프롬프트에 주입
4. 랭킹: 187명 기준, 백분위 계산

## 6. DB: portfolios 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | |
| file_name | text | 원본 파일명 |
| companies | text[] | 회사명 배열 |
| overall_score | integer | 종합 점수 |
| logic_score | integer | 논리력 |
| specificity_score | integer | 구체성 |
| readability_score | integer | 가독성 |
| technical_score | integer | 기술이해 |
| creativity_score | integer | 창의성 |
| tags | text[] | 키워드 태그 |
| summary | text | 문서 요약 |
| strengths | text[] | 강점 |
| weaknesses | text[] | 약점 |

## 7. 서버 액션 (`app/actions/admin.ts`, 694줄)

| 함수 | 설명 |
|------|------|
| `uploadAdminFile` | Storage 업로드 (서버 경유) |
| `analyzeAndSavePortfolio` | Gemini 분석 + DB 저장 |
| `getPortfolioStats` | 총 개수 + 회사 목록 |
| `getCompanyAverages` | 회사별 평균 점수 |
| `getPortfolioList` | 목록 조회 |
| `deletePortfolio` | 단건 삭제 |
| `deleteMultiplePortfolios` | 일괄 삭제 |
| `getCompanyStats` | 회사별 카운트 |
| `reclassifyAllCompanies` | 전체 회사 재분류 |

## 8. 환경변수

| 변수명 | 용도 |
|--------|------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API |
| `ADMIN_EMAILS` | 관리자 이메일 |

## 9. 현재 학습 데이터 현황

- 총 280개 합격 포트폴리오
- 중앙값 1.5MB, 평균 6.4MB
- 81% 5MB 이하, 100MB+ 3개 (1.1%)
