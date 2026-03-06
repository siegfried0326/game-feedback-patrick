-- 014: credit_orders 테이블에 환불 관련 컬럼 추가
-- 실행: Supabase SQL Editor에서 실행

ALTER TABLE public.credit_orders
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount integer;

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'credit_orders'
ORDER BY ordinal_position;
