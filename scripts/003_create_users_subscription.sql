-- =============================================
-- 구독 관리 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 기존 테이블이 있으면 삭제 (개발 중에만 사용)
drop table if exists public.users_subscription cascade;

-- 구독 테이블 생성
create table public.users_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'monthly', 'three_month')),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired')),
  started_at timestamp with time zone default now(),
  expires_at timestamp with time zone,
  cancelled_at timestamp with time zone,
  payment_id text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),

  constraint unique_user_subscription unique (user_id)
);

-- RLS 활성화
alter table public.users_subscription enable row level security;

-- 정책: 유저는 자기 구독만 조회 가능
create policy "users_read_own_subscription" on public.users_subscription
  for select using (auth.uid() = user_id);

-- 정책: 유저는 자기 구독 생성 가능
create policy "users_insert_own_subscription" on public.users_subscription
  for insert with check (auth.uid() = user_id);

-- 정책: 유저는 자기 구독 수정 가능
create policy "users_update_own_subscription" on public.users_subscription
  for update using (auth.uid() = user_id);

-- 인덱스
create index idx_users_subscription_user_id on public.users_subscription(user_id);
create index idx_users_subscription_status on public.users_subscription(status);

-- 완료 메시지
select 'users_subscription 테이블 생성 완료!' as result;
