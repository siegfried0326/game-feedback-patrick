-- =============================================
-- 자동 갱신(빌링키) 관련 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

ALTER TABLE public.users_subscription
  ADD COLUMN IF NOT EXISTS auto_renewal boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS renewal_failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS renewal_fail_count integer DEFAULT 0;

-- 완료 메시지
SELECT '자동갱신 컬럼 추가 완료!' AS result;
