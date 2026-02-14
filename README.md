# 게임 기획 포트폴리오 분석 서비스

AI를 활용한 게임 기획 포트폴리오 자동 분석 및 피드백 서비스입니다.

## 🚀 주요 기능

- **AI 포트폴리오 분석**: Gemini AI가 PDF 원본을 직접 읽고 5가지 항목으로 평가
- **합격자 데이터 비교**: 실제 합격자 포트폴리오와 비교 분석
- **상세 피드백**: 강점, 보완점, 구체적인 개선 방향 제시
- **통계 대시보드**: 회사별, 분야별 평균 점수 확인

## 📦 기술 스택

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui
- **Backend**: Next.js Server Actions
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **AI**: Google Gemini 2.0 Flash

## 🔧 설치 및 실행

### 1. 프로젝트 클론 및 의존성 설치

```bash
pnpm install
```

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Gemini API 설정
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key
```

자세한 설정 방법은 [SETUP.md](./SETUP.md)를 참고하세요.

### 3. Supabase 데이터베이스 설정

Supabase Dashboard의 SQL Editor에서 다음 스크립트를 순서대로 실행:

1. `scripts/001_create_portfolios.sql` - 테이블 및 뷰 생성
2. `scripts/002_create_storage.sql` - Storage 정책 설정

### 4. Storage 버킷 생성

Supabase Dashboard > Storage에서 `resumes` 버킷을 생성하세요 (Public bucket으로 설정).

### 5. 개발 서버 실행

```bash
pnpm dev
```

`http://localhost:3000`에서 확인할 수 있습니다.

## 🧪 연결 테스트

개발 서버 실행 후, 다음 URL로 Supabase 연결 상태를 확인할 수 있습니다:

```
http://localhost:3000/api/test-connection
```

성공적으로 연결되면 데이터베이스 및 Storage 상태를 확인할 수 있습니다.

## 📁 프로젝트 구조

```
├── app/
│   ├── actions/          # Server Actions
│   │   ├── admin.ts      # 관리자 기능 (업로드, 분석)
│   │   └── analyze.ts    # 사용자 분석 기능
│   ├── admin/            # 관리자 페이지
│   ├── analyze/          # 분석 페이지
│   └── api/              # API 라우트
├── components/           # React 컴포넌트
│   └── ui/               # shadcn/ui 컴포넌트
├── lib/
│   └── supabase/         # Supabase 클라이언트 및 유틸리티
│       ├── client.ts     # 브라우저 클라이언트
│       ├── server.ts     # 서버 클라이언트
│       ├── types.ts      # TypeScript 타입
│       └── portfolios.ts # 포트폴리오 DB 유틸리티
└── scripts/              # SQL 스크립트
```

## 🎯 사용 방법

### 관리자 - 포트폴리오 학습 데이터 추가

1. `/admin` 페이지 접속
2. 합격 포트폴리오 PDF 파일 드래그 앤 드롭
3. "AI 분석 시작" 버튼 클릭
4. AI가 자동으로 분석하고 데이터베이스에 저장

### 사용자 - 내 포트폴리오 분석

1. 메인 페이지에서 "지금 분석하기" 클릭
2. 포트폴리오 PDF 업로드
3. 희망 회사 선택
4. AI 분석 결과 및 합격자 비교 확인

## 📊 AI 평가 항목

1. **논리력** (Logic): 문제 → 해결 → 결과의 논리적 흐름
2. **구체성** (Specificity): 수치, 데이터, 구체적 사례 활용
3. **가독성** (Readability): 문서 구조, 시각적 정리
4. **기술이해** (Technical): 게임 개발 기술에 대한 이해도
5. **창의성** (Creativity): 독창적이고 혁신적인 아이디어

## 🔒 보안

- RLS (Row Level Security) 활성화로 데이터 보호
- 환경 변수로 민감 정보 관리
- Storage 정책으로 파일 접근 제어

## 📝 라이선스

이 프로젝트는 개인 프로젝트입니다.

## 🤝 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.
