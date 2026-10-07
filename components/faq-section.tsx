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
    answer: "AI가 문서의 직군(레벨·전투·시스템·UI/UX 등)을 먼저 파악하고, 같은 직군 합격 문서들이 갖춘 요소와 비교해 채점합니다. 종합 점수와 합격 문서 기준 위치(초안 단계~합격 상위), 직군별 15개 항목 점수, 강점·보완점, 다음에 할 일을 알려드립니다. 지원 회사를 고르면 그 회사 기준 분석을 맨 앞에 보여드립니다."
  },
  {
    question: "무료로 이용할 수 있나요?",
    answer: "네! 회원가입하면 첫 1회 분석을 무료로 받을 수 있습니다. 이후에는 크레딧(1회 3,900원부터)으로 분석하며, 크레딧은 만료되지 않습니다."
  },
  {
    question: "프로젝트가 뭔가요?",
    answer: "프로젝트는 지원하는 회사나 포트폴리오 단위로 문서를 모아두는 폴더입니다. 예를 들어 'A사 지원용 포트폴리오' 안에 기획서별 문서를 두고, 수정본을 다시 분석하면 이전 버전 대비 점수 변화를 바로 볼 수 있습니다. 프로젝트는 무료로 만들 수 있습니다."
  },
  {
    question: "분석 결과는 얼마나 걸리나요?",
    answer: "보통 1~2분이면 점수, 합격 문서 기준 위치, 항목별 피드백까지 모두 확인할 수 있습니다. 정밀 분석은 조금 더 걸립니다."
  },
  {
    question: "내 문서 데이터는 안전한가요?",
    answer: "네, 안전합니다. 모든 데이터는 암호화되어 저장되며, 관리자를 포함한 다른 누구도 회원님의 문서와 분석 결과를 열람할 수 없습니다. 본인만 접근 가능합니다."
  },
  {
    question: "크레딧은 어떻게 쓰이나요?",
    answer: "기본 분석 1크레딧, 정밀 분석 2크레딧이 차감되고, 40쪽이 넘는 문서는 40쪽마다 1크레딧이 추가됩니다. 남은 크레딧은 화면 오른쪽 위에 항상 보이고, 누르면 바로 충전할 수 있습니다. 사용하지 않은 크레딧은 결제 후 7일 이내 환불됩니다."
  }
]

export function FAQSection() {
  return (
    <section id="faq" className="py-20 px-6 bg-card">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16">
          <span className="text-primary text-sm font-medium tracking-wide uppercase mb-4 block">
            FAQ
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-4 text-balance">
            자주 묻는 질문
          </h2>
          <p className="text-muted-foreground">
            궁금한 점이 있으시면 언제든지 문의해 주세요
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {faqs.map((faq, index) => (
            <AccordionItem
              key={index}
              value={`item-${index}`}
              className="bg-card border border-border rounded-xl px-6 data-[state=open]:border-primary/30"
            >
              <AccordionTrigger className="text-left text-foreground hover:no-underline py-5">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-5 leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
