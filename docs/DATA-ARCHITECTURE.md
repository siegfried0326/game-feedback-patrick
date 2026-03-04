# 데이터 구조 지도 (Data Architecture Map)

> 최종 업데이트: 2026-03-03
>
> 이 문서는 디자이닛(DesignIt) 서비스의 전체 데이터 흐름을 설명합니다.
> 데이터가 어디서 생기고, 어디에 저장되고, 어떻게 활용되는지 한눈에 파악할 수 있습니다.

---

## 전체 구조 요약

```
[관리자]                              [사용자]
  │                                      │
  │ PDF 업로드                            │ PDF/URL 업로드
  ▼                                      ▼
┌──────────────┐                   ┌──────────────────┐
│ Gemini Flash │ 분석              │  Claude Sonnet   │ 분석
│ (학습 데이터) │                   │  (사용자 문서)    │
└──────┬───────┘                   └────────┬─────────┘
       │                                    │
       ▼                                    │
┌──────────────┐    벡터 검색으로 참조  →    │
│  portfolios  │ ◄──────────────────────────┤
│  (DB 테이블)  │                            │
└──────┬───────┘                            ▼
       │                           ┌──────────────────┐
       ▼                           │ analysis_history  │
┌──────────────────┐               │  (분석 결과 저장)  │
│ portfolio_chunks │               └──────────────────┘
│ (벡터 임베딩)     │
└──────────────────┘
```

---

## 1. 데이터베이스 테이블 (Supabase PostgreSQL)

### portfolios — 학습 데이터 (합격자 포트폴리오)

관리자가 올린 합격자 포트폴리오의 분석 결과. AI가 사용자 문서를 분석할 때 "기준"으로 참고함.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| file_name | TEXT | 파일 이름 (예: "넥슨_01.pdf") |
| companies | TEXT[] | 회사명 배열 (예: ["넥슨", "엔씨소프트"]) |
| year | INTEGER | 작성 연도 |
| document_type | TEXT | 문서 유형 (시스템기획, 콘텐츠기획 등) |
| overall_score | INTEGER | 종합 점수 (0~100) |
| logic_score | INTEGER | 논리력 점수 |
| specificity_score | INTEGER | 구체성 점수 |
| readability_score | INTEGER | 가독성 점수 |
| technical_score | INTEGER | 기술이해 점수 |
| creativity_score | INTEGER | 창의성 점수 |
| tags | TEXT[] | 키워드 태그 (최대 12개) |
| summary | TEXT | 요약 (250자 이내) |
| strengths | TEXT[] | 강점 4가지 |
| weaknesses | TEXT[] | 약점 3가지 |
| content_text | TEXT | 문서 본문 텍스트 (벡터 임베딩 원본) |
| file_url | TEXT | Storage 다운로드 URL |
| created_at | TIMESTAMPTZ | 등록일 |
| updated_at | TIMESTAMPTZ | 수정일 |

**뷰(View):**
- `company_stats` — 회사별 평균 점수 통계
- `overall_stats` — 전체 통계 (평균, 최고, 최저)

---

### portfolio_chunks — 벡터 검색용 조각

포트폴리오 텍스트를 800자씩 잘라서 AI가 검색할 수 있게 벡터(숫자 배열)로 변환한 데이터.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| portfolio_id | UUID | 원본 포트폴리오 ID (portfolios 테이블 참조) |
| chunk_index | INTEGER | 조각 순서 (0, 1, 2, ...) |
| chunk_text | TEXT | 텍스트 조각 (800자 단위, 100자 겹침) |
| embedding | VECTOR(1536) | OpenAI 임베딩 벡터 (1536차원) |
| metadata | JSONB | 추가 정보 (파일명, 회사명 등) |
| created_at | TIMESTAMPTZ | 생성일 |

**인덱스:** HNSW (코사인 유사도 검색 최적화)

**RPC 함수:** `match_portfolio_chunks(query_embedding, match_threshold, match_count)`
- 사용자 문서와 가장 비슷한 포트폴리오 조각을 찾아줌

---

### users_subscription — 구독/크레딧 관리

사용자의 결제 상태, 구독 정보, 남은 분석 횟수를 관리.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| user_id | UUID | Supabase Auth 사용자 ID |
| plan | TEXT | 구독 유형: 'free', 'monthly', 'three_month' |
| status | TEXT | 상태: 'active', 'cancelled', 'expired' |
| started_at | TIMESTAMPTZ | 구독 시작일 |
| expires_at | TIMESTAMPTZ | 구독 만료일 |
| cancelled_at | TIMESTAMPTZ | 해지 요청일 |
| payment_id | TEXT | TossPayments 결제 키 |
| billing_key | TEXT | 자동결제용 빌링 키 |
| customer_key | TEXT | TossPayments 고객 식별 키 |
| analysis_credits | INTEGER | 남은 분석 크레딧 수 |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

---

### analysis_history — 사용자 분석 이력

사용자가 문서를 분석할 때마다 결과가 여기에 저장됨. 마이페이지에서 과거 분석 결과를 볼 수 있음.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| user_id | UUID | 사용자 ID |
| project_id | UUID | 프로젝트 ID (선택) |
| file_name | TEXT | 분석한 파일/URL 이름 |
| overall_score | INTEGER | 종합 점수 |
| categories | JSONB | 15개 카테고리별 점수 (JSON 배열) |
| readability_categories | JSONB | 가독성 세부 항목 |
| layout_recommendations | JSONB | 레이아웃 개선 제안 |
| strengths | TEXT[] | 강점 목록 |
| weaknesses | TEXT[] | 약점 목록 |
| ranking | JSONB | 순위 정보 (187명 기준 백분위) |
| company_feedback | TEXT | 회사별 피드백 텍스트 |
| analysis_source | TEXT | 분석 소스: 'pdf', 'url', 'document' |
| analyzed_at | TIMESTAMPTZ | 분석 시점 |

**참고:** `categories`는 JSONB 배열이라 카테고리 수가 바뀌어도 DB 스키마 수정 불필요.

---

### projects — 사용자 프로젝트

분석 이력을 그룹으로 묶어 관리하는 폴더 개념.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| user_id | UUID | 사용자 ID |
| name | TEXT | 프로젝트 이름 |
| description | TEXT | 설명 |
| created_at | TIMESTAMPTZ | 생성일 |
| updated_at | TIMESTAMPTZ | 수정일 |

---

### credit_orders — 크레딧 구매 주문

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| user_id | UUID | 사용자 ID |
| package_type | TEXT | 'credit_1', 'credit_5', 'credit_10' |
| credits | INTEGER | 구매할 크레딧 수 |
| amount | INTEGER | 가격 (원) |
| order_id | TEXT | 주문 번호 (고유) |
| payment_key | TEXT | TossPayments 결제 키 |
| payment_status | TEXT | 'pending', 'paid', 'cancelled' |
| created_at | TIMESTAMPTZ | 주문일 |
| paid_at | TIMESTAMPTZ | 결제 완료일 |

---

### success_patterns — 합격자 공통점 100가지

AI가 전체 포트폴리오를 분석해서 뽑아낸 공통 패턴.

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | 고유 식별자 |
| pattern_number | INTEGER | 번호 (1~100) |
| category | TEXT | 'general' 또는 회사명 (넥슨, 엔씨소프트 등) |
| title | TEXT | 패턴 제목 |
| description | TEXT | 상세 설명 |
| importance | TEXT | 'high'(핵심), 'medium'(유용), 'low'(참고) |
| example_files | TEXT[] | 해당 패턴이 나타나는 포트폴리오 파일명 |
| batch_id | TEXT | 분석 세션 ID (같은 추출 묶음) |
| created_at | TIMESTAMPTZ | 추출일 |

---

## 2. 파일 저장소 (Supabase Storage)

### "resumes" 버킷

| 경로 | 용도 | 보존 |
|------|------|------|
| `admin/{uuid}.{ext}` | 관리자가 올린 포트폴리오 원본 | 분석 후 삭제 |
| `uploads/{uuid}.{ext}` | 사용자가 올린 분석용 파일 | 분석 후 삭제 가능 |

지원 파일 형식: PDF, DOCX, PPTX, XLSX, CSV, 이미지 (JPG, PNG, WebP)

---

## 3. 외부 API 연동

### Google Gemini 2.0 Flash — 학습 데이터 분석

| 항목 | 내용 |
|------|------|
| 용도 | 관리자가 올린 포트폴리오를 점수 매기고 요약 |
| 환경변수 | `GOOGLE_GENERATIVE_AI_API_KEY` |
| 모델 | `gemini-2.0-flash` |
| 사용 위치 | `admin.ts` → `analyzeAndSavePortfolio()` |
| 처리 방식 | 15MB 이하: base64 직접 전송 / 15MB 초과: File API 업로드 |

### Anthropic Claude — 사용자 문서 분석

| 항목 | 내용 |
|------|------|
| 용도 | 사용자 포트폴리오 15개 카테고리 점수 + 피드백 생성 |
| 환경변수 | `ANTHROPIC_API_KEY` |
| 모델 | 기본: `claude-sonnet-4-20250514` / 3개월권: `claude-opus-4-20250514` |
| 사용 위치 | `analyze.ts` → `analyzeDocumentDirect()`, `analyzeUrlDirect()` |
| 특이사항 | 학습 데이터 50개 + 벡터 검색 결과를 컨텍스트로 제공 |

### Anthropic Claude — 합격자 공통점 추출

| 항목 | 내용 |
|------|------|
| 용도 | 전체 포트폴리오에서 공통점 100가지 추출 |
| 모델 | `claude-sonnet-4-20250514` (스트리밍 모드) |
| 사용 위치 | `admin.ts` → `extractSuccessPatterns()` |
| 특이사항 | 입력이 커서 스트리밍 필수 (`messages.stream()`) |

### OpenAI Embeddings — 벡터 검색

| 항목 | 내용 |
|------|------|
| 용도 | 텍스트를 1536차원 숫자 배열로 변환 (유사도 검색용) |
| 환경변수 | `OPENAI_API_KEY` |
| 모델 | `text-embedding-3-small` |
| 사용 위치 | `admin.ts` → `generateEmbedding()`, `analyze.ts` → 검색 시 |

### TossPayments — 결제

| 항목 | 내용 |
|------|------|
| 용도 | 구독 결제, 크레딧 구매 |
| 환경변수 | `TOSS_SECRET_KEY` |
| 사용 위치 | `payment.ts` |
| 기능 | 빌링키 발급, 자동결제, 일반결제, 해지 |

### Jina AI Reader — 웹페이지 텍스트 추출

| 항목 | 내용 |
|------|------|
| 용도 | URL 분석 시 자바스크립트 페이지 본문 추출 (폴백) |
| URL | `https://r.jina.ai/{대상URL}` |
| 사용 위치 | `analyze.ts` → `analyzeUrlDirect()` 내부 |

---

## 4. 데이터 흐름 상세

### (A) 관리자: 포트폴리오 업로드 → 학습 데이터 생성

```
관리자가 PDF 업로드
      │
      ▼
[1] Storage "resumes" 버킷에 저장
    → admin/{uuid}.pdf
      │
      ▼
[2] 파일 타입 확인
    ├── PDF/이미지 → Gemini에 직접 전달
    └── Excel/CSV → 텍스트 변환 후 Gemini에 전달
      │
      ▼
[3] Gemini 2.0 Flash 분석
    → 점수 6개, 요약, 강점, 약점, 태그 추출
      │
      ▼
[4] portfolios 테이블에 저장
    → 파일명에서 회사명 자동 추출 (넥슨_01.pdf → "넥슨")
      │
      ▼
[5] 벡터 임베딩 생성
    ├── 텍스트를 800자씩 자름 (100자 겹침)
    ├── OpenAI embedding API로 벡터 변환
    └── portfolio_chunks 테이블에 저장
      │
      ▼
[6] Storage에서 원본 파일 삭제
    → 분석 끝나면 원본 불필요
```

### (B) 사용자: 문서 분석

```
사용자가 PDF 업로드 또는 URL 입력
      │
      ▼
[1] 구독/크레딧 확인
    ├── 구독 중 (active) → 무제한 분석
    ├── 크레딧 남음 → 크레딧 차감
    └── 둘 다 없음 → 분석 차단
      │
      ▼
[2] 파일을 Storage에 임시 저장
    → uploads/{uuid}.pdf
      │
      ▼
[3] 기준 데이터 준비
    ├── portfolios 테이블에서 상위 50개 조회 (점수 높은 순)
    ├── 회사별 평균 점수 계산
    └── 주요 회사별 균형 샘플 12개 선택
      │
      ▼
[4] 벡터 검색 (사용자 문서와 비슷한 포트폴리오 찾기)
    ├── 사용자 문서 텍스트 추출 (최대 100KB)
    ├── OpenAI embedding 생성
    └── portfolio_chunks에서 코사인 유사도 검색 → 상위 5개
      │
      ▼
[5] Claude API 호출
    ├── 시스템 프롬프트: 학습 데이터 + 벡터 검색 결과 + 분석 기준
    ├── 사용자 문서 내용
    └── 응답: 15개 카테고리 점수 + 가독성 + 레이아웃 + 회사별 비교
      │
      ▼
[6] 결과 가공
    ├── JSON 파싱 (15개 점수, 강점, 약점)
    ├── 187명 기준 순위/백분위 계산
    └── analysis_history 테이블에 저장
      │
      ▼
[7] 크레딧 차감 (구독자가 아닌 경우)
      │
      ▼
[8] Storage에서 임시 파일 삭제
```

### (C) 벡터 검색 상세

```
"이 사용자의 문서와 가장 비슷한 합격자 포트폴리오는?"
      │
      ▼
[1] 사용자 문서 텍스트 → OpenAI embedding
    → 1536개의 숫자 배열 생성
      │
      ▼
[2] Supabase RPC: match_portfolio_chunks()
    ├── 매개변수: 벡터, 유사도 기준(0.3), 개수(5)
    ├── HNSW 인덱스로 빠른 검색
    └── 코사인 유사도 = 두 벡터의 방향 비슷한 정도 (0~1)
      │
      ▼
[3] 결과: 상위 5개 유사 포트폴리오 조각
    → {chunk_text, similarity, portfolio_id}
      │
      ▼
[4] Claude 프롬프트에 포함
    → "이 사용자와 비슷한 합격자들의 포트폴리오 내용은..."
```

### (D) 결제 흐름

```
=== 구독 (월/3개월 자동결제) ===

사용자가 구독 선택
      │
      ▼
[1] TossPayments 카드 등록 위젯
    → 카드 정보 입력 → authKey 발급
      │
      ▼
[2] 서버: issueBillingKey(authKey)
    → billingKey 발급 (자동결제용 열쇠)
      │
      ▼
[3] 서버: approveBillingPayment(billingKey, 금액)
    → 첫 결제 승인
      │
      ▼
[4] users_subscription 업데이트
    ├── plan: 'monthly' or 'three_month'
    ├── status: 'active'
    ├── expires_at: 1개월 or 3개월 후
    └── billing_key, customer_key 저장


=== 크레딧 (일회성) ===

사용자가 크레딧 패키지 선택
      │
      ▼
[1] credit_orders에 주문 생성 (pending)
      │
      ▼
[2] TossPayments 결제 위젯
    → 결제 완료 → paymentKey 반환
      │
      ▼
[3] 서버: confirmPayment(paymentKey, orderId, amount)
    → 금액 검증 + 결제 확인
      │
      ▼
[4] credit_orders 업데이트 (paid)
[5] users_subscription.analysis_credits += 구매 크레딧
```

### (E) 합격자 공통점 추출

```
관리자가 "공통점 새로 추출하기" 클릭
      │
      ▼
[1] portfolio_chunks에서 전체 청크 텍스트 조회
    → 약 204개 조각
      │
      ▼
[2] 회사별로 묶기
    → {"넥슨": "...", "엔씨소프트": "...", ...}
      │
      ▼
[3] Claude API 호출 (스트리밍)
    ├── 전체 텍스트를 한번에 전달
    ├── "일반 공통점 70개 + 회사별 특징 30개 = 100개"
    └── JSON 형식으로 응답 요청
      │
      ▼
[4] JSON 파싱
    ├── 코드펜스(```) 제거
    └── { } 사이 추출
      │
      ▼
[5] 기존 데이터 삭제 → 새 데이터 저장
    → success_patterns 테이블에 100개 INSERT
```

---

## 5. 테이블 관계도

```
auth.users (Supabase 인증)
  │
  ├── 1:1 ── users_subscription (구독/크레딧)
  │             ├── plan, status
  │             ├── billing_key, customer_key
  │             └── analysis_credits
  │
  ├── 1:N ── analysis_history (분석 이력)
  │             ├── 15개 카테고리 점수
  │             ├── 순위/백분위
  │             └── project_id → projects
  │
  ├── 1:N ── projects (프로젝트 폴더)
  │
  └── 1:N ── credit_orders (크레딧 구매)


portfolios (학습 데이터) ── 사용자와 무관, 관리자만 관리
  │
  └── 1:N ── portfolio_chunks (벡터 임베딩)
                └── embedding (1536차원)


success_patterns (공통점) ── 독립 테이블, portfolio_chunks에서 추출
```

---

## 6. 서버 액션 파일 목록

| 파일 | 주요 함수 | 역할 |
|------|----------|------|
| `app/actions/auth.ts` | `getUser()`, `signOut()`, `ensureSubscription()` | 로그인, 로그아웃, 초기 구독 레코드 |
| `app/actions/analyze.ts` | `checkBeforeAnalysis()`, `analyzeUrlDirect()`, `analyzeDocumentDirect()` | 사용자 분석 파이프라인 |
| `app/actions/admin.ts` | `uploadAdminFile()`, `analyzeAndSavePortfolio()`, `embedExistingPortfolios()`, `extractSuccessPatterns()` | 학습 데이터 + 임베딩 + 공통점 |
| `app/actions/subscription.ts` | `getSubscription()`, `cancelSubscription()`, `getAnalysisHistory()`, `deductCredit()` | 구독/크레딧/프로젝트 관리 |
| `app/actions/payment.ts` | `processSubscriptionPayment()`, `createCreditOrder()`, `confirmCreditPayment()` | 구독 + 크레딧 결제 |

---

## 7. SQL 스크립트 목록 (scripts/)

테이블 생성/수정 이력. Supabase SQL Editor에서 순서대로 실행.

| 번호 | 파일 | 내용 |
|------|------|------|
| 001 | `001_create_tables.sql` | portfolios, users_subscription 기본 테이블 |
| 002 | `002_create_analysis_history.sql` | analysis_history 테이블 |
| 003 | `003_fix_subscription_rls.sql` | 구독 테이블 RLS 정책 수정 |
| 004 | `004_add_ranking_columns.sql` | 순위 컬럼 추가 |
| 005 | `005_add_projects.sql` | projects 테이블 + analysis_history에 project_id |
| 006 | `006_add_billing_columns.sql` | billing_key, customer_key 추가 |
| 007 | `007_create_credit_orders.sql` | credit_orders 테이블 |
| 008 | `008_create_tutoring_orders.sql` | tutoring_orders 테이블 (삭제됨) |
| 009 | `009_add_content_text.sql` | portfolios에 content_text 컬럼 |
| 010 | `010_create_portfolio_chunks.sql` | portfolio_chunks + pgvector + HNSW 인덱스 |
| 011 | `011_add_company_feedback.sql` | analysis_history에 company_feedback 컬럼 |
| 012 | `012_create_success_patterns.sql` | success_patterns 테이블 |

---

## 8. 보안 (RLS — Row Level Security)

모든 테이블에 Supabase RLS(행 수준 보안)이 적용됨.

| 테이블 | 읽기 | 쓰기 | 삭제 |
|--------|------|------|------|
| portfolios | 모든 인증 사용자 | 인증 사용자 (+ 서버에서 관리자 확인) | 인증 사용자 |
| portfolio_chunks | 인증 사용자 | 인증 사용자 | 인증 사용자 |
| users_subscription | 본인만 | 본인만 | 본인만 |
| analysis_history | 본인만 | 본인만 | - |
| projects | 본인만 | 본인만 | 본인만 |
| credit_orders | 본인만 | 본인만 | - |
| success_patterns | 인증 사용자 | 인증 사용자 | 인증 사용자 |

---

## 9. 환경 변수 목록

| 변수 | 용도 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 공개 키 (클라이언트용) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase 서비스 키 (서버에서 RLS 우회) |
| `ANTHROPIC_API_KEY` | Claude API 키 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API 키 |
| `OPENAI_API_KEY` | OpenAI Embeddings API 키 |
| `TOSS_SECRET_KEY` | TossPayments 비밀 키 |
| `ADMIN_EMAILS` | 관리자 이메일 목록 (쉼표 구분) |

---

## 10. 주요 수치/제한

| 항목 | 값 |
|------|-----|
| 사용자 파일 최대 크기 | 1GB |
| 관리자 파일 최대 크기 | 500MB |
| 벡터 차원 | 1536 (OpenAI text-embedding-3-small) |
| 청크 크기 | 800자 (100자 겹침) |
| 벡터 검색 유사도 기준 | 0.3 이상 |
| 벡터 검색 반환 개수 | 상위 5개 |
| 분석 카테고리 수 | 15개 (기본 5 + 게임디자인 10) |
| 순위 기준 인원 | 187명 |
| 합격자 공통점 | 100개 (일반 70 + 회사별 30) |
| 무료 분석 크레딧 | 1회 |
