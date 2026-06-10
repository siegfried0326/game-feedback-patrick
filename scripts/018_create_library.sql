-- 018_create_library.sql
-- 게임 디자인 라이브러리 (Obsidian Vault → DB)
--   library_documents: 문서 메타 + 본문
--   library_chunks: 본문을 청킹한 텍스트 + OpenAI 임베딩 (vector(1536))
--   match_library_chunks: 코사인 유사도 RPC
--
-- 실행: Supabase SQL Editor에서 한 번 실행
-- 의존성: 011_add_vector_search.sql (pgvector 확장 활성화)

-- ─────────────────────────────────────────────────────────────────────
-- 1. library_documents

CREATE TABLE IF NOT EXISTS library_documents (
  id            TEXT PRIMARY KEY,             -- "principle:전투-SK001-위험과보상"
  slug          TEXT NOT NULL,
  type          TEXT NOT NULL,                -- principle | designer | pattern | ...
  domain        TEXT,                          -- 전투 | 시스템 | 내러티브 | 레벨 | 프로덕션
  title         TEXT NOT NULL,
  title_en      TEXT,
  principle_id  TEXT,                          -- "PRIN-CMB-SK001-risk-reward"
  status        TEXT,
  preview       BOOLEAN NOT NULL DEFAULT false,
  body          TEXT NOT NULL,
  body_length   INT NOT NULL DEFAULT 0,
  frontmatter   JSONB NOT NULL DEFAULT '{}'::jsonb,
  tags          TEXT[] DEFAULT ARRAY[]::TEXT[],
  designers     TEXT[] DEFAULT ARRAY[]::TEXT[],
  games_referenced TEXT[] DEFAULT ARRAY[]::TEXT[],
  aliases       TEXT[] DEFAULT ARRAY[]::TEXT[],
  vault_path    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  vault_created TEXT,
  vault_updated TEXT
);

CREATE INDEX IF NOT EXISTS idx_library_documents_type ON library_documents(type);
CREATE INDEX IF NOT EXISTS idx_library_documents_domain ON library_documents(domain);
CREATE INDEX IF NOT EXISTS idx_library_documents_preview ON library_documents(preview);
CREATE INDEX IF NOT EXISTS idx_library_documents_tags ON library_documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_library_documents_designers ON library_documents USING GIN(designers);
CREATE INDEX IF NOT EXISTS idx_library_documents_games ON library_documents USING GIN(games_referenced);

-- ─────────────────────────────────────────────────────────────────────
-- 2. library_chunks (pgvector 임베딩)
--   - portfolio_chunks와 동일 패턴
--   - vector(1536) — text-embedding-3-small

CREATE TABLE IF NOT EXISTS library_chunks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_document_id TEXT NOT NULL REFERENCES library_documents(id) ON DELETE CASCADE,
  chunk_index     INT NOT NULL,
  chunk_text      TEXT NOT NULL,
  embedding       VECTOR(1536),
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_library_chunks_doc ON library_chunks(library_document_id);
-- HNSW 코사인 유사도 인덱스
CREATE INDEX IF NOT EXISTS idx_library_chunks_embedding
  ON library_chunks USING hnsw (embedding vector_cosine_ops);

-- ─────────────────────────────────────────────────────────────────────
-- 3. RPC: 라이브러리 유사도 검색

CREATE OR REPLACE FUNCTION match_library_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.3,
  match_count INT DEFAULT 5,
  filter_types TEXT[] DEFAULT NULL,
  filter_domains TEXT[] DEFAULT NULL
) RETURNS TABLE (
  id UUID,
  library_document_id TEXT,
  chunk_text TEXT,
  similarity FLOAT,
  doc_title TEXT,
  doc_type TEXT,
  doc_domain TEXT,
  doc_slug TEXT,
  principle_id TEXT,
  preview BOOLEAN
) LANGUAGE sql STABLE AS $$
  SELECT
    c.id,
    c.library_document_id,
    c.chunk_text,
    1 - (c.embedding <=> query_embedding) AS similarity,
    d.title,
    d.type,
    d.domain,
    d.slug,
    d.principle_id,
    d.preview
  FROM library_chunks c
  JOIN library_documents d ON d.id = c.library_document_id
  WHERE
    c.embedding IS NOT NULL
    AND (filter_types  IS NULL OR d.type   = ANY(filter_types))
    AND (filter_domains IS NULL OR d.domain = ANY(filter_domains))
    AND 1 - (c.embedding <=> query_embedding) >= match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ─────────────────────────────────────────────────────────────────────
-- 4. RLS: 공개 read, admin write

ALTER TABLE library_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_chunks    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_documents read all" ON library_documents;
CREATE POLICY "library_documents read all"
  ON library_documents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "library_chunks read all" ON library_chunks;
CREATE POLICY "library_chunks read all"
  ON library_chunks FOR SELECT
  USING (true);

-- write/update/delete는 service_role 키로만 허용 (RLS 미정의 = service_role bypass)

-- ─────────────────────────────────────────────────────────────────────
-- 5. updated_at 자동 갱신 트리거

CREATE OR REPLACE FUNCTION trg_library_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS library_documents_updated_at ON library_documents;
CREATE TRIGGER library_documents_updated_at
  BEFORE UPDATE ON library_documents
  FOR EACH ROW EXECUTE FUNCTION trg_library_documents_updated_at();

-- ─────────────────────────────────────────────────────────────────────
-- 6. 검증 뷰 (관리자 대시보드용)

CREATE OR REPLACE VIEW library_document_stats AS
SELECT
  type,
  domain,
  COUNT(*) AS doc_count,
  COUNT(*) FILTER (WHERE preview) AS preview_count,
  COUNT(*) FILTER (WHERE status = 'published') AS published_count
FROM library_documents
GROUP BY type, domain
ORDER BY type, domain NULLS LAST;
