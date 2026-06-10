# Archive187 — Claude Code 작업 규칙

> 새 대화 시작 시 먼저 `docs/START_HERE.md` 읽기. 이 파일은 코드 작성 시 지켜야 할 규약.

## 프로젝트 정체성

11년차 현업 게임 기획자(Patrick)가 만든 **게임 기획 포트폴리오 AI 피드백 + 면접 연습 + 게임 디자인 라이브러리** 통합 서비스.

- 187개 합격 포트폴리오 학습 데이터 기반 AI 분석
- Claude AI(Sonnet)가 15개 카테고리로 점수·랭킹·피드백
- 면접 연습 모드 (Patrick 캐릭터)
- **게임 디자인 라이브러리** — Obsidian Vault(998+ .md) 임포트, 그래프 뷰, 분석 시 자동 인용

## 기술 스택

| 영역 | 기술 |
|---|---|
| 프론트/백 | Next.js 16 (App Router, Server Actions), React 19, TailwindCSS 4 |
| UI | shadcn/ui (new-york), Geist 폰트, recharts, react-force-graph-2d |
| DB | Supabase (PostgreSQL + pgvector) |
| AI 분석 | Anthropic Claude Sonnet (단일) |
| AI 학습 | Gemini 2.0 Flash (관리자 포트폴리오 분석) |
| AI 임베딩 | OpenAI text-embedding-3-small (1536d) |
| 결제 | TossPayments (일반 + 빌링키) |
| 배포 | Vercel (maxDuration=300) |

## 작업 규칙

### 빌드
- 커밋 전 반드시 `npx next build` 로컬 통과 확인
- TypeScript strict — 새 코드는 any 금지. 기존 strict 위반 코드(analyze.ts, admin/training, projects, mypage 등)는 별도 정리 대상

### 코드 위치
- Server Actions: `app/actions/*.ts` — `"use server"` + `getUser()` 인증 체크
- API Route: `app/api/.../route.ts` — `maxDuration` 명시(필요 시)
- 컴포넌트: `components/*.tsx` (shadcn UI는 `components/ui/`)
- 라이브러리 헬퍼: `lib/*.ts`
- 라이브러리 데이터: `lib/library/*` + `components/library/*` + `app/library/*` + `content/library/*.json`
- DB 마이그레이션: `scripts/NNN_*.sql` (다음 번호 = 019)

### 디자인 토큰
- Background: `#0a1628`
- Card: `#0d1f3c`
- Primary: `#5B8DEF`
- Border: `#1e3a5f`
- 폰트: `Geist` / `Geist Mono`
- 경로 별칭: `@/*` → repo root

### 커밋
- 한글 메시지, prefix: `feat:` / `fix:` / `perf:` / `docs:` / `refactor:`
- 예: `feat: 게임 디자인 라이브러리 통합 (1,243 문서)`

### 문서 동시 갱신
- 가격 변경 → `docs/PRD_가격표_요금제.md` **먼저**
- 분석 로직 변경 → `docs/PRD_문서분석.md`
- 라이브러리 변경 → `docs/PRD_라이브러리.md`
- 신규 라우트 → `docs/REF_페이지라우트.md`
- 변경 이력 → `docs/LOG_변경이력.md`

## 게임 디자인 라이브러리

### 원천
Patrick의 Obsidian Vault: `~/Documents/GameDesignLibrary`
관련 작업 규칙은 `~/Documents/GameDesignLibrary/CLAUDE.md` 참조 (원칙 작성 규칙·디자이너 코드·도메인).

### 통합 흐름

```bash
npm run library:sync   # 일괄 동기화
# OR 단계별:
npm run library:import # Vault → content/library/*.json
npm run library:seed   # JSON → Supabase library_documents
npm run library:embed  # → library_chunks (벡터 임베딩)
```

### 라우트
`/library`, `/library/[type]`, `/library/[type]/[slug]`, `/library/graph`, `/library/search`

타입 URL 세그먼트:
`principles · designers · patterns · antipatterns · paths · lineage · genres · core · gdc · sources · level-design`

### 위키링크 규칙
`content/library/alias-map.json`이 모든 alias(원칙 ID, 한글 단축, 디자이너 이름, 영문 풀네임, frontmatter aliases 필드)를 ID로 매핑.

새 원칙·디자이너 추가 시:
1. Vault에서 작성 (CLAUDE.md 규약 준수)
2. `npm run library:sync` 실행
3. 변경 commit
4. Vercel 배포 자동

## 절대 금지

- `git config` 변경
- 사용자 명시 없이 destructive git (force push, reset --hard, branch -D 등)
- 훅 우회 (`--no-verify`)
- `.env.local`을 커밋
- `content/library/` 안의 14MB JSON을 README.md처럼 본문에 인용

## 주요 환경변수

```
NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY     # 라이브러리 시드/임베딩 스크립트용
ANTHROPIC_API_KEY             # Claude 분석
GOOGLE_GENERATIVE_AI_API_KEY  # Gemini 학습 데이터 분석
OPENAI_API_KEY                # 벡터 임베딩
TOSS_SECRET_KEY / NEXT_PUBLIC_TOSS_CLIENT_KEY
JINA_API_KEY                  # URL 텍스트 추출 폴백
ADMIN_EMAILS                  # 쉼표 구분 관리자
GAMECANVAS_DISCOUNT_CODES     # 할인 코드
GAME_DESIGN_LIBRARY_PATH      # Vault 위치 (기본 ~/Documents/GameDesignLibrary)
```
