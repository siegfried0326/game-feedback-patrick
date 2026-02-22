-- analysis_history 테이블에 company_feedback 컬럼 추가
alter table public.analysis_history
  add column if not exists company_feedback text default '';
