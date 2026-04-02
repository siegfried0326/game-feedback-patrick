# 변경 이력 (CHANGELOG)

> 최신 변경사항이 위에 표시됩니다.

## 2026-03-27

### 자동갱신(빌링키) 구독 결제 구현 (`a2a9b26`)
- **핵심 변경**: 토스페이먼츠 팝업 방식 → NICEPayments 빌링키(카드 직접 등록) 방식으로 전환
- `app/payment/billing/page.tsx`: AUTHNICE.requestPay() 제거 → 카드 직접 입력 폼 (카드번호/유효기간/비밀번호2자리/생년월일)
- `app/api/nicepay/billing/register/route.ts` (신규): AES-128-ECB 암호화 → 빌링키 발급 → 첫 결제 → DB 저장
- `app/api/cron/renew-subscriptions/route.ts` (신규): 매일 만료 구독 자동 결제 (3회 실패 시 빌링키 삭제 + 만료 처리)
- `vercel.json` (신규): Cron 스케줄 `0 17 * * *` UTC (= 매일 오전 2시 KST)
- `scripts/015_add_auto_renewal.sql` (신규): `auto_renewal`, `renewal_failed_at`, `renewal_fail_count` 컬럼 추가
- ⚠️ **Supabase SQL Editor에서 `scripts/015_add_auto_renewal.sql` 실행 필요**
- ⚠️ **Vercel 환경변수 `CRON_SECRET` 추가 권장**

### Claude Opus 마케팅 강화 — 3개월 플랜 amber 테마 (`6399200`)
- `components/pricing-section.tsx`, `pricing-modal.tsx`, `app/pricing/page.tsx`, `app/payment/billing/page.tsx` 4곳 수정
- 3개월 플랜: amber 테두리/배지/버튼, "Claude Opus 탑재" 배지, "Claude Sonnet 대비 더 심층 분석" 문구 추가

### 개인정보처리방침 페이지 추가 (`37f1bc9`)
- `app/privacy/page.tsx` 신규 생성 → `/privacy` 라우트
- footer에 링크 추가: 이용약관 | 개인정보처리방침 | 환불정책

### 게임캔버스 할인 문구 전면 제거 (`3b32b6a`)
- `components/pricing-section.tsx`, `components/pricing-modal.tsx`, `app/pricing/page.tsx` 3곳에서 "게임캔버스 수강생 월 5,900원" 문구 삭제

### 푸터 주소 동호수 정리 (`0a85f51`)
- `components/footer.tsx`: "1008호", "202동" 제거
- 최종 주소: `경기도 수원시 영통구 센트럴타운로 107(이의동, 광교푸르지오 월드마크)`

### NICEPay 무한로딩 원인 확인
- Vercel 로그 분석: `/api/nicepay/callback` 미호출 → 프리뷰 URL(`.vercel.app`) 사용 시 NICEPay가 returnUrl 도달 불가
- 해결: 커스텀 도메인에서 테스트 시 정상 작동 확인

---

## 2026-03-07

### PDF 분석 max_tokens 증가 + stop_reason 체크 (`ed54f62`)
- `analyzeDocumentDirect` max_tokens: 8192 → **16384**로 증가
- `analyzeUrlDirect` max_tokens: 8192 유지 (URL 분석은 가독성/레이아웃 없어 출력량 적음)
- 양쪽 함수에 `stop_reason === "max_tokens"` 체크 로그 추가
- **원인**: PDF 분석 출력(15카테고리 + 10가독성 + 3레이아웃 + 8회사피드백)이 8192 토큰 초과 → JSON 잘림 → 파싱 실패
- 문서마다 벡터검색 결과 크기가 달라 일부 문서만 실패하던 현상 해결

### 벤치마크 데이터 truncation (`0a2402b`)
- `BENCHMARK_MAX_CHARS = 150` 상수 추가
- `truncateBenchmark()` 함수로 항목당 150자 이내 절단 (마지막 완전한 문장에서 컷)
- 벤치마크 전체 크기: ~72,000자 → ~27,000자로 축소
- **원인**: 벤치마크 원본 데이터가 너무 커서 Claude 출력 토큰 부족

### 회사별 벤치마크 → analyze.ts 연동 구현
- `app/actions/analyze.ts`에 벤치마크 로드/포맷 함수 추가
  - `loadCompanyBenchmarks()`: `data/company-benchmarks.json` 읽기 (서버 캐싱)
  - `formatBenchmarkForPrompt(includeReadability)`: 프롬프트용 텍스트 변환
- `analyzeUrlDirect()`: design 벤치마크만 주입 (URL은 시각 평가 불가)
- `analyzeDocumentDirect()`: design + readability 벤치마크 모두 주입
- companyFeedback 지시문 갱신: "벤치마크 데이터를 반드시 참고하여 작성"
- categories feedback 규칙 갱신: "벤치마크의 합격자 특징을 인용하여 비교"
- readabilityCategories feedback: "벤치마크 참고하여 합격자 대비 피드백"
- 일반회사 데이터: "업계 공통" 라벨로 주입, 사용자 미노출
- 빌드 확인 완료

### 회사별 벤치마크 데이터 구축
- `data/company-benchmarks.json` 신규 생성
- NotebookLM에서 187개 합격 포트폴리오 기반 회사별 평가 기준 추출
- 9개사 데이터 저장: 넥슨, 네오위즈, 넷마블, 엔씨소프트, 크래프톤, 펄어비스, 스마일게이트, 웹젠, 일반회사
- 각 회사당 20개 항목 (게임디자인 10 + 문서가독성 10)

## 2026-03-06

### 환불 UI 개선 + 환불 정책 가격 수정
- 마이페이지 환불 UI: "환불 가능: N원" 표시 제거, 개별 환불 버튼 제거
- "환불정책 보기" 옆에 작은 "환불하기" 링크로 변경 (환불 종용 느낌 제거)
- 환불정책 페이지 구 가격 수정: 17,900원→13,900원, 49,000원→39,000원
- 플랜명 업데이트: "월 구독"→"월 무제한", "3개월 패스"→"3개월 무제한"
- 최종 수정일 업데이트 (2025-01-20 → 2026-03-06)

### 구글 프로필 이미지 로딩 수정 (`595bc97`)
- CSP `img-src`에 `googleusercontent.com`, `kakaocdn.net`, `apple.com` 추가
- 프로필 이미지에 `referrerPolicy="no-referrer"` 추가

### 회사별 비교 피드백 동일 문제 해결 (`51c1dff`)
- **원인**: `analyzeDocumentDirect`의 벡터 서치가 파일명만 사용 → 동일 결과
- `analyzeDocumentDirect`에 `extractedText` 파라미터 추가
- 대시보드에서 PDF 텍스트 추출 → 벡터 서치에 실제 문서 내용 전달
- companyFeedback 프롬프트에 문서별 구체적 내용 인용 필수 추가

### 파일 업로드 제한 변경 + 프로젝트 생성 UX 개선 (`1882e2a`)
- 파일 업로드 제한: 1GB → 200MB (권장 30MB 이하)
- 마이페이지 "새 프로젝트": `/analyze` 이동 → 인라인 이름 입력으로 변경
- 프로젝트 이름 입력 → 바로 리스트에 추가 (Enter/Escape 지원)

### AI 응답 JSON 파싱 에러 복구 (`b06848f`)
- `safeParseJSON()` + `repairJSON()` 함수 추가 (잘린 JSON 자동 복구)
- `analyzeUrlDirect` max_tokens 4096 → 8192로 증가
- 15개 카테고리 JSON이 잘리는 문제 해결

### 크레딧 셀프 환불 기능
- 마이페이지에서 크레딧 직접 환불 (카카오톡 문의 불필요)
- `lib/toss-api.ts`: `cancelPayment()` 함수 추가
- `app/actions/payment.ts`: `getCreditOrders()`, `refundCreditOrder()` 추가
- 7일 이내 미사용 전액 / 부분 사용 정가(2,900원) 차감 후 환불
- 환불 규정 페이지에서 제7조(문의) 삭제, 마이페이지 직접 환불로 변경
- DB 마이그레이션: `scripts/014_add_refund_columns.sql`

### 문서 정리/통폐합
- docs/ 폴더 32개 → 22개로 정리 (9개 삭제, 1개 병합)
- 네이밍 규칙 적용: PRD_, ARCH_, REF_, TASK_, QA_, AUDIT_, LOG_ 접두어
- START_HERE.md 마스터 문서 생성

## 2026-03-04

### 크레딧 우선 소모 로직 + 게이지 UI
- 크레딧 > 구독 순서로 소모 (`deductCredit`, `checkAnalysisAllowance` 변경)
- 마이페이지: 크레딧 게이지(파랑) + 구독 게이지(초록) + D-day 표시
- 환불 규정에 크레딧 환불 기준 추가 (제5조)
- 결제 페이지에 크레딧 보유 시 안내 배너 추가

### 합격자 공통점 배치 분할 추출
- 단일 호출 → 45개씩 N배치 분할 → 중간 패턴 수집 → 통합 50개 추출
- admin.ts `extractSuccessPatterns()` 리팩토링
- 100개 → 50개 축소 + 잘린 JSON 복구 로직 추가

## 2026-03-03

### 데이터 구조 지도 문서화
- `docs/DATA-ARCHITECTURE.md` 신규 작성
- DB 테이블 8개, Storage, 외부 API 5개, 데이터 흐름 5가지 전체 정리
- 테이블 관계도, SQL 스크립트 목록, 환경 변수, 보안(RLS) 정책 포함

### 스트리밍 에러 수정
- `extractSuccessPatterns()`에서 Claude API 호출 방식 변경
- `anthropic.messages.create()` → `anthropic.messages.stream()` + `finalMessage()`
- 10분 초과 시 SDK가 던지는 "Streaming is required" 에러 해결

## 2026-03-02

### 합격자 공통점 100가지 추출 기능
- `extractSuccessPatterns()`: 임베딩된 청크 텍스트를 Claude API(sonnet)로 분석
- 일반 공통점 70가지 + 회사별 특징 30가지 자동 추출
- `success_patterns` 테이블에 저장 (중요도·카테고리·예시파일 포함)
- `/admin/success-patterns` 확인 페이지: 탭 전환, 중요도 뱃지, 예시 파일 표시
- 관리자 대시보드에 "합격자 공통점 분석" 섹션 추가
- SQL: `scripts/012_create_success_patterns.sql`

### 임베딩 버그 수정 (이전 세션)
- `chunkText()` 무한 루프 버그 수정 (800~900자 텍스트에서 발생)
- 스킵 마커(chunk_index=-1) 도입으로 무한 재선택 방지
- 임베딩 UI 개선: "실패 원인:" → "📋 처리 로그", 색상 코딩 추가
- 187개 포트폴리오 전체 임베딩 완료 (204 청크)

## 2026-02-28

### Vercel Pro 업그레이드 + 임베딩 함수 최적화
- Vercel Hobby → Pro 전환 ($20/월) — 서버 액션 타임아웃 10초→300초
- embedExistingPortfolios 초경량 재작성: Promise.all 병렬 쿼리 + 청크 20개 제한
- 운영 비용 문서 작성: `docs/COSTS.md`

### 관리자 페이지 UI 간소화 + 에러 처리 개선
- 관리자 페이지 전문용어 제거: "벡터 서치 임베딩" → "유사 포트폴리오 검색 준비"
- "신규 임베딩 생성" → "검색 데이터 만들기", "전체 재생성" → "전체 다시 만들기"
- 서버 응답이 JSON이 아닐 때(HTML 에러 페이지 등) "The string did not match the expected pattern" 에러 수정
- API 응답을 텍스트로 먼저 읽고 JSON 파싱 시도하도록 변경

### 벡터 서치 (유사 포트폴리오 검색) 구현
- OpenAI text-embedding-3-small 임베딩 + Supabase pgvector 연동
- 사용자 분석 시 유사한 합격 포트폴리오의 **실제 내용**을 AI에 제공
- 기존: 메타데이터(점수/태그/요약)만 → 변경: 실제 텍스트 내용 비교 가능
- 신규 파일: `lib/openai-embedding.ts`, `lib/vector-search.ts`
- 신규 SQL: `scripts/011_add_vector_search.sql` (portfolio_chunks 테이블)
- admin.ts: 포트폴리오 업로드 시 자동 임베딩 생성 + 일괄 임베딩 액션 추가
- analyze.ts: analyzeUrlDirect/analyzeDocumentDirect에 벡터 검색 연동
- 스프레드시트 업로드 시 content_text 자동 저장
- PRD 기획서: `docs/PRD_벡터서치.md` 작성

### 보안 감사 완료
- 28개 항목 보안 감사 수행 (19 통과 / 5 부분 / 4 미구현)
- RLS 정책 전면 정비: 위험한 퍼블릭 정책 삭제 → auth.uid() 기반으로 교체
- 에러 메시지에서 DB 상세정보 노출 제거
- next.config 보안 헤더 추가

### 크레딧 결제 시스템 추가
- 크레딧 3종: 1크레딧(2,900원), 5크레딧(7,900원), 10크레딧(12,900원)
- 회원가입 시 첫 1회 무료 크레딧 자동 지급
- 크레딧 결제 페이지 + 성공 페이지 신규 생성
- TossPayments 일반결제 연동 (크레딧용)

### 구독 가격 변경
- 월 구독: 17,900원 → 13,900원
- 3개월 패스: 49,000원 → 39,000원
- 플랜 이름 변경: "월 구독" → "월 무제한", "3개월 패스" → "3개월 무제한"

### 할당량 체크 로직 개편
- 기존: 무료 1회 → 유료만 분석 가능
- 변경: 크레딧 > 0이면 분석 가능, 구독자는 무제한
- 분석 완료 후 크레딧 자동 차감 (구독자 제외)

### UI 전면 업데이트
- 가격표 페이지: 크레딧 4종 + 구독 2종 카드 구조
- 랜딩페이지 가격표: 크레딧 묶음 + 구독 카드
- 헤더 모달: 크레딧 + 구독 3종 카드
- 마이페이지: 남은 크레딧 표시, 플랜명 업데이트

## 2026-02-27

### 문서화 체계 구축
- PRD 문서 5개 작성 (인증, 문서분석, 결제구독, 마이페이지, 관리자)
- ARCHITECTURE.md, TODO_BACKLOG.md, CHANGELOG.md 작성
- 전체 소스 코드에 상세 한국어 주석 추가

### 사용팁 UX 개선
- "더 정확한 분석을 받고 싶나요?" 행동유도형 설명으로 변경
- 태그 형태 → 세로 카드 형태 (설명 포함)

### 100MB+ PDF 대응
- 50페이지 제한 + 80000자 조기종료 + 타임아웃 제거
- 이어 읽기 기능 추가 후 원복 (UX 부적합 판단)

### 기타
- Supabase RLS 정책 + tutoring_orders 제약조건 완료
- 랜딩/이용약관 파일크기 표기 업데이트

## 2026-02-26

### 컨설팅 상품 개편
- 모의면접 삭제, 12회 패키지 추가, 가격표 노출
- 그룹 컨설팅 가격 변경 (9만원 → 36만원/4주)

### 마이페이지 개선
- 분석결과 UX 개선 + 모달 통일
- 프로젝트 관리 대규모 개선

## 2026-02-25

### AI 분석 품질
- 문서 주제 맞춤 평가 규칙 추가
- 회사별 비교: 8개 회사 필수 + 허위 방지
- 균형 샘플링 + 공통 패턴 분석
- 회사 비교를 점수 테이블 → 텍스트 코멘트로 변경

### URL 분석 확장
- SPA/자바스크립트 페이지 지원 (Jina AI Reader 폴백)

### 보안
- 인증 없는 테스트 API 삭제

### 모바일 최적화
- viewport, dvh, 텍스트/버튼 반응형

## 2026-02-24

### 결제 안정화
- 기존 구독자 재결제 시 만료일+1개월 연장
- 테스터 계정 반복결제 처리
- 할인코드 컬럼 참조 에러 수정

### 보안 강화
- 결제키 하드코딩 제거, 인증 체크, SSRF 방어

### 파일 확장
- DOCX, PPTX, XLSX, TXT 지원 추가
- 이메일/비밀번호 로그인 추가

## 2026-02-23

### 브랜딩 강화
- 랜딩페이지 애플 스타일 마케팅 문구
- 분석 결과 미리보기 스크린샷 4장

### 요금제/결제
- 게임캔버스 할인 구독 (월 5,900원)
- 무료 분석 2회 → 1회 변경

### 데이터테이블 분석
- 엑셀/CSV 파일 → 텍스트 변환 후 AI 분석

### 인증
- 세션 쿠키 30일 자동 로그인

## 2026-02-22

### 서비스명 적용
- '아카이브 187(Archive187)' 전체 반영

### 게임디자인 역량 분석
- 10개 항목 추가 (총 15개 카테고리)
- 레이더 차트 2탭 구조
- 가독성 분석 + 레이아웃 개선 제안

### 학습 데이터 관리
- 엑셀/CSV 업로드 지원
- 관리자 시스템 (ADMIN_EMAILS)
- 파일명 기준 회사 재분류

### AI 엔진
- Gemini → Claude 전환
- 플랜별 모델 분기 (Sonnet/Opus)

## 2026-02-21

### 핵심 기능 구축
- 분석 결과 저장/조회 + 프로젝트 시스템
- 랭킹 시스템 + 회사별 비교 분석
- 소셜 로그인 (Google, Kakao, Apple)
- 토스페이먼츠 결제 연동

### 랜딩 페이지 리뉴얼
- 2컬럼 레이아웃 + 업로드 연동

## 2026-02-20

### PG 심사 준비
- 이용약관, 환불정책, 가격 페이지 + 사업자정보

## 2026-02-14

### 프로젝트 시작
- Initial commit: 게임 기획 문서 피드백 분석 서비스
