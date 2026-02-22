-- =============================================
-- 구독 테이블에 빌링 관련 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 빌링키 (토스페이먼츠 자동결제용)
ALTER TABLE public.users_subscription
  ADD COLUMN IF NOT EXISTS billing_key text,
  ADD COLUMN IF NOT EXISTS customer_key text,
  ADD COLUMN IF NOT EXISTS tutoring_enabled boolean DEFAULT false;

-- 완료 메시지
SELECT '빌링 컬럼 추가 완료!' AS result;
