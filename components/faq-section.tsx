/**
 * FAQ 섹션 — 랜딩 페이지 (76줄)
 *
 * 자주 묻는 질문 아코디언.
 * 학습 데이터, 분석 시간, 파일 형식, 요금제 관련 Q&A.
 * 사용: app/(landing)/page.tsx
 */
"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "어떤 문서에 대해 분석을 받을 수 있나요?",
    answer: "시스템 기획서, 콘텐츠 기획서, 레벨 디자인 문서, UI/UX 기획서 등 게임 기획과 관련된 모든 문서를 분석할 수 있습니다. PDF, Word, PPT, Excel 파일은 물론 노션이나 웹 포트폴리오 URL 링크도 분석 가능합니다."
  },
  {
    question: "AI 분석은 어떻게 이루어지나요?",
    answer: "합격 포트폴리오 187개를 학습한 AI가 문서를 즉시 분석합니다. 구조, 논리, 창의성, 실현성, 표현력 5개 영역을 레이더 차트로 보여주고, 종합 점수와 S~D 등급을 부여합니다. 각 영역별 강점과 개선점도 상세히 피드백합니다."
  },
  {
    question: "무료로 이용할 수 있나요?",
    answer: "네! 회원가입 후 무료 플랜으로 프로젝트 1개를 생성하고 분석을 받을 수 있습니다. 같은 프로젝트 내에서 문서를 수정해 다시 분석하는 것도 가능합니다."
  },
  {
    question: "프로젝트가 뭔가요?",
    answer: "프로젝트는 같은 주제의 문서를 모아두는 폴더입니다. 예를 들어 'A사 지원용 기획서'라는 프로젝트를 만들고, 수정할 때마다 재업로드하면 점수 변화를 추적할 수 있습니다. 무료 플랜은 1개, 구독 시 무제한으로 프로젝트를 만들 수 있습니다."
  },
  {
    question: "분석 결과는 얼마나 걸리나요?",
    answer: "문서를 업로드하면 AI가 즉시 분석합니다. 보통 30초~1분 이내에 점수, 등급, 레이더 차트, 상세 피드백까지 모두 확인할 수 있습니다."
  },
  {
    question: "내 문서 데이터는 안전한가요?",
    answer: "네, 안전합니다. 모든 데이터는 암호화되어 저장되며, 관리자를 포함한 다른 누구도 회원님의 문서와 분석 결과를 열람할 수 없습니다. 본인만 접근 가능합니다."
  },
  {
    question: "구독은 언제든지 해지할 수 있나요?",
    answer: "네, 언제든지 해지 가능합니다. 해지 후에도 남은 구독 기간 동안은 서비스를 계속 이용하실 수 있습니다."
  }
]

export function FAQSection() {
  return (
    <section id="faq" className="py-20 px-6 bg-[#0d1f3c]">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-[#5B8DEF] text-sm font-medium tracking-wide uppercase mb-4 block">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 text-balance">
            자주 묻는 질문
          </h2>
          <p className="text-slate-400">
            궁금한 점이 있으시면 언제든지 문의해 주세요
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-slate-900/80 border border-[#1e3a5f] rounded-xl px-6 data-[state=open]:border-[#5B8DEF]/30"
            >
              <AccordionTrigger className="text-left text-white hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-slate-400 pb-5 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
