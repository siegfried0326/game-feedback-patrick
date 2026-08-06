-- 019: BM 개편(과외 중심) — 수강생 플래그 + 크레딧 지급 이력 + 빌링키 정리
-- 실행: Supabase SQL Editor에서 실행

-- 1. 수강생 플래그 (관리자가 /admin/students에서 지정)
ALTER TABLE public.users_subscription
  ADD COLUMN IF NOT EXISTS is_student boolean DEFAULT false;

-- 2. 크레딧 지급 이력 (관리자 수동 지급 기록)
CREATE TABLE IF NOT EXISTS public.credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by text NOT NULL,          -- 지급한 관리자 이메일
  credits integer NOT NULL,           -- 지급량 (음수 = 회수)
  note text,                          -- 메모 (예: "2026-08 정기 지급")
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_grants_user_id ON public.credit_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_grants_created_at ON public.credit_grants(created_at DESC);

-- RLS: 본인 지급 이력만 조회 가능. 쓰기는 서비스롤(관리자 서버 액션)만.
ALTER TABLE public.credit_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_grants_select_own" ON public.credit_grants;
CREATE POLICY "credit_grants_select_own" ON public.credit_grants
  FOR SELECT USING (auth.uid() = user_id);

-- 3. 구독 판매 종료에 따른 빌링키 정리 (자동결제 데이터 차원 차단)
--    cron 제거 + 코드 가드에 더해, 데이터 자체를 비워 3중 방어.
UPDATE public.users_subscription
SET auto_renewal = false,
    billing_key = NULL,
    updated_at = now()
WHERE billing_key IS NOT NULL OR auto_renewal = true;

-- 확인
SELECT 'is_student 컬럼' AS item, COUNT(*) AS cnt FROM information_schema.columns
  WHERE table_name = 'users_subscription' AND column_name = 'is_student'
UNION ALL
SELECT 'credit_grants 테이블', COUNT(*) FROM information_schema.tables
  WHERE table_name = 'credit_grants'
UNION ALL
SELECT '남은 빌링키(0이어야 정상)', COUNT(*) FROM public.users_subscription WHERE billing_key IS NOT NULL;
