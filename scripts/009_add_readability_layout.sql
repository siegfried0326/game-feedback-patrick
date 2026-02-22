-- analysis_history 테이블에 가독성/레이아웃/분석소스 컬럼 추가
ALTER TABLE public.analysis_history
  ADD COLUMN IF NOT EXISTS analysis_source text DEFAULT 'pdf',
  ADD COLUMN IF NOT EXISTS readability_categories jsonb,
  ADD COLUMN IF NOT EXISTS layout_recommendations jsonb;
