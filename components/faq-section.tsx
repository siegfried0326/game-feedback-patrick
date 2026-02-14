"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    question: "어떤 문서에 대해 피드백을 받을 수 있나요?",
    answer: "시스템 기획서, 콘텐츠 기획서, 레벨 디자인 문서, UI/UX 기획서 등 게임 기획과 관련된 모든 문서에 대해 피드백을 받으실 수 있습니다. 포트폴리오용 기획서부터 면접 준비용 샘플 문서까지 모두 가능합니다."
  },
  {
    question: "피드백은 얼마나 상세하게 제공되나요?",
    answer: "단순히 '이 부분을 수정하세요'가 아닌, '왜 수정해야 하는지', '어떻게 수정하면 좋을지'를 구체적으로 설명드립니다. 문서의 논리적 흐름, 표현 방식, 현업 관점에서의 개선점 등을 종합적으로 피드백합니다."
  },
  {
    question: "무료 체험은 어떻게 이용하나요?",
    answer: "상담하기 버튼을 통해 문의해 주시면 첫 1회 무료 피드백을 받으실 수 있습니다. 무료 체험 후 마음에 드시면 구독을 시작하시면 됩니다."
  },
  {
    question: "피드백 받기까지 얼마나 걸리나요?",
    answer: "문서 업로드 후 24시간 내에 피드백을 전달해 드립니다. 복잡한 문서의 경우 조금 더 시간이 걸릴 수 있으나, 미리 안내해 드립니다."
  },
  {
    question: "PATRICK 강의와 어떤 관계인가요?",
    answer: "PATRICK 게임 기획 강의에서 제공하는 동일한 품질의 피드백을 구독 서비스로 제공합니다. 강의를 수강하지 않으셔도 피드백 서비스만 단독으로 이용하실 수 있습니다."
  },
  {
    question: "수정한 문서도 다시 피드백 받을 수 있나요?",
    answer: "네, 구독 기간 동안 무제한으로 문서를 업로드하고 피드백을 받으실 수 있습니다. 피드백을 반영하여 수정한 문서도 다시 검토받으실 수 있어 지속적인 개선이 가능합니다."
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
