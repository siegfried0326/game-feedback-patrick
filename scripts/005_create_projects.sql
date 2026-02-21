-- =============================================
-- 005: 프로젝트 시스템 생성
-- 같은 주제의 문서를 프로젝트로 그룹화
-- =============================================

-- 1. projects 테이블 생성
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 인덱스
create index idx_projects_user_id on public.projects(user_id);

-- RLS 활성화
alter table public.projects enable row level security;

create policy "users_read_own_projects" on public.projects
  for select using (auth.uid() = user_id);

create policy "users_insert_own_projects" on public.projects
  for insert with check (auth.uid() = user_id);

create policy "users_update_own_projects" on public.projects
  for update using (auth.uid() = user_id);

create policy "users_delete_own_projects" on public.projects
  for delete using (auth.uid() = user_id);

-- 2. analysis_history에 project_id 컬럼 추가
alter table public.analysis_history
  add column project_id uuid references public.projects(id) on delete cascade;

create index idx_analysis_history_project_id on public.analysis_history(project_id);

-- 3. 기존 데이터 마이그레이션 (이미 분석한 기록이 있는 경우)
-- 각 analysis_history row에 대해 프로젝트를 자동 생성하고 연결
do $$
declare
  rec record;
  new_project_id uuid;
begin
  for rec in
    select id, user_id, file_name, analyzed_at
    from public.analysis_history
    where project_id is null
  loop
    -- 프로젝트 생성
    insert into public.projects (user_id, name, created_at, updated_at)
    values (rec.user_id, rec.file_name, rec.analyzed_at, rec.analyzed_at)
    returning id into new_project_id;

    -- analysis_history에 연결
    update public.analysis_history
    set project_id = new_project_id
    where id = rec.id;
  end loop;
end $$;
