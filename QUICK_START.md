# ⚡ 빠른 시작 가이드

5분 안에 프로젝트를 시작하는 방법입니다.

---

## 🎯 핵심 페이지 3개만 기억하세요!

### 1️⃣ 학습 데이터 업로드
```
http://localhost:3000/admin/training
```
→ 합격 포트폴리오를 업로드해서 AI를 학습시킵니다

### 2️⃣ 학습 데이터 관리
```
http://localhost:3000/admin/data
```
→ 학습된 데이터를 확인하고 삭제합니다

### 3️⃣ 포트폴리오 분석
```
http://localhost:3000/analyze
```
→ 사용자가 자신의 포트폴리오를 분석합니다

---

## 📋 체크리스트

### 초기 설정 (한 번만)
- [ ] `.env.local` 파일 생성 완료
- [ ] Supabase 테이블 생성 완료 (SQL 실행)
- [ ] Supabase Storage 버킷(`resumes`) 생성 완료
- [ ] `npm install` 완료

### 서버 실행
```bash
npm run dev
```

### 테스트
- [ ] http://localhost:3000 접속 확인
- [ ] http://localhost:3000/api/test-connection 에서 "success: true" 확인

---

## 🎬 첫 사용 시나리오

### STEP 1: 학습 데이터 추가
1. `http://localhost:3000/admin/training` 접속
2. 합격 포트폴리오 PDF 파일 드래그 앤 드롭 (5-10개)
3. "학습 시작" 버튼 클릭
4. 완료될 때까지 대기 (파일당 1-2분)

### STEP 2: 학습 데이터 확인
1. `http://localhost:3000/admin/data` 접속
2. 업로드한 파일들이 보이는지 확인
3. 점수와 태그가 정상적으로 추출되었는지 확인

### STEP 3: 분석 테스트
1. `http://localhost:3000/analyze` 접속
2. 테스트용 포트폴리오 업로드
3. 희망 회사 선택
4. 분석 결과 확인

---

## 🚨 문제 발생 시

### 1. 서버가 안 열릴 때
```bash
# 터미널에서 프로젝트 폴더로 이동
cd "/Users/hee/Library/Mobile Documents/com~apple~CloudDocs/Dev/game-feedback-landing-page"

# 서버 실행
npm run dev
```

### 2. DB 연결 안 될 때
```
http://localhost:3000/api/test-connection
```
이 주소에서 에러 메시지 확인

### 3. 파일 업로드 실패 시
- 파일 크기 확인 (50MB 이하)
- PDF 압축 시도: https://www.ilovepdf.com/compress_pdf

---

## 📱 전체 페이지 목록

상세 내용은 `PAGES.md` 파일 참고!

```
/                       → 메인 페이지
/analyze                → 포트폴리오 분석
/admin                  → 관리자 메인
/admin/training         → 학습 데이터 업로드 ⭐
/admin/data             → 학습 데이터 관리 ⭐
/api/test-connection    → DB 연결 테스트
```

---

## ✅ 완료!

이제 서비스를 사용할 준비가 되었습니다! 🎉
