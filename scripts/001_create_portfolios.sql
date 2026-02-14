-- 포트폴리오 메인 테이블
create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  
  -- 메타데이터 (엑셀에서 입력)
  file_name text not null,
  companies text[] not null default '{}',  -- 합격 회사들 (배열)
  year integer,
  document_type text,  -- 시스템기획, 콘텐츠기획, 레벨디자인 등
  
  -- AI 분석 결과
  overall_score integer,  -- 종합 점수 (0-100)
  logic_score integer,    -- 논리력
  specificity_score integer,  -- 구체성
  readability_score integer,  -- 가독성
  technical_score integer,    -- 기술이해
  creativity_score integer,   -- 창의성
  
  -- 특징 및 요약
  tags text[] default '{}',  -- 특징 태그들
  summary text,  -- AI가 추출한 핵심 요약
  strengths text[] default '{}',  -- 강점들
  weaknesses text[] default '{}',  -- 보완점들
  
  -- 원본 데이터
  content_text text,  -- PDF에서 추출한 텍스트
  file_url text,  -- Supabase Storage URL
  
  -- 타임스탬프
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 회사별 통계 뷰 (엔씨 합격자 평균 점수 등 조회용)
create or replace view public.company_stats as
select 
  unnest(companies) as company,
  count(*) as portfolio_count,
  round(avg(overall_score), 1) as avg_overall_score,
  round(avg(logic_score), 1) as avg_logic_score,
  round(avg(specificity_score), 1) as avg_specificity_score,
  round(avg(readability_score), 1) as avg_readability_score,
  round(avg(technical_score), 1) as avg_technical_score,
  round(avg(creativity_score), 1) as avg_creativity_score
from public.portfolios
where overall_score is not null
group by unnest(companies);

-- 전체 통계 뷰
create or replace view public.overall_stats as
select 
  count(*) as total_portfolios,
  round(avg(overall_score), 1) as avg_overall_score,
  round(avg(logic_score), 1) as avg_logic_score,
  round(avg(specificity_score), 1) as avg_specificity_score,
  round(avg(readability_score), 1) as avg_readability_score,
  round(avg(technical_score), 1) as avg_technical_score,
  round(avg(creativity_score), 1) as avg_creativity_score,
  percentile_cont(0.25) within group (order by overall_score) as percentile_25,
  percentile_cont(0.50) within group (order by overall_score) as percentile_50,
  percentile_cont(0.75) within group (order by overall_score) as percentile_75
from public.portfolios
where overall_score is not null;

-- RLS 활성화 (관리자만 접근 가능하도록 나중에 설정)
-- 지금은 public 읽기 허용
alter table public.portfolios enable row level security;

-- 누구나 읽기 가능 (분석 비교용)
create policy "portfolios_select_public" on public.portfolios 
  for select using (true);

-- 삽입/수정/삭제는 서비스 역할만 (서버에서만)
create policy "portfolios_insert_service" on public.portfolios 
  for insert with check (true);

create policy "portfolios_update_service" on public.portfolios 
  for update using (true);

create policy "portfolios_delete_service" on public.portfolios 
  for delete using (true);

-- 인덱스 (성능 최적화)
create index if not exists idx_portfolios_companies on public.portfolios using gin(companies);
create index if not exists idx_portfolios_year on public.portfolios(year);
create index if not exists idx_portfolios_overall_score on public.portfolios(overall_score);
