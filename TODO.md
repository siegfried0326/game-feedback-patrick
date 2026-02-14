# 🎯 당신이 해야 할 일 (3단계만!)

## 1️⃣ .env.local 파일 만들기

프로젝트 폴더에 `.env.local` 파일을 만들고 아래 내용을 복사하세요:

```
NEXT_PUBLIC_SUPABASE_URL=여기에_수파베이스_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=여기에_수파베이스_키
GOOGLE_GENERATIVE_AI_API_KEY=여기에_제미나이_키
```

**어디서 가져오나요?**
- Supabase: https://supabase.com/dashboard → 프로젝트 선택 → Settings → API
- Gemini: https://aistudio.google.com/app/apikey

---

## 2️⃣ Supabase에서 테이블 만들기

1. https://supabase.com/dashboard 접속
2. 프로젝트 선택
3. 왼쪽 메뉴에서 **SQL Editor** 클릭
4. 아래 파일 내용을 복사해서 붙여넣고 **Run** 클릭

**실행할 파일**: `scripts/001_create_portfolios.sql`

---

## 3️⃣ Supabase에서 파일 저장소 만들기

1. 왼쪽 메뉴에서 **Storage** 클릭
2. **New bucket** 버튼 클릭
3. 이름: `resumes` 입력
4. **Public bucket** 체크 ✓
5. **Create bucket** 버튼 클릭

---

## ✅ 끝! 이제 실행하세요

```bash
npm install    # 처음 한 번만
npm run dev    # 서버 시작
```

브라우저에서 http://localhost:3000 열기

---

## 🧪 잘 되는지 확인하기

http://localhost:3000/api/test-connection 열어보세요

`"success": true` 라고 나오면 성공! 🎉
