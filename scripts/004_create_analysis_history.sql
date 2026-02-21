-- =============================================
-- 분석 이력 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 기존 테이블이 있으면 삭제 (개발 중에만 사용)
drop table if exists public.analysis_history cascade;

-- 분석 이력 테이블 생성
create table public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  overall_score integer,
  categories jsonb,
  strengths text[] default '{}',
  weaknesses text[] default '{}',
  ranking jsonb,
  analyzed_at timestamp with time zone default now()
);

-- RLS 활성화
alter table public.analysis_history enable row level security;

-- 정책: 유저는 자기 이력만 조회 가능
create policy "users_read_own_history" on public.analysis_history
  for select using (auth.uid() = user_id);

-- 정책: 유저는 자기 이력 생성 가능
create policy "users_insert_own_history" on public.analysis_history
  for insert with check (auth.uid() = user_id);

-- 인덱스
create index idx_analysis_history_user_id on public.analysis_history(user_id);
create index idx_analysis_history_analyzed_at on public.analysis_history(analyzed_at desc);

-- 완료 메시지
select 'analysis_history 테이블 생성 완료!' as result;
