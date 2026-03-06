# 📱 페이지 경로 가이드

프로젝트의 모든 페이지 경로와 기능을 정리한 문서입니다.

---

## 🏠 사용자 페이지

### 1. 메인 페이지
```
http://localhost:3000
```
- 서비스 소개
- 주요 기능 안내
- CTA (Call To Action)

### 2. 포트폴리오 분석 페이지
```
http://localhost:3000/analyze
```
**기능:**
- 포트폴리오 PDF/이미지 업로드
- 희망 회사 선택
- AI 자동 분석
- 5가지 항목 점수 (논리력, 구체성, 가독성, 기술이해, 창의성)
- 합격자 평균과 비교
- 강점/보완점 피드백

**설정:**
- 타임아웃: 5분
- 최대 파일 크기: 50MB

---

## 👨‍💼 관리자 페이지

### 1. 관리자 메인
```
http://localhost:3000/admin
```
**기능:**
- 학습 데이터 통계 확인
- PDF 파일 업로드 및 AI 분석
- 포트폴리오 목록 확인
- 개별/일괄 삭제

**설정:**
- 타임아웃: 5분
- 최대 파일 크기: 50MB

### 2. 학습 데이터 업로드 ⭐
```
http://localhost:3000/admin/training
```
**기능:**
- 합격 포트폴리오 일괄 업로드
- 중복 파일 자동 체크 (이미 학습된 파일 스킵)
- 실시간 진행률 표시
- AI 자동 분석 및 DB 저장
- 성공/중복/실패 통계

**제한:**
- 최대 파일 크기: 50MB
- 타임아웃: 5분
- 권장 파일 수: 5-10개

**특징:**
- 중복 방지: 같은 파일명 자동 체크
- 학습 데이터 관리 바로가기 버튼

### 3. 학습 데이터 관리 ⭐
```
http://localhost:3000/admin/data
```
**기능:**
- 모든 학습 데이터 목록 보기
- 파일명, 회사, 점수, 태그 확인
- 개별 삭제 (휴지통 아이콘)
- 일괄 삭제 (체크박스 선택)
- 원본 파일 보기 (눈 아이콘 클릭)
- 통계 확인 (총 개수, 평균 점수)
- 새로고침 버튼

**주의:**
- ⚠️ 삭제하면 DB에서 영구 삭제
- ⚠️ Gemini AI가 해당 데이터를 더 이상 참고하지 않음

**설정:**
- 타임아웃: 5분

---

## 🔧 API 엔드포인트

### 1. Supabase 연결 테스트
```
http://localhost:3000/api/test-connection
```
**응답 예시:**
```json
{
  "success": true,
  "message": "Supabase connection successful!",
  "database": {
    "connected": true,
    "portfoliosTable": "exists"
  },
  "storage": {
    "connected": true,
    "resumesBucket": "exists",
    "allBuckets": ["resumes"]
  },
  "timestamp": "2026-01-25T..."
}
```

---

## 📂 파일 구조

```
app/
├── page.tsx                      → 메인 페이지 (/)
├── layout.tsx                    → 루트 레이아웃
├── analyze/
│   └── page.tsx                  → 분석 페이지 (/analyze)
├── admin/
│   ├── layout.tsx                → 관리자 레이아웃
│   ├── page.tsx                  → 관리자 메인 (/admin)
│   ├── training/
│   │   ├── layout.tsx            → 학습 데이터 업로드 레이아웃
│   │   └── page.tsx              → 학습 데이터 업로드 (/admin/training)
│   └── data/
│       ├── layout.tsx            → 학습 데이터 관리 레이아웃
│       └── page.tsx              → 학습 데이터 관리 (/admin/data)
├── actions/
│   ├── admin.ts                  → 관리자 Server Actions
│   └── analyze.ts                → 분석 Server Actions
└── api/
    └── test-connection/
        └── route.ts              → 연결 테스트 API
```

---

## 🎯 주요 워크플로우

### 워크플로우 1: 학습 데이터 추가
```
1. /admin/training 접속
   ↓
2. 합격 포트폴리오 PDF 업로드
   ↓
3. 중복 체크 (자동)
   ↓
4. "학습 시작" 버튼 클릭
   ↓
5. AI가 자동으로 분석 및 DB 저장
   ↓
6. 완료!
```

### 워크플로우 2: 학습 데이터 확인/삭제
```
1. /admin/data 접속
   ↓
2. 학습된 데이터 목록 확인
   ↓
3. 체크박스로 삭제할 데이터 선택
   ↓
4. "선택 삭제" 버튼 클릭
   ↓
5. DB에서 영구 삭제
```

### 워크플로우 3: 사용자 분석
```
1. /analyze 접속
   ↓
2. 자신의 포트폴리오 업로드
   ↓
3. 희망 회사 선택
   ↓
4. AI 분석 시작
   ↓
5. 결과 확인 (점수, 비교, 피드백)
```

---

## 🔗 빠른 링크

| 페이지 | 용도 | 링크 |
|--------|------|------|
| 메인 | 서비스 소개 | [localhost:3000](http://localhost:3000) |
| 분석 | 포트폴리오 분석 | [localhost:3000/analyze](http://localhost:3000/analyze) |
| 관리자 | 관리자 메인 | [localhost:3000/admin](http://localhost:3000/admin) |
| 업로드 | 학습 데이터 추가 | [localhost:3000/admin/training](http://localhost:3000/admin/training) |
| 관리 | 학습 데이터 관리 | [localhost:3000/admin/data](http://localhost:3000/admin/data) |
| 테스트 | DB 연결 확인 | [localhost:3000/api/test-connection](http://localhost:3000/api/test-connection) |

---

## ⚙️ 설정 요약

| 설정 | 값 |
|------|-----|
| 최대 파일 크기 | 50MB |
| 타임아웃 | 300초 (5분) |
| 권장 파일 크기 | 5-20MB |
| 지원 파일 형식 | PDF, DOCX, TXT, JPG, PNG |

---

## 📝 프로덕션 URL (배포 후)

배포 후에는 `localhost:3000`을 실제 도메인으로 변경하세요:

```
https://your-domain.com
https://your-domain.com/analyze
https://your-domain.com/admin/training
https://your-domain.com/admin/data
https://your-domain.com/api/test-connection
```

---

## 🚀 시작하기

1. 서버 실행:
```bash
npm run dev
```

2. 브라우저에서 접속:
```
http://localhost:3000
```

3. 관리자로 학습 데이터 추가:
```
http://localhost:3000/admin/training
```

4. 사용자 분석 테스트:
```
http://localhost:3000/analyze
```

---

## 🔐 보안 참고사항

### 관리자 페이지 보호 (TODO)
현재 `/admin/*` 경로는 인증 없이 접근 가능합니다.

**프로덕션 배포 시 추가 필요:**
- Next Auth 또는 Supabase Auth 설정
- 관리자 전용 middleware
- 비밀번호 보호

### 예시 (middleware.ts):
```typescript
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // 인증 체크 로직
  }
}
```

---

## 📞 문제 해결

### 페이지가 안 열릴 때
1. 서버가 실행 중인지 확인: `npm run dev`
2. 포트 확인: 3000번 포트 사용 중인지 확인
3. 브라우저 캐시 삭제

### API 연결 확인
```
http://localhost:3000/api/test-connection
```
이 페이지에서 DB와 Storage 연결 상태 확인

---

**마지막 업데이트:** 2026-01-25
