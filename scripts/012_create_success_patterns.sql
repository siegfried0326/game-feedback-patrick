/**
 * 합격자 공통점 패턴 테이블
 *
 * 187개 포트폴리오 청크 텍스트를 Claude가 분석하여
 * 합격자들의 공통 특징 100가지를 추출·저장.
 *
 * 카테고리: general(일반 공통점) / 회사명(회사별 특징)
 *
 * 실행 방법:
 * 1. Supabase 대시보드 → SQL Editor 열기
 * 2. 아래 SQL을 전체 복사하여 붙여넣기
 * 3. "Run" 클릭
 * 4. "Success" 메시지 확인
 */

-- ============================================================
-- 1단계: success_patterns 테이블 생성
-- ============================================================
create table if not exists public.success_patterns (
  id uuid primary key default gen_random_uuid(),

  -- 패턴 정보
  pattern_number integer not null,            -- 패턴 번호 (1~100)
  category text not null default 'general',   -- 'general' 또는 회사명 (넥슨, 엔씨소프트 등)
  title text not null,                        -- 패턴 제목 (한 줄 요약)
  description text not null,                  -- 패턴 상세 설명
  importance text default 'medium',           -- 중요도: high / medium / low
  example_files text[],                       -- 해당 패턴을 보여주는 포트폴리오 파일명

  -- 메타
  batch_id text,                              -- 같은 분석 세션의 패턴 그룹화용
  created_at timestamptz default now()
);

-- ============================================================
-- 2단계: 인덱스 생성
-- ============================================================
create index if not exists idx_success_patterns_category
  on public.success_patterns(category);

create index if not exists idx_success_patterns_batch
  on public.success_patterns(batch_id);

-- ============================================================
-- 3단계: RLS 정책
-- ============================================================
alter table public.success_patterns enable row level security;

-- 모든 인증된 사용자: 읽기 허용 (공개 데이터)
create policy "success_patterns_select_authenticated"
  on public.success_patterns
  for select
  to authenticated
  using (true);

-- 인증된 사용자: 삽입/삭제 허용 (관리자 확인은 서버 액션에서)
create policy "success_patterns_insert_authenticated"
  on public.success_patterns
  for insert
  to authenticated
  with check (true);

create policy "success_patterns_delete_authenticated"
  on public.success_patterns
  for delete
  to authenticated
  using (true);
