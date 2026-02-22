-- =============================================
-- 과외 주문 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 기존 테이블이 있으면 삭제 (개발 중에만 사용)
DROP TABLE IF EXISTS public.tutoring_orders CASCADE;

-- 과외 주문 테이블 생성
CREATE TABLE public.tutoring_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  package_type text NOT NULL CHECK (package_type IN ('1session', '3sessions', '5sessions')),
  amount integer NOT NULL,
  order_id text NOT NULL UNIQUE,
  payment_key text,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

-- RLS 활성화
ALTER TABLE public.tutoring_orders ENABLE ROW LEVEL SECURITY;

-- 정책: 유저는 자기 주문만 조회 가능
CREATE POLICY "users_read_own_tutoring_orders" ON public.tutoring_orders
  FOR SELECT USING (auth.uid() = user_id);

-- 정책: 유저는 자기 주문 생성 가능
CREATE POLICY "users_insert_own_tutoring_orders" ON public.tutoring_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 정책: 유저는 자기 주문 수정 가능
CREATE POLICY "users_update_own_tutoring_orders" ON public.tutoring_orders
  FOR UPDATE USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX idx_tutoring_orders_user_id ON public.tutoring_orders(user_id);
CREATE INDEX idx_tutoring_orders_order_id ON public.tutoring_orders(order_id);

-- 완료 메시지
SELECT 'tutoring_orders 테이블 생성 완료!' AS result;
