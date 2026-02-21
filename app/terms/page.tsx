import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "이용약관 | 게임 기획 문서 피드백",
  description: "게임 기획 문서 피드백 서비스의 이용약관 안내",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0d1b2a] text-slate-300">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          홈으로 돌아가기
        </Link>

        <h1 className="text-3xl font-bold text-white mb-2">이용약관</h1>
        <p className="text-sm text-slate-500 mb-10">최종 수정일: 2025년 1월 1일</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>
              본 약관은 문라이트커리어랩(이하 &quot;회사&quot;)이 제공하는 게임 기획 문서 피드백 서비스(이하 &quot;서비스&quot;)의
              이용과 관련하여 회사와 이용자 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (서비스의 내용)</h2>
            <p>회사는 다음과 같은 서비스를 제공합니다.</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>AI 기반 게임 기획 문서 분석 및 피드백</li>
              <li>게임사별 합격자 포트폴리오 점수 비교 분석</li>
              <li>5개 항목(논리력, 구체성, 가독성, 기술이해, 창의성) 점수 평가</li>
              <li>강점 및 개선점 피드백 제공</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (서비스 이용)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>서비스는 웹사이트를 통해 제공됩니다.</li>
              <li>이용자는 PDF, DOCX, PPTX 등의 형식으로 문서를 업로드할 수 있습니다.</li>
              <li>AI 분석 결과는 업로드 후 즉시 제공됩니다.</li>
              <li>최대 업로드 파일 크기는 50MB입니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (요금 및 결제)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>무료 체험: 1회 무료 분석 제공</li>
              <li>월 구독: 월 17,900원 - 무제한 문서 분석</li>
              <li>3개월 패스: 49,000원 - 3개월간 무제한 문서 분석</li>
              <li>결제는 토스페이먼츠를 통해 처리됩니다.</li>
              <li>구독은 언제든지 해지할 수 있으며, 해지 시 다음 결제일부터 과금이 중단됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (이용자의 의무)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>이용자는 본인의 저작물 또는 업로드 권한이 있는 문서만 업로드해야 합니다.</li>
              <li>타인의 저작권을 침해하는 문서를 업로드해서는 안 됩니다.</li>
              <li>서비스를 통해 제공받은 피드백을 상업적으로 재판매할 수 없습니다.</li>
              <li>서비스의 정상적인 운영을 방해하는 행위를 해서는 안 됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (회사의 의무)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>회사는 안정적인 서비스 제공을 위해 최선을 다합니다.</li>
              <li>이용자가 업로드한 문서는 분석 목적으로만 사용되며, 제3자에게 제공되지 않습니다.</li>
              <li>서비스 장애 발생 시 신속하게 복구하도록 노력합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (개인정보 보호)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>회사는 이용자의 개인정보를 관련 법령에 따라 보호합니다.</li>
              <li>업로드된 문서는 분석 완료 후 서버에 보관되며, 이용자 요청 시 삭제합니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제8조 (서비스 제공 기간)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>월 구독: 결제일로부터 1개월</li>
              <li>3개월 패스: 결제일로부터 3개월</li>
              <li>서비스 최대 제공기간은 결제일로부터 3개월을 초과하지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제9조 (환불)</h2>
            <p>
              환불에 관한 사항은{" "}
              <Link href="/refund-policy" className="text-[#5B8DEF] hover:underline">
                환불정책
              </Link>
              에 따릅니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제10조 (면책 조항)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>AI 분석 결과는 참고 자료이며, 실제 채용 결과를 보장하지 않습니다.</li>
              <li>천재지변, 시스템 장애 등 불가항력적 사유로 인한 서비스 중단에 대해 회사는 책임을 지지 않습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제11조 (분쟁 해결)</h2>
            <p>
              서비스 이용과 관련하여 분쟁이 발생한 경우, 회사와 이용자는 상호 협의하여 해결하며,
              협의가 이루어지지 않을 경우 관할 법원에 소를 제기할 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제12조 (문의)</h2>
            <p>서비스 이용 관련 문의는 아래 채널을 통해 접수해주세요.</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                채널톡:{" "}
                <a
                  href="https://desk.channel.io/#/channels/227321/team_chats/groups/536162"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5B8DEF] hover:underline"
                >
                  문의하기
                </a>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}
