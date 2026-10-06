-- 020: 직군(design_domain) + 모델 티어 + 토큰 사용량 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행
--
-- 배경 (docs/TASK_서비스개선_2026-10.md, docs/AUDIT_학습DB_정제_2026-10-06.md):
-- - portfolios.document_type은 187건 전부 '학습데이터'라 직군 필터에 쓸 수 없었다.
--   design_domain에 직군(level/combat/system/economy/uiux/narrative/data/general)을 넣으면
--   lib/analysis/reference.ts가 같은 직군 합격작만 비교군으로 고른다. NULL이면 파일명·태그로 추정한다.
-- - analysis_history에 어떤 직군으로, 어떤 모델 티어로, 토큰을 얼마나 써서 분석했는지 기록한다 (원가 실측용).

-- 1. 합격 포트폴리오 직군 (값은 scripts/021 정제 스크립트 또는 관리자 화면에서 채움)
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS design_domain text
    CHECK (design_domain IS NULL OR design_domain IN ('level','combat','system','economy','uiux','narrative','data','general'));

CREATE INDEX IF NOT EXISTS idx_portfolios_design_domain
  ON public.portfolios(design_domain);

-- 2. 사용자 분석 이력: 직군 / 모델 티어 / 토큰 사용량
ALTER TABLE public.analysis_history
  ADD COLUMN IF NOT EXISTS design_domain text,
  ADD COLUMN IF NOT EXISTS model_tier text DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS token_usage jsonb;

COMMENT ON COLUMN public.portfolios.design_domain IS '기획 직군: level|combat|system|economy|uiux|narrative|data|general (NULL이면 코드가 파일명·태그로 추정)';
COMMENT ON COLUMN public.analysis_history.model_tier IS 'basic(Sonnet, 1크레딧) | precision(Opus, 2크레딧)';
COMMENT ON COLUMN public.analysis_history.token_usage IS '{model, input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens, estimated_usd, estimated_krw, elapsed_ms}';
