# Supabase 연결 체크리스트

프로젝트를 실행하기 전에 다음 항목들을 확인하세요.

## ✅ 필수 설정 항목

### 1. 환경 변수 설정

- [ ] `.env.local` 파일이 프로젝트 루트에 생성되어 있나요?
- [ ] `NEXT_PUBLIC_SUPABASE_URL`이 설정되어 있나요?
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`가 설정되어 있나요?
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY`가 설정되어 있나요?

### 2. Supabase 프로젝트 설정

- [ ] Supabase 계정이 있나요?
- [ ] 새 프로젝트를 생성했나요?
- [ ] 프로젝트 URL과 Anon Key를 복사했나요?

### 3. 데이터베이스 설정

- [ ] `scripts/001_create_portfolios.sql`을 SQL Editor에서 실행했나요?
- [ ] `portfolios` 테이블이 생성되었나요?
- [ ] `company_stats`, `overall_stats` 뷰가 생성되었나요?

### 4. Storage 설정

- [ ] `resumes` 버킷을 생성했나요?
- [ ] Public bucket으로 설정했나요?
- [ ] `scripts/002_create_storage.sql`을 실행했나요?

### 5. 의존성 설치

- [ ] `pnpm install`을 실행했나요?
- [ ] 에러 없이 설치가 완료되었나요?

## 🧪 테스트

### 연결 테스트

```bash
pnpm dev
```

개발 서버 실행 후:

1. 브라우저에서 `http://localhost:3000/api/test-connection` 접속
2. 다음 항목들이 모두 정상인지 확인:
   - [ ] `success: true`
   - [ ] `database.connected: true`
   - [ ] `storage.resumesBucket: "exists"`

### 기능 테스트

1. **관리자 페이지** (`http://localhost:3000/admin`)
   - [ ] 페이지가 정상적으로 로드되나요?
   - [ ] 파일 업로드가 가능한가요?
   - [ ] AI 분석이 정상적으로 실행되나요?
   - [ ] 데이터베이스에 저장되나요?

2. **분석 페이지** (`http://localhost:3000/analyze`)
   - [ ] 페이지가 정상적으로 로드되나요?
   - [ ] 포트폴리오 업로드가 가능한가요?
   - [ ] 분석 결과가 정상적으로 표시되나요?

## 🚨 문제 해결

### 데이터베이스 연결 실패

- `.env.local` 파일의 URL과 Key를 다시 확인하세요
- Supabase Dashboard에서 프로젝트가 활성화되어 있는지 확인하세요
- 개발 서버를 재시작해보세요 (`Ctrl+C` 후 `pnpm dev`)

### Storage 오류

- `resumes` 버킷이 생성되어 있는지 확인하세요
- Public bucket으로 설정되어 있는지 확인하세요
- RLS 정책이 올바르게 설정되어 있는지 확인하세요

### AI 분석 실패

- `GOOGLE_GENERATIVE_AI_API_KEY`가 올바른지 확인하세요
- Gemini API 할당량을 초과하지 않았는지 확인하세요
- 파일 크기가 50MB 이하인지 확인하세요

### 일반적인 오류

- 브라우저 콘솔과 터미널의 에러 메시지를 확인하세요
- `node_modules`를 삭제하고 `pnpm install`을 다시 실행해보세요
- Next.js 캐시를 삭제하세요: `rm -rf .next`

## 📚 추가 리소스

- [Supabase 공식 문서](https://supabase.com/docs)
- [Next.js 공식 문서](https://nextjs.org/docs)
- [Gemini API 문서](https://ai.google.dev/docs)
- [프로젝트 설정 가이드](./SETUP.md)

## ✨ 모든 설정이 완료되었나요?

모든 항목을 체크했다면 프로젝트를 사용할 준비가 완료되었습니다! 🎉

문제가 발생하면 위의 "문제 해결" 섹션을 참고하거나 이슈를 등록해주세요.
