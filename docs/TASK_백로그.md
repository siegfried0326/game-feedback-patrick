# TODO / 백로그

> 마지막 업데이트: 2026-03-07

## 긴급 (버그/장애)

현재 알려진 긴급 버그 없음.

## 진행 중

- [x] **회사별 벤치마크 데이터 → analyze.ts 연동** ✅ 2026-03-07
  - `data/company-benchmarks.json` 데이터 완성 (9개사 × 20항목)
  - analyze.ts 양쪽 함수(URL/Document)에 벤치마크 프롬프트 주입 완료
  - design 10항목 + readability 10항목 벤치마크 → Claude 시스템 프롬프트에 주입
  - 일반회사 데이터는 "업계 공통" 라벨로 주입 (사용자 미노출)
  - companyFeedback + categories feedback에서 벤치마크 참조하도록 지시문 갱신
  - 관련: `app/actions/analyze.ts`, `data/company-benchmarks.json`
  - **테스트 필요**: 실제 분석 시 벤치마크 기반 피드백 품질 확인

- [ ] **학습데이터 관련 문제개선** (태스크 1)
  - 사용자 테스트 후 구체적 이슈 확정 예정
  - 관련: `app/actions/admin.ts`, `app/admin/training/page.tsx`
  - → 상세: `docs/TASK_결제개선.md` 참고

- [ ] **분석 페이지 + 마이페이지 UX 개선**
  - 분석 페이지: 프로젝트→업로드 흐름, 파일 안내 축소, 드롭존 강화 등 5건
  - 마이페이지: 구독 상태 혼란, 안내 배너, 카드 인터랙션, 스크롤 축소 등 6건
  - → 상세: `docs/TASK_UX개선.md` 참고

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

- [x] 환불 정책 가격 수정 (17,900→13,900, 49,000→39,000) + 플랜명 업데이트
- [x] 마이페이지 환불 UI 개선 — 환불 종용 느낌 제거, 환불정책 옆 작은 링크로 변경
- [x] 구글 프로필 이미지 CSP 수정 (`595bc97`) — img-src에 소셜 로그인 도메인 추가
- [x] 회사별 비교 피드백 동일 문제 해결 (`51c1dff`) — 벡터서치 실제 문서 내용 기반으로 변경
- [x] 파일 업로드 제한 1GB→200MB + 권장 30MB (`1882e2a`)
- [x] 마이페이지 프로젝트 인라인 생성 UX 개선 (`1882e2a`)
- [x] AI 응답 JSON 파싱 에러 복구 (`b06848f`) — safeParseJSON/repairJSON
- [x] 문서 정리/통폐합 (32개→22개, START_HERE.md 생성)
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
