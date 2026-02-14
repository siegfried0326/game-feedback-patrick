-- 기존 테이블과 정책을 모두 삭제하고 처음부터 다시 시작하는 스크립트
-- 주의: 데이터가 모두 삭제됩니다!

-- 정책 삭제
drop policy if exists "portfolios_select_public" on public.portfolios;
drop policy if exists "portfolios_insert_service" on public.portfolios;
drop policy if exists "portfolios_update_service" on public.portfolios;
drop policy if exists "portfolios_delete_service" on public.portfolios;

-- 뷰 삭제
drop view if exists public.company_stats;
drop view if exists public.overall_stats;

-- 테이블 삭제
drop table if exists public.portfolios;

-- 이제 001_create_portfolios.sql을 실행하세요!
