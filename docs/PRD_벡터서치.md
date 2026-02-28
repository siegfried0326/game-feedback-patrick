# PRD: 벡터 서치 (유사 포트폴리오 검색)

## 1. 개요

| 항목 | 내용 |
|------|------|
| 목적 | 사용자 문서 분석 시 유사한 합격 포트폴리오의 **실제 내용**을 AI에게 제공하여 분석 품질 향상 |
| 핵심 문제 | 현재 AI는 합격 포트폴리오의 메타데이터(점수, 태그, 요약)만 참고 → 구체적 비교 불가 → "같은 말만 함" |
| 해결 방법 | OpenAI 임베딩 + Supabase pgvector로 유사 콘텐츠 검색 → AI 프롬프트에 실제 내용 삽입 |
| 임베딩 모델 | OpenAI text-embedding-3-small (1536차원, ~$0.02/1M 토큰) |
| DB | Supabase pgvector (portfolio_chunks 테이블) |
| 마지막 갱신 | 2026-02-28 |

## 2. 아키텍처

```
[기존 흐름]
포트폴리오 업로드 → Gemini 분석 → portfolios 테이블 (메타데이터만)
사용자 분석 → portfolios에서 통계/샘플 로드 → Claude에 메타데이터만 전달

[변경 흐름]
포트폴리오 업로드 → Gemini 분석 → portfolios 테이블 + content_text 저장
                  → 텍스트 청킹 → OpenAI 임베딩 → portfolio_chunks 테이블

사용자 분석 → 사용자 문서 텍스트 일부 → OpenAI 임베딩 → pgvector 유사도 검색
           → 유사한 포트폴리오 실제 내용 발췌 → Claude 프롬프트에 추가
```

## 3. 데이터 흐름

### 3.1 임베딩 저장 (관리자 업로드 시)

```
1. 관리자가 포트폴리오 업로드 (PDF/Excel/CSV/TXT)
2. Gemini AI가 분석 → 점수/태그/요약 저장 (기존)
3. [신규] content_text 저장:
   - 스프레드시트: parseExcelToText() 결과 저장
   - PDF/이미지: 메타데이터 문자열 (요약 + 강점 + 약점) 저장
4. [신규] 텍스트를 800자 단위로 청킹 (100자 겹침)
5. [신규] 각 청크 → OpenAI 임베딩 (1536차원 벡터)
6. [신규] portfolio_chunks 테이블에 저장
```

### 3.2 벡터 검색 (사용자 분석 시)

```
1. 사용자 문서 텍스트 확보:
   - analyzeUrlDirect: pageContent (URL/텍스트 추출 결과)
   - analyzeDocumentDirect: 서버사이드 텍스트 추출 시도
2. 텍스트 앞부분 ~2000자 → OpenAI 임베딩 생성
3. portfolio_chunks에서 코사인 유사도 검색 (상위 5개)
4. 검색 결과의 chunk_text를 시스템 프롬프트에 추가
5. Claude가 실제 합격 포트폴리오 내용과 비교하여 분석
```

## 4. DB 테이블

### 4.1 portfolio_chunks (신규)

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID (PK) | 청크 ID |
| portfolio_id | UUID (FK → portfolios) | 원본 포트폴리오 ID |
| chunk_index | integer | 청크 순서 번호 |
| chunk_text | text | 청크 텍스트 (800자 단위) |
| embedding | vector(1536) | OpenAI 임베딩 벡터 |
| metadata | jsonb | 추가 메타데이터 (회사명, 문서유형 등) |
| created_at | timestamptz | 생성일 |

### 4.2 인덱스

| 인덱스 | 타입 | 용도 |
|--------|------|------|
| idx_portfolio_chunks_embedding | HNSW (vector_cosine_ops) | 벡터 유사도 검색 |
| idx_portfolio_chunks_portfolio_id | btree | 포트폴리오별 조회 |

### 4.3 RPC 함수

```sql
match_portfolio_chunks(query_embedding, match_threshold, match_count)
→ 유사도 기준으로 포트폴리오 청크 검색
→ 반환: id, portfolio_id, chunk_text, similarity
```

## 5. 코드 파일

| 파일 | 역할 |
|------|------|
| `lib/openai-embedding.ts` | OpenAI API로 텍스트 → 벡터 변환 |
| `lib/vector-search.ts` | 청킹, 임베딩 저장, 유사도 검색 |
| `app/actions/admin.ts` | 관리자 업로드 시 임베딩 자동 생성 (수정) |
| `app/actions/analyze.ts` | 분석 시 벡터 검색 연동 (수정) |
| `scripts/011_add_vector_search.sql` | pgvector 활성화 + 테이블/인덱스/RPC 생성 |

## 6. 환경변수

| 변수명 | 용도 |
|--------|------|
| `OPENAI_API_KEY` | OpenAI 임베딩 API 키 (text-embedding-3-small) |

## 7. 청킹 전략

| 설정 | 값 | 이유 |
|------|-----|------|
| 청크 크기 | 800자 | 너무 작으면 의미 손실, 너무 크면 검색 정밀도 하락 |
| 겹침 | 100자 | 문장이 청크 경계에서 잘리는 문제 방지 |
| 최소 청크 | 50자 | 의미 없는 짧은 조각 제외 |
| 구분점 | 줄바꿈, 마침표 | 문장/문단 경계에서 자르기 우선 |

## 8. 프롬프트 변경

### 기존 시스템 프롬프트 구성

```
1. 역할 설명 (11년차 기획자)
2. 학습 데이터 통계 (전체 평균, 회사별 평균)
3. 샘플 12개 (메타데이터: 점수, 강점, 약점, 요약)
4. 평가 기준 (15개 카테고리)
```

### 추가되는 부분

```
[3.5 신규] 📝 유사 합격 포트폴리오 실제 내용 발췌
- 벡터 검색으로 찾은 상위 5개 유사 청크
- 각 청크: 원본 파일명 + 실제 텍스트 내용 (800자)
- AI가 이 실제 내용과 사용자 문서를 직접 비교 가능
```

## 9. 기존 포트폴리오 처리

| 상황 | 처리 방법 |
|------|-----------|
| content_text 있는 경우 | 그대로 청킹 + 임베딩 |
| content_text 없는 경우 | 메타데이터 조합 (요약 + 강점 + 약점 + 태그) → 임베딩 |
| 신규 업로드 (스프레드시트) | parseExcelToText() 결과 → content_text 저장 + 임베딩 |
| 신규 업로드 (PDF/이미지) | 메타데이터 → 임베딩 (향후 텍스트 추출 추가 예정) |

## 10. 알려진 제한

| 항목 | 설명 |
|------|------|
| PDF 텍스트 추출 | 관리자 업로드 시 PDF 원본 텍스트 추출 미구현 (파일 삭제됨) |
| analyzeDocumentDirect | 파일이 base64로 전달되어 텍스트 추출 어려움 → 벡터 검색 스킵 |
| 기존 포트폴리오 | content_text 미저장 → 메타데이터 기반 임베딩 (정밀도 낮음) |
| 관리자 재업로드 시 | 새 코드로 content_text 저장 → 임베딩 품질 향상 |

## 11. 향후 개선

1. **서버사이드 PDF 텍스트 추출**: 관리자 업로드 시 pdfjs-dist로 텍스트 추출 → content_text 저장
2. **analyzeDocumentDirect 벡터 검색**: 서버에서 PDF 텍스트 추출 → 벡터 검색 가능
3. **임베딩 모델 업그레이드**: text-embedding-3-large (3072차원) 전환 가능
4. **하이브리드 검색**: 벡터 검색 + 키워드 검색 결합
5. **자동 재임베딩**: 포트폴리오 업데이트 시 자동으로 청크 재생성
