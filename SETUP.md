# Supabase 설정 가이드

## 1. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Gemini API 설정 (AI 분석용)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
```

### Supabase 키 찾는 방법:
1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
2. 프로젝트 선택
3. 좌측 메뉴에서 **Settings** → **API** 클릭
4. **Project URL**과 **anon public** 키를 복사

## 2. 데이터베이스 테이블 생성

Supabase Dashboard에서:
1. 좌측 메뉴 **SQL Editor** 클릭
2. `scripts/001_create_portfolios.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣고 **Run** 버튼 클릭

이 스크립트는 다음을 생성합니다:
- `portfolios` 테이블 (포트폴리오 데이터 저장)
- `company_stats` 뷰 (회사별 통계)
- `overall_stats` 뷰 (전체 통계)
- RLS 정책 (보안 설정)

## 3. Storage 버킷 생성

Supabase Dashboard에서:
1. 좌측 메뉴 **Storage** 클릭
2. **New bucket** 버튼 클릭
3. 버킷 이름: `resumes`
4. **Public bucket** 체크 (파일 다운로드를 위해)
5. **Create bucket** 클릭

### Storage 정책 설정:
SQL Editor에서 `scripts/002_create_storage.sql`을 실행하세요.

**참고**: 코드에서 `resumes` 버킷을 사용합니다. 이미 다른 이름의 버킷을 만들었다면 코드를 수정하거나 버킷 이름을 맞춰주세요.

## 4. 연결 테스트

개발 서버를 실행하고 `/api/test-connection` 엔드포인트를 호출하여 연결을 테스트할 수 있습니다.

```bash
pnpm dev
```

브라우저에서 `http://localhost:3000/api/test-connection` 접속

## 5. 문제 해결

### 연결 오류
- `.env.local` 파일이 프로젝트 루트에 있는지 확인
- 환경 변수 값에 따옴표가 없는지 확인
- 개발 서버를 재시작 (`pnpm dev`)

### SQL 실행 오류
- 이미 테이블이 존재하는 경우 무시해도 됩니다
- 권한 오류가 발생하면 Supabase 프로젝트 소유자 계정으로 로그인했는지 확인
