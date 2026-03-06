# Timeout 설정 가이드

## 설정된 페이지

다음 페이지들은 **5분(300초) 타임아웃**이 설정되어 있습니다:

### 1. `/analyze` - 사용자 분석 페이지
```typescript
// app/analyze/page.tsx
export const maxDuration = 300
```

### 2. `/admin` - 관리자 메인 페이지
```typescript
// app/admin/layout.tsx
export const maxDuration = 300
```

### 3. `/admin/training` - 학습 데이터 업로드
```typescript
// app/admin/training/layout.tsx
export const maxDuration = 300
```

### 4. `/admin/data` - 학습 데이터 관리
```typescript
// app/admin/data/layout.tsx
export const maxDuration = 300
```

---

## Next.js Config

`next.config.mjs`에서 업로드 크기 제한도 설정:

```javascript
experimental: {
  serverActions: {
    bodySizeLimit: '50mb',
  },
}
```

---

## 왜 이렇게 설정했나?

### 1. Server Actions는 직접 설정 불가
- `"use server"` 파일에서는 `export const maxDuration` 사용 불가
- Page나 Layout 파일에서 설정해야 함

### 2. Layout을 사용하는 이유
- Client Component 페이지는 직접 export 불가
- Layout을 만들어서 하위 모든 페이지에 적용

### 3. 5분 타임아웃이 필요한 이유
- 50MB 파일 업로드: ~30초
- Gemini AI 분석: ~1-2분
- Base64 변환 + 처리: ~30초
- 총 안전 마진: 5분

---

## 파일 크기별 예상 시간

| 파일 크기 | 예상 처리 시간 | 상태 |
|----------|--------------|------|
| 1-5MB    | 30초-1분     | ✅ 매우 안정 |
| 5-10MB   | 1-2분        | ✅ 안정 |
| 10-20MB  | 2-3분        | ⚠️ 느림 |
| 20-30MB  | 3-4분        | ⚠️ 매우 느림 |
| 30-50MB  | 4-5분        | 🚨 위험 (권장하지 않음) |

---

## 타임아웃 발생 시 해결책

### 1. 파일 압축
- PDF 압축: https://www.ilovepdf.com/compress_pdf
- 이미지 품질 낮추기: 150-300 DPI

### 2. 페이지 나누기
- 큰 PDF를 여러 개로 분할
- 각각 개별 업로드

### 3. 타임아웃 늘리기 (최후 수단)
```typescript
export const maxDuration = 600 // 10분 (Vercel Pro 플랜 필요)
```

**주의:** Vercel Free 플랜은 최대 10초, Hobby는 10초, Pro는 5분까지만 지원합니다.

---

## Vercel 배포 시 주의사항

### Vercel 플랜별 제한

| 플랜 | maxDuration | 권장 파일 크기 |
|------|------------|--------------|
| Hobby | 10초 | 1-5MB |
| Pro | 300초 (5분) | 1-50MB |
| Enterprise | 900초 (15분) | 50MB+ |

### 해결 방법
1. **Hobby 플랜 사용 시**: 파일 크기를 5MB 이하로 제한
2. **Pro 플랜 업그레이드**: 현재 설정 그대로 사용 가능
3. **대안**: Railway, Render 등 다른 호스팅 고려

---

## 환경별 설정

### 개발 환경 (로컬)
- 제한 없음
- 50MB까지 안정적

### 프로덕션 (Vercel)
- 플랜에 따라 다름
- 파일 크기 제한 권장

---

## 참고 링크

- [Next.js maxDuration 문서](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#maxduration)
- [Vercel 제한 사항](https://vercel.com/docs/functions/serverless-functions/runtimes#max-duration)
- [Server Actions 문서](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
