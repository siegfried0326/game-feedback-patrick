-- Storage 버킷 생성 (대시보드에서 이미 생성한 경우 이 부분은 스킵)
-- 버킷 이름: resumes (포트폴리오 파일 저장용)
-- Public bucket으로 설정

-- Storage 정책: 누구나 읽기 가능
create policy "resumes_storage_select"
on storage.objects for select
using (bucket_id = 'resumes');

-- Storage 정책: 서비스 역할만 업로드 가능 (서버에서만)
create policy "resumes_storage_insert"
on storage.objects for insert
with check (bucket_id = 'resumes');

-- Storage 정책: 서비스 역할만 업데이트 가능
create policy "resumes_storage_update"
on storage.objects for update
using (bucket_id = 'resumes');

-- Storage 정책: 서비스 역할만 삭제 가능
create policy "resumes_storage_delete"
on storage.objects for delete
using (bucket_id = 'resumes');
