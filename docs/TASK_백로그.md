# TODO / 백로그

> 마지막 업데이트: 2026-03-06

## 긴급 (버그/장애)

현재 알려진 긴급 버그 없음.

## 진행 중

- [ ] **학습데이터 관련 문제개선** (태스크 1)
  - 사용자 테스트 후 구체적 이슈 확정 예정
  - 관련: `app/actions/admin.ts`, `app/admin/training/page.tsx`
  - → 상세: `docs/TASK_결제개선.md` 참고

## 단기 (1~2주)

- [ ] **구독 자동갱신 cron 구현**
  - 빌링키 기반 결제 함수는 있으나 만료 시 자동 호출하는 cron 없음
  - Supabase pg_cron 또는 Vercel Cron

- [ ] **만료 구독 자동 expired 처리**
  - expires_at 지나도 DB status가 active 유지
  - cron으로 일괄 expired 처리 필요

- [ ] **DB 마이그레이션 실행**
  - `scripts/014_add_refund_columns.sql` — Supabase SQL Editor에서 실행 필요

## 중기 (1~2개월)

- [ ] **대용량 PDF 서버 압축 파이프라인 완성**
- [ ] **분석 결과 PDF 다운로드** (jspdf 이미 설치됨)
- [ ] **분석 결과 공유 링크**
- [ ] **모바일 반응형 개선** (analyze-dashboard)
- [ ] **분석 중 실시간 진행률** (현재 시간 기반 가짜 진행률)
- [ ] **마이페이지 컴포넌트 분리** (~1187줄 → 탭별)

## 장기 (3개월+)

- [ ] **AWS Lambda 기반 1GB+ PDF 처리**
- [ ] **분석 결과 비교 대시보드** (프로젝트 간)
- [ ] **팀 기능** (프로젝트 공유)
- [ ] **REST API 엔드포인트** (현재 Server Action만)
- [ ] **다국어 지원** (영어)

## 기술 부채

- [ ] **analyze.ts 리팩토링** (~1128줄) — analyzeUrlDirect/analyzeDocumentDirect 중복 로직 추출
- [ ] **analyze-dashboard.tsx 리팩토링** (~1387줄) — 컴포넌트 분리
- [ ] **subscription.ts 리팩토링** (~369줄) — 구독/프로젝트/이력 파일 분리
- [ ] **테스트 코드 작성** (현재 0개)
- [ ] **TypeScript any 타입 정리** (excel-parser.ts 등)
- [ ] **console.log 정리** (analyze.ts 디버깅 로그)

## 완료

- [x] 크레딧 셀프 환불 기능 (마이페이지 직접 환불)
- [x] 크레딧 우선 소모 로직 변경 (크레딧 > 구독)
- [x] 마이페이지 게이지 UI (크레딧/구독)
- [x] 환불 규정 회차권 추가 + 마이페이지 직접 환불 안내
- [x] 합격자 공통점 배치 분할 추출 (100개→50개)
- [x] 벡터 서치 (유사 포트폴리오 검색) 구현 완료
- [x] 크레딧(회차권) 결제 시스템 추가
- [x] 마이페이지 프로젝트 관리 (삭제/이름변경/그룹핑)
- [x] RLS DELETE/UPDATE 정책 추가
- [x] 대용량 PDF 텍스트 추출/압축
- [x] 평가 카테고리 15개 확장
- [x] 회사별 비교 피드백 (8개 회사)
- [x] 합격 포트폴리오 DB 비교 분석 (랭킹, 백분위)
- [x] 보안 감사 완료
