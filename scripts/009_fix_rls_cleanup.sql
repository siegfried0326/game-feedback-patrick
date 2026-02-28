-- ============================================================
-- RLS 정리 스크립트 (008이 실제 정책 이름과 달라서 재실행)
-- 실제 Supabase에 있는 정책 이름 기준으로 삭제 + 재생성
-- ============================================================

-- ==========================================
-- 1. Storage: 위험한 정책 삭제 (실제 이름)
-- ==========================================
DROP POLICY IF EXISTS "Anyone can delete" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload" ON storage.objects;
-- 혹시 008에서 만들어졌을 수 있는 것도 정리
DROP POLICY IF EXISTS "resumes_storage_insert_auth" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_update_auth" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_delete_auth" ON storage.objects;

-- 인증된 사용자만 허용하는 새 정책
CREATE POLICY "resumes_storage_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

CREATE POLICY "resumes_storage_update_auth" ON storage.objects
  FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

CREATE POLICY "resumes_storage_delete_auth" ON storage.objects
  FOR DELETE USING (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- ==========================================
-- 2. Portfolios: 위험한 정책 삭제 (실제 이름)
-- ==========================================
DROP POLICY IF EXISTS "portfolios_delete_service" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_insert_service" ON public.portfolios;
-- 008에서 잘못 만들어진 것도 정리
DROP POLICY IF EXISTS "portfolios_delete_authenticated" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_insert_authenticated" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_update_authenticated" ON public.portfolios;

-- 인증된 사용자만 허용하는 새 정책
CREATE POLICY "portfolios_insert_authenticated" ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "portfolios_update_authenticated" ON public.portfolios
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "portfolios_delete_authenticated" ON public.portfolios
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 3. analysis_history DELETE (이미 있으면 무시)
-- ==========================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'analysis_history' AND policyname = 'analysis_history_delete_own'
  ) THEN
    CREATE POLICY "analysis_history_delete_own" ON public.analysis_history
      FOR DELETE USING (auth.uid() = user_id);
  END IF;
END
$$;

-- ==========================================
-- 확인 쿼리 (이 아래는 별도로 실행)
-- ==========================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('portfolios', 'objects', 'analysis_history')
-- ORDER BY tablename, cmd;
