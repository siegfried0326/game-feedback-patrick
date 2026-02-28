# TODO / 백로그

> 마지막 업데이트: 2026-02-27

## 긴급 (버그/장애)

현재 알려진 긴급 버그 없음.

## 진행 중

- [ ] **대용량 PDF 서버 압축 (Supabase Edge Function)**
  - 현재: 100MB+ 파일은 클라이언트 텍스트 추출 → 이미지/레이아웃 평가 불가
  - 30~100MB: 클라이언트 jsPDF 압축 → 브라우저 메모리 한계, 3분 타임아웃
  - 목표: 서버에서 압축 후 이미지 포함 풀 분석
  - 우선순위: 1순위 Supabase Edge Function, 2순위 Adobe PDF API, 3순위 AWS Lambda

## 단기 (1~2주)

- [ ] **구독 자동갱신 cron 구현**
  - 빌링키 기반 결제 함수는 있으나 만료 시 자동 호출하는 cron 없음
  - Supabase pg_cron 또는 Vercel Cron

- [ ] **만료 구독 자동 expired 처리**
  - expires_at 지나도 DB status가 active 유지
  - cron으로 일괄 expired 처리 필요

- [ ] **분석 상세 뒤로가기 스크롤 위치 보존**
  - mypage에서 상세 진입 후 뒤로가면 스크롤 초기화

## 중기 (1~2개월)

- [ ] **대용량 PDF 서버 압축 파이프라인 완성**
- [ ] **분석 결과 PDF 다운로드** (jspdf 이미 설치됨)
- [ ] **분석 결과 공유 링크**
- [ ] **모바일 반응형 개선** (analyze-dashboard)
- [ ] **분석 중 실시간 진행률** (현재 시간 기반 가짜 진행률)
- [ ] **마이페이지 컴포넌트 분리** (987줄 → 탭별)

## 장기 (3개월+)

- [ ] **AWS Lambda 기반 1GB+ PDF 처리**
- [ ] **분석 결과 비교 대시보드** (프로젝트 간)
- [ ] **팀 기능** (프로젝트 공유)
- [ ] **REST API 엔드포인트** (현재 Server Action만)
- [ ] **다국어 지원** (영어)

## 기술 부채

- [ ] **analyze.ts 리팩토링** (1128줄) — analyzeUrlDirect/analyzeDocumentDirect 중복 로직 추출
- [ ] **analyze-dashboard.tsx 리팩토링** (1387줄) — ProjectSelector, FileUploader, AnalysisResult 분리
- [ ] **subscription.ts 리팩토링** (369줄) — 구독/프로젝트/이력 파일 분리
- [ ] **테스트 코드 작성** (현재 0개)
- [ ] **TypeScript any 타입 정리** (excel-parser.ts 등)
- [ ] **console.log 정리** (analyze.ts 디버깅 로그)
- [ ] **에러 반환값 일관성** (error vs reason vs allowed 등 혼재)
- [ ] **ADMIN_EMAILS 파싱 통합** (3곳에서 각각 파싱 → lib/admin.ts 하나로)

## 완료

- [x] 마이페이지 프로젝트 관리 (삭제/이름변경/그룹핑)
- [x] 버전비교 필드명 버그 수정
- [x] RLS DELETE/UPDATE 정책 추가
- [x] 대용량 PDF 텍스트 추출 (100MB+)
- [x] 대용량 PDF 클라이언트 압축 (30~100MB)
- [x] 사용팁 행동유도형 UI
- [x] tutoring_orders 제약조건
- [x] 랜딩페이지 파일크기 표기 수정
- [x] 컨설팅 결제 파이프라인
- [x] 게임캔버스 할인 코드
- [x] 플랜별 Claude 모델 분기
- [x] SSRF 방어
- [x] Jina AI Reader 폴백
- [x] 평가 카테고리 15개 확장
- [x] 가독성 평가 10개 항목
- [x] 레이아웃 개선 제안 시각화
- [x] 회사별 비교 피드백 (8개 회사)
- [x] 합격 포트폴리오 DB 비교 분석 (랭킹, 백분위)
