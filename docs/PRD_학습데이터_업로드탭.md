# PRD: 학습 데이터 업로드 탭

## 개요
- **라우트**: `/admin/training` (activeTab = "upload")
- **접근**: 관리자 전용
- **목적**: 합격 포트폴리오 파일 업로드 + AI 학습 파이프라인 실행

## 역할 정의
**"데이터 입력 + AI 학습 강화"** — 원본 파일을 받아 AI가 학습할 수 있는 형태로 변환하는 모든 작업

### 포함 기능
1. **파일 업로드**: 드래그&드롭으로 PDF/Excel/CSV/이미지 업로드
2. **Gemini AI 분석**: 업로드된 파일을 Gemini가 분석 → portfolios 테이블 저장
3. **벡터 재임베딩**: 전체 포트폴리오의 청크 재구성 + OpenAI 임베딩 재생성
4. **심층 분석**: Claude로 15개 카테고리 심층 분석 → portfolio_analysis 테이블 저장

### 포함하지 않는 기능
- 데이터 조회/검색/필터링 → 데이터 관리 탭
- 개별/일괄 삭제 → 데이터 관리 탭
- 회사 재분류 → 데이터 관리 탭

## UI 구성

### 1. 업로드 통계 (파일 선택 후 표시)
- 총 파일 / 성공 / 중복 / 실패 카운트

### 2. 드롭존
- PDF, Excel, CSV, TXT, JPG, PNG 지원 (최대 200MB)
- 파일 목록 + 상태 아이콘 (pending/uploading/analyzing/success/error/skipped)

### 3. 학습 시작 버튼
- Gemini AI 분석 실행
- 진행률 바 표시
- 실패 시 재시도 버튼

### 4. AI 학습 강화 (카드)
2열 그리드:
- **벡터 재임베딩** (초록): 메타데이터 기반 청크 재구성 + OpenAI 임베딩
  - `rebuildAllPortfolioChunks()` 10개씩 배치
  - 진행률 표시 (처리됨/전체)
- **심층 분석** (보라): Claude 15개 카테고리 심층 분석
  - `analyzePortfoliosBatch()` 5개씩 배치
  - 진행률 표시 (분석됨/전체)

## 데이터 흐름

```
파일 업로드 → Supabase Storage
       ↓
Gemini 분석 → portfolios 테이블 (점수, 요약, 강점, 약점, 태그)
       ↓
벡터 재임베딩 → portfolio_chunks 테이블 (청크 + 벡터)
       ↓
심층 분석 → portfolio_analysis 테이블 (15개 카테고리 점수)
```

## 서버 액션 (admin.ts)
- `uploadAdminFile()` — Storage 업로드
- `analyzeAndSavePortfolio()` — Gemini 분석 + DB 저장
- `rebuildAllPortfolioChunks()` — 전체 재임베딩
- `analyzePortfoliosBatch()` — Claude 심층 분석
- `getPortfolioAnalysisStats()` — 심층 분석 통계
