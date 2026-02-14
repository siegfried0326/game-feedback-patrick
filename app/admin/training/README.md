# 학습 데이터 업로드 가이드

## 📋 파일 제한 사항

### 파일 크기
- **최대 20MB** (Gemini API 제한)
- 더 큰 파일은 압축하거나 페이지를 나눠서 업로드하세요

### 지원 파일 형식
- ✅ PDF
- ✅ DOCX (Word)
- ✅ TXT
- ✅ JPG/JPEG
- ✅ PNG

## 🚨 문제 해결

### "An unexpected response was received from the server" 에러

**원인:**
1. 파일이 20MB를 초과함
2. 네트워크 타임아웃
3. Gemini API 할당량 초과

**해결 방법:**
1. 파일 크기 확인 (20MB 이하로 줄이기)
2. PDF 압축 도구 사용: https://www.ilovepdf.com/compress_pdf
3. 한 번에 너무 많은 파일(10개 이상) 업로드하지 않기
4. 각 파일 사이 3초 대기 (자동)

### 파일이 너무 클 때

**PDF 압축 방법:**
1. https://www.ilovepdf.com/compress_pdf 접속
2. PDF 파일 업로드
3. 압축 후 다운로드
4. 다시 업로드

**또는 이미지 품질 조정:**
- PDF를 이미지로 내보낼 때 해상도 낮추기
- 150-300 DPI면 충분함

## 💡 최적 사용법

### 권장 파일 크기
- 5-10MB: 최적
- 10-15MB: 양호
- 15-20MB: 가능하지만 느림

### 한 번에 업로드할 파일 수
- 5개 이하: 안정적
- 5-10개: 양호
- 10개 이상: 시간이 오래 걸림

### 타임아웃 설정
- 각 파일: 최대 5분
- 파일 간 대기: 3초
- 총 예상 시간: (파일 수 × 30초) + (파일 수 × 3초)

## 📊 예상 처리 시간

| 파일 크기 | 예상 시간 |
|----------|----------|
| 1-5MB    | 15-30초  |
| 5-10MB   | 30-60초  |
| 10-15MB  | 1-2분    |
| 15-20MB  | 2-3분    |

## ✅ 체크리스트

업로드 전 확인:
- [ ] 파일 크기가 20MB 이하인가?
- [ ] 파일 형식이 지원되는가?
- [ ] 네트워크 연결이 안정적인가?
- [ ] Gemini API 키가 설정되어 있는가?
- [ ] 한 번에 10개 이하의 파일인가?

## 🔧 설정 확인

### Next.js 설정 (next.config.mjs)
```js
experimental: {
  serverActions: {
    bodySizeLimit: '50mb', // Next.js 제한
  },
}
```

### Server Action 설정 (actions/admin.ts)
```js
export const maxDuration = 300 // 5분 타임아웃
```

### 환경 변수 (.env.local)
```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

## 📞 지원

문제가 계속되면:
1. 브라우저 콘솔 확인 (F12)
2. 서버 터미널 로그 확인
3. 파일을 더 작게 만들어서 재시도
