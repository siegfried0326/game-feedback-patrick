-- ============================================================
-- 크레딧 시스템 추가 (가격 구조 개편)
-- ============================================================

-- 1. users_subscription에 크레딧 컬럼 추가
ALTER TABLE public.users_subscription
  ADD COLUMN IF NOT EXISTS analysis_credits integer DEFAULT 1;

-- 2. 기존 사용자 크레딧 초기화
-- 이미 분석을 한 무료 사용자 → 0
-- 아직 안 쓴 무료 사용자 → 1 (DEFAULT로 이미 적용)
UPDATE public.users_subscription us
SET analysis_credits = 0
WHERE plan = 'free'
  AND EXISTS (
    SELECT 1 FROM public.analysis_history ah
    WHERE ah.user_id = us.user_id
  );

-- 유료 구독자는 크레딧 무관 (무제한이므로 0으로)
UPDATE public.users_subscription
SET analysis_credits = 0
WHERE plan IN ('monthly', 'three_month', 'tutoring');

-- 3. 크레딧 주문 테이블
CREATE TABLE IF NOT EXISTS public.credit_orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  package_type text NOT NULL,
  credits integer NOT NULL,
  amount integer NOT NULL,
  order_id text UNIQUE NOT NULL,
  payment_key text,
  payment_status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- 4. RLS 활성화
ALTER TABLE public.credit_orders ENABLE ROW LEVEL SECURITY;

-- 본인 주문만 조회
CREATE POLICY "credit_orders_select_own" ON public.credit_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 인증된 사용자만 주문 생성
CREATE POLICY "credit_orders_insert_auth" ON public.credit_orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 인증된 사용자만 주문 수정 (결제 확인용)
CREATE POLICY "credit_orders_update_auth" ON public.credit_orders
  FOR UPDATE USING (auth.uid() IS NOT NULL);
