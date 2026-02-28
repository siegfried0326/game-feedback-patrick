-- ============================================================
-- RLS 보안 강화 마이그레이션 (2026-02-28)
--
-- 문제: portfolios 테이블과 storage가 with check (true)로
--       인증 없이 누구나 INSERT/UPDATE/DELETE 가능했음
-- 수정: 인증된 사용자만 허용하도록 변경
-- ============================================================

-- ==========================================
-- 1. portfolios 테이블 RLS 강화
-- ==========================================

-- 기존 위험한 정책 삭제
DROP POLICY IF EXISTS "portfolios_insert_service" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_update_service" ON public.portfolios;
DROP POLICY IF EXISTS "portfolios_delete_service" ON public.portfolios;

-- SELECT: 기존 유지 (분석 비교용 공개 읽기)
-- "portfolios_select_public" 은 그대로 둠

-- INSERT: 인증된 사용자만 (서버 액션에서 verifyAdmin()으로 추가 확인)
CREATE POLICY "portfolios_insert_authenticated" ON public.portfolios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 인증된 사용자만
CREATE POLICY "portfolios_update_authenticated" ON public.portfolios
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- DELETE: 인증된 사용자만
CREATE POLICY "portfolios_delete_authenticated" ON public.portfolios
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ==========================================
-- 2. Storage (resumes 버킷) RLS 강화
-- ==========================================

-- 기존 위험한 정책 삭제
DROP POLICY IF EXISTS "resumes_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "resumes_storage_delete" ON storage.objects;

-- SELECT: 기존 유지 (공개 읽기)
-- "resumes_storage_select" 은 그대로 둠

-- INSERT: 인증된 사용자만
CREATE POLICY "resumes_storage_insert_auth" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- UPDATE: 인증된 사용자만
CREATE POLICY "resumes_storage_update_auth" ON storage.objects
  FOR UPDATE USING (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- DELETE: 인증된 사용자만
CREATE POLICY "resumes_storage_delete_auth" ON storage.objects
  FOR DELETE USING (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- ==========================================
-- 3. analysis_history DELETE 정책 추가
-- (deleteAnalysis 함수가 작동하려면 필요)
-- ==========================================
CREATE POLICY IF NOT EXISTS "analysis_history_delete_own" ON public.analysis_history
  FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 완료 확인용 쿼리 (실행 후 정책 확인)
-- ==========================================
-- SELECT schemaname, tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE tablename IN ('portfolios', 'objects')
-- ORDER BY tablename, cmd;
