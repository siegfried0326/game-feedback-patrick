-- 021: 합격 포트폴리오 기준 카드 + 원문 텍스트 재구축
-- 실행: Supabase SQL Editor에서 실행 (020을 안 돌렸어도 단독 실행 가능)
--
-- 배경 (data/standards/README.md):
-- - 비교 재료를 "Gemini가 쓴 요약·강점·약점"에서 "원문 + 기준 카드"로 교체한다.
-- - 기준 카드 = 합격 문서에서 '있는 것, 합격 수준인 이유'만 뽑은 JSON. 약점은 뽑지 않는다.
-- - 데이터는 scripts/seed-standards.mjs가 채운다 (서비스 롤 키 필요).

-- 1. 직군 (020과 동일 — 이미 있으면 건너뜀)
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS design_domain text
    CHECK (design_domain IS NULL OR design_domain IN ('level','combat','system','economy','uiux','narrative','data','general'));
CREATE INDEX IF NOT EXISTS idx_portfolios_design_domain ON public.portfolios(design_domain);

-- 2. 기준 카드
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS standard_card jsonb,          -- data/standards/cards/<id>.json (내부 식별 필드 제외)
  ADD COLUMN IF NOT EXISTS anon_label text,              -- 사용자 출력용 익명 구조 설명 (게임명·고유명·사람 이름 없음)
  ADD COLUMN IF NOT EXISTS card_status text DEFAULT 'none'
    CHECK (card_status IN ('none','draft','reviewed')),  -- none: 카드 없음 / draft: Claude 작성 / reviewed: Patrick 검수 완료
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.portfolios(id) ON DELETE SET NULL,  -- 같은 문서를 다른 회사에 낸 사본이면 원본 id
  ADD COLUMN IF NOT EXISTS content_source text;          -- content_text 출처: 'original_2026-10' (원문 추출, 개인정보 제거)

COMMENT ON COLUMN public.portfolios.standard_card IS '합격 기준 카드: structure, artifacts, depth, why_it_works, standard_elements, excerpt_pages';
COMMENT ON COLUMN public.portfolios.duplicate_of IS '중복 행이면 원본 portfolios.id. 비교군·통계에서 중복 제거용';

-- 3. analysis_history (020과 동일 — 이미 있으면 건너뜀)
ALTER TABLE public.analysis_history
  ADD COLUMN IF NOT EXISTS design_domain text,
  ADD COLUMN IF NOT EXISTS model_tier text DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS token_usage jsonb;

-- 4. 재임베딩 준비: 기존 청크(Gemini 요약문으로 만든 것)를 지운다.
--    seed-standards.mjs 실행 후 관리자 페이지 → "임베딩 생성"을 눌러 원문 기준으로 다시 만든다.
--    (seed 전에 지워도 분석은 동작한다 — 벡터 검색만 잠시 비어 있음)
-- DELETE FROM public.portfolio_chunks;   ← seed 완료 확인 후 주석 해제해서 실행
