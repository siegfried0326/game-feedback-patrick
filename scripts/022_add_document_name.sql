-- 022: 프로젝트 안 '문서' 단위 묶음 (2026-10-07)
-- 학생들이 같은 문서의 수정본을 파일명만 바꿔 올리는 경우가 많아, 파일명 대신 사용자가 정한 문서명으로 버전을 묶는다.
-- document_name이 비어 있으면 화면에서는 파일명(확장자 제외)으로 묶는다 — 기존 데이터는 그대로 둬도 된다.
alter table public.analysis_history
  add column if not exists document_name text;

create index if not exists idx_analysis_history_project_document
  on public.analysis_history(project_id, document_name);
