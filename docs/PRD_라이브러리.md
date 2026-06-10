# PRD — 게임 디자인 라이브러리 통합

> 작성: 2026-05-13
> 상태: v1 (정적 라우트 + 그래프 뷰 + analyze 통합 완료)

## 1. 배경

`/Users/hee/Documents/GameDesignLibrary` (Obsidian Vault, 998개 .md)를 Archive187에 통합하여
사이트를 **문서피드백 + 면접 + 게임 라이브러리** 통합 서비스로 확장.

## 2. 데이터 파이프라인

```
Obsidian Vault (.md, 998+ files)
        │
        ▼  scripts/import-library.mjs
content/library/*.json   (정적, git commit)
   ├ index.json          요약 인덱스 + 통계
   ├ documents.json      전체 본문 (14 MB)
   ├ by-type/*.json      타입별 본문 분할
   ├ alias-map.json      위키링크 → ID 해석 (2,971 키)
   └ graph.json          노드 1,243 · 엣지 8,310
        │
        ▼  scripts/seed-library-db.mjs (선택)
Supabase library_documents 테이블
        │
        ▼  scripts/embed-library.mjs
Supabase library_chunks (vector(1536) — text-embedding-3-small)
        │
        ▼  searchSimilarLibraryContent()
app/actions/analyze.ts 시스템 프롬프트 주입
```

## 3. 데이터 통계 (현재 임포트 기준)

| 영역 | 수량 |
|---|---|
| 총 문서 | **1,243편** |
| 원칙 (principle) | 331 (전투 27 · 시스템 118 · 내러티브 69 · 레벨 55 · 프로덕션 61) |
| 디자이너 | 84 |
| 패턴 | 33 |
| 안티패턴 | 21 |
| 학습 경로 | 13 |
| 사상 계보 | 10 |
| 장르 가이드 | 10 |
| 핵심 규칙 | 10 |
| 출처 | 236 |
| GDC 강연 | 470 |
| 레벨 디자인 보강 | 19 |
| 색인 | 6 |
| Alias 키 | 2,971 |
| 그래프 엣지 | 8,310 |
| Preview 공개 | 10 |

## 4. 라우트

| URL | 페이지 | 비고 |
|---|---|---|
| `/library` | 홈 — 통계·도메인 5축·카테고리 카드·preview 공개·최근 갱신 | SSR (캐시) |
| `/library/[type]` | 타입별 목록 + 도메인/preview 필터 + 검색 | 동적 |
| `/library/[type]/[slug]` | 문서 상세 — 마크다운 본문(위키링크 내부 변환) + 메타 사이드바 + 백링크/정방향 링크 | 동적 |
| `/library/graph` | Obsidian 풍 force graph (react-force-graph-2d) — 좌측 필터, 우측 노드 패널 | 클라이언트 |
| `/library/search` | 통합 검색 — 키워드 + 타입 + 도메인 + preview 필터 | 클라이언트 |
| `/api/library/graph` | 노드/엣지 JSON 전달 (필터 지원) | GET |
| `/api/library/search` | 키워드 검색 결과 | GET |

`type` URL 세그먼트: `principles · designers · patterns · antipatterns · paths · lineage · genres · core · gdc · sources · level-design`

## 5. 위키링크 변환 규칙

본문의 `[[target]]` / `[[target|display]]` 패턴은:
1. `alias-map.json`에서 ID 해석 → 내부 `/library/...` 링크로 변환
2. 미해결은 굵게 표시 (외부 또는 누락)

해석 우선순위 키: principleId > aliases > slug > title > titleEn > nameKo

## 6. 그래프 뷰

- 노드 색상: 도메인별(원칙) 또는 타입별
- 노드 크기 = 연결도(엣지 카운트)
- 좌측 패널: 타입·도메인 토글 필터, 검색
- 우측 패널: 클릭한 노드 상세 + "상세 보기" 링크
- 캔버스: 마우스 휠 줌, 드래그 이동, 라벨은 globalScale ≥ 1.5에서만 표시

## 7. analyze.ts 통합

분석 시 사용자 문서 텍스트를 임베딩하여 `library_chunks`에서 의미적으로 가까운 원칙·패턴·안티패턴·핵심규칙·장르가이드를 5~6개 매칭, 시스템 프롬프트에 주입.

Claude는 본문 안에서 `[PRIN-CMB-SK001-risk-reward]` 같은 라벨로 원칙을 인용할 수 있다 — 추후 대시보드에서 클릭 시 라이브러리로 이동 가능 (UI 추가는 별도 작업).

```ts
const libResult = await searchSimilarLibraryContent(text, {
  matchCount: 5,
  matchThreshold: 0.35,
  types: ["principle", "pattern", "antipattern", "core_rule", "genre_guide"],
})
```

## 8. 운영

### 동기화 (Patrick이 Vault 갱신 후)

```bash
npm run library:sync
# = library:import + library:seed + library:embed
```

또는 단계별:

```bash
npm run library:import     # Vault → content/library/*.json
npm run library:seed       # JSON → Supabase library_documents
npm run library:embed      # → library_chunks (text-embedding-3-small)
```

`library:seed` / `library:embed`는 `--env-file=.env.local`을 자동 사용 (Node 22+).
필요 환경변수:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

### Vault 위치

기본: `~/Documents/GameDesignLibrary`. 다른 위치면 `GAME_DESIGN_LIBRARY_PATH` 환경변수로.

### 마이그레이션

`scripts/018_create_library.sql` — Supabase SQL Editor에서 1회 실행.
포함:
- `library_documents` 테이블 + 인덱스(type, domain, preview, tags, designers, games_referenced GIN)
- `library_chunks` 테이블 + HNSW 코사인 인덱스
- `match_library_chunks` RPC (types/domains 필터 옵션)
- RLS 공개 read 정책
- `library_document_stats` 뷰

## 9. 임베딩 비용 추산

- text-embedding-3-small: $0.02 / 1M 토큰
- 1,243 문서 × 평균 1,500자 ≈ 47만 토큰
- **약 $0.01** (1회 임베딩, 거의 무료)

## 10. 향후 확장

- [ ] 분석 결과 대시보드에서 인용 원칙 카드 노출 (categories[].references[])
- [ ] 학습 경로 / 사상 계보 / 장르 가이드 전용 페이지 디자인 (현재는 공통 detail 페이지)
- [ ] 검색에 벡터(의미) 모드 토글 추가
- [ ] preview: true 정책 — 비공개 문서를 구독자에게만 노출하는 게이트
- [ ] 그래프 뷰 3D 모드 (react-force-graph-3d) 옵션
- [ ] GDC 강연 별도 뷰 (연도/카테고리 색인)
- [ ] 라이브러리 즐겨찾기 (user별 bookmark)
