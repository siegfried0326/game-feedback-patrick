-- 면접 연습용 질문 테이블
-- 600개 질문 (6개 카테고리 × 100개): 공통질문, 시스템기획, UI기획, 전투스킬기획, 캐릭터 및 몬스터기획, 레벨디자인
-- 실행: Supabase SQL Editor에서 순서대로 016 → 017

CREATE TABLE IF NOT EXISTS interview_questions (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('초급', '중급', '고급')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 카테고리 + id 조회 최적화
CREATE INDEX IF NOT EXISTS idx_interview_questions_category ON interview_questions(category);

-- RLS: 모든 인증된 사용자가 읽기만 가능 (쓰기는 관리자 서버 액션만)
ALTER TABLE interview_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interview_questions_select_all" ON interview_questions;
CREATE POLICY "interview_questions_select_all" ON interview_questions
  FOR SELECT USING (true);

-- INSERT/UPDATE/DELETE는 service_role(서버 액션)만 가능
-- (별도 정책 없음 → 기본적으로 차단됨)

COMMENT ON TABLE interview_questions IS '면접 연습용 질문 DB (600개). /interview 페이지에서 사용.';
