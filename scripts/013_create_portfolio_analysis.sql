/**
 * 포트폴리오 개별 분석 결과 테이블
 *
 * 기존 방식: 187개 청크를 한번에 Claude에 던져서 공통점 추출 (토큰 초과, 얕은 분석)
 * 새 방식: 포트폴리오 1개씩 사용자 분석과 동일한 15개 기준으로 깊이 분석 → 결과 누적
 *
 * 흐름:
 * 1. 관리자가 "배치 분석" 실행 → 미분석 포트폴리오 10개씩 Claude로 분석
 * 2. 결과가 이 테이블에 쌓임
 * 3. 모든 포트폴리오 분석 완료 후 → "공통점 정리" 실행
 * 4. 개별 분석 결과를 종합해서 success_patterns에 공통점 저장
 *
 * 실행 방법:
 * 1. Supabase 대시보드 → SQL Editor 열기
 * 2. 아래 SQL을 전체 복사하여 붙여넣기
 * 3. "Run" 클릭
 * 4. "Success" 메시지 확인
 */

-- ============================================================
-- 1단계: portfolio_analysis 테이블 생성
-- ============================================================
create table if not exists public.portfolio_analysis (
  id uuid primary key default gen_random_uuid(),

  -- 어떤 포트폴리오를 분석했는지
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  file_name text not null,                           -- portfolios.file_name 복사 (조회 편의)
  companies text[] default '{}',                     -- portfolios.companies 복사

  -- 15개 카테고리 점수 (사용자 분석과 동일 기준)
  -- 기본 역량 5개
  logic_score integer default 0,                     -- 논리력
  specificity_score integer default 0,               -- 구체성
  readability_score integer default 0,               -- 가독성
  technical_score integer default 0,                 -- 기술이해
  creativity_score integer default 0,                -- 창의성
  -- 게임 디자인 역량 10개
  core_loop_score integer default 0,                 -- 핵심반복구조
  content_taxonomy_score integer default 0,          -- 콘텐츠분류체계
  economy_score integer default 0,                   -- 재화흐름설계
  player_experience_score integer default 0,         -- 플레이경험목표
  data_design_score integer default 0,               -- 수치데이터정리
  feature_connection_score integer default 0,        -- 기능간연결관계
  motivation_score integer default 0,                -- 동기부여설계
  difficulty_score integer default 0,                -- 난이도균형
  ui_ux_score integer default 0,                     -- 화면및조작설계
  dev_plan_score integer default 0,                  -- 개발일정및산출물

  -- 종합 점수
  overall_score integer default 0,

  -- 텍스트 분석 결과
  strengths text[] default '{}',                     -- 강점 목록 (4~6개)
  weaknesses text[] default '{}',                    -- 약점/보완점 목록 (3~4개)
  key_features text[] default '{}',                  -- 핵심 특징 키워드 (5~8개)
  summary text,                                       -- 분석 요약 (200자)
  detailed_feedback text,                            -- 상세 피드백 (카테고리별 1줄씩)

  -- 메타
  analyzed_at timestamptz default now()
);

-- ============================================================
-- 2단계: 인덱스 생성
-- ============================================================
-- 포트폴리오 ID로 빠른 조회 (중복 분석 방지)
create unique index if not exists idx_portfolio_analysis_portfolio_id
  on public.portfolio_analysis(portfolio_id);

-- 회사별 조회
create index if not exists idx_portfolio_analysis_companies
  on public.portfolio_analysis using gin(companies);

-- ============================================================
-- 3단계: RLS 정책
-- ============================================================
alter table public.portfolio_analysis enable row level security;

-- 인증된 사용자: 읽기 허용
create policy "portfolio_analysis_select_authenticated"
  on public.portfolio_analysis
  for select
  to authenticated
  using (true);

-- 인증된 사용자: 삽입 허용 (관리자 확인은 서버 액션에서)
create policy "portfolio_analysis_insert_authenticated"
  on public.portfolio_analysis
  for insert
  to authenticated
  with check (true);

-- 인증된 사용자: 수정 허용 (재분석 시)
create policy "portfolio_analysis_update_authenticated"
  on public.portfolio_analysis
  for update
  to authenticated
  using (true);

-- 인증된 사용자: 삭제 허용
create policy "portfolio_analysis_delete_authenticated"
  on public.portfolio_analysis
  for delete
  to authenticated
  using (true);
