/**
 * 벡터 서치 인프라 구축
 *
 * pgvector 확장 활성화 + portfolio_chunks 테이블 생성
 * OpenAI text-embedding-3-small (1536차원) 임베딩 저장용
 *
 * 실행 방법:
 * 1. Supabase 대시보드 → SQL Editor 열기
 * 2. 아래 SQL을 전체 복사하여 붙여넣기
 * 3. "Run" 클릭
 * 4. "Success" 메시지 확인
 *
 * 주의: pgvector 확장이 이미 활성화되어 있으면 무시됨 (if not exists)
 */

-- ============================================================
-- 1단계: pgvector 확장 활성화
-- ============================================================
create extension if not exists vector;

-- ============================================================
-- 2단계: portfolio_chunks 테이블 생성
-- 포트폴리오 텍스트를 청크로 나누어 벡터와 함께 저장
-- ============================================================
create table if not exists public.portfolio_chunks (
  id uuid primary key default gen_random_uuid(),

  -- 원본 포트폴리오 참조 (삭제 시 청크도 자동 삭제)
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,

  -- 청크 정보
  chunk_index integer not null,           -- 청크 순서 (0부터)
  chunk_text text not null,               -- 청크 텍스트 (800자 단위)

  -- OpenAI text-embedding-3-small 임베딩 (1536차원)
  embedding vector(1536),

  -- 추가 메타데이터 (회사명, 문서유형 등)
  metadata jsonb default '{}',

  -- 타임스탬프
  created_at timestamptz default now()
);

-- ============================================================
-- 3단계: 인덱스 생성
-- ============================================================

-- HNSW 인덱스: 빠른 코사인 유사도 검색 (ANN 근사 최근접 이웃)
create index if not exists idx_portfolio_chunks_embedding
  on public.portfolio_chunks
  using hnsw (embedding vector_cosine_ops);

-- 포트폴리오별 청크 조회용 인덱스
create index if not exists idx_portfolio_chunks_portfolio_id
  on public.portfolio_chunks(portfolio_id);

-- ============================================================
-- 4단계: RLS (Row Level Security) 정책
-- ============================================================
alter table public.portfolio_chunks enable row level security;

-- 인증된 사용자: 읽기 허용 (분석 시 벡터 검색에 필요)
create policy "portfolio_chunks_select_authenticated"
  on public.portfolio_chunks
  for select
  to authenticated
  using (true);

-- 인증된 사용자: 삽입 허용 (관리자 확인은 서버 액션에서)
create policy "portfolio_chunks_insert_authenticated"
  on public.portfolio_chunks
  for insert
  to authenticated
  with check (true);

-- 인증된 사용자: 삭제 허용 (관리자 확인은 서버 액션에서)
create policy "portfolio_chunks_delete_authenticated"
  on public.portfolio_chunks
  for delete
  to authenticated
  using (true);

-- ============================================================
-- 5단계: 유사도 검색 RPC 함수
-- Supabase에서 rpc("match_portfolio_chunks", ...) 로 호출
-- ============================================================
create or replace function public.match_portfolio_chunks(
  query_embedding vector(1536),   -- 검색할 벡터
  match_threshold float default 0.3,  -- 최소 유사도 (0~1, 높을수록 엄격)
  match_count int default 5           -- 반환할 최대 결과 수
)
returns table (
  id uuid,
  portfolio_id uuid,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    pc.id,
    pc.portfolio_id,
    pc.chunk_text,
    1 - (pc.embedding <=> query_embedding) as similarity
  from public.portfolio_chunks pc
  where pc.embedding is not null
    and 1 - (pc.embedding <=> query_embedding) > match_threshold
  order by pc.embedding <=> query_embedding
  limit match_count;
$$;
