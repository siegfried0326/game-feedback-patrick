-- Storage 버킷 생성 (대시보드에서 이미 생성한 경우 이 부분은 스킵)
-- 버킷 이름: resumes (포트폴리오 파일 저장용)
-- Public bucket으로 설정

-- Storage 정책: 누구나 읽기 가능
create policy "resumes_storage_select"
on storage.objects for select
using (bucket_id = 'resumes');

-- Storage 정책: 인증된 사용자만 업로드 가능
create policy "resumes_storage_insert_auth"
on storage.objects for insert
with check (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- Storage 정책: 인증된 사용자만 업데이트 가능
create policy "resumes_storage_update_auth"
on storage.objects for update
using (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);

-- Storage 정책: 인증된 사용자만 삭제 가능
create policy "resumes_storage_delete_auth"
on storage.objects for delete
using (bucket_id = 'resumes' AND auth.uid() IS NOT NULL);
