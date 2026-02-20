import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "환불정책 | PATRICK 게임 기획 문서 피드백",
  description: "PATRICK 게임 기획 문서 피드백 서비스의 환불정책 안내",
}

export default function RefundPolicyPage() {
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

        <h1 className="text-3xl font-bold text-white mb-2">환불정책</h1>
        <p className="text-sm text-slate-500 mb-10">최종 수정일: 2025년 1월 1일</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>
              본 환불정책은 PATRICK(이하 &quot;회사&quot;)이 제공하는 게임 기획 문서 피드백 서비스(이하 &quot;서비스&quot;)의
              구독 결제에 대한 환불 기준과 절차를 규정합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (구독 서비스 안내)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>무료 체험: 1회 무료 분석 (결제 불필요)</li>
              <li>월 구독: 월 17,900원 - 무제한 문서 분석</li>
              <li>3개월 패스: 49,000원 - 3개월간 무제한 문서 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (환불 기준)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-1">1. 전액 환불</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>결제 후 서비스를 이용하지 않은 경우, 결제일로부터 7일 이내 전액 환불</li>
                  <li>서비스 장애로 인해 정상적인 이용이 불가능한 경우</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">2. 부분 환불</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>월 구독: 결제일로부터 7일 경과 후 서비스 이용 이력이 있는 경우, 잔여 기간에 대해 일할 계산하여 환불</li>
                  <li>3개월 패스: 결제일로부터 7일 경과 후, 이용한 기간을 월 구독 정가(17,900원)로 계산한 금액을 차감 후 환불</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">3. 환불 불가</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>구독 기간이 모두 경과한 경우</li>
                  <li>이용약관 위반으로 서비스 이용이 제한된 경우</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (구독 해지)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>구독은 언제든지 해지할 수 있습니다.</li>
              <li>해지 시 다음 결제일부터 과금이 중단됩니다.</li>
              <li>해지 후에도 현재 구독 기간 종료일까지 서비스를 이용할 수 있습니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (환불 절차)</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>문의하기를 통해 환불 요청</li>
              <li>환불 사유 확인 (영업일 기준 1~2일)</li>
              <li>환불 승인 후 결제 수단에 따라 3~7영업일 이내 환불 처리</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (서비스 제공 기간)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>월 구독: 결제일로부터 1개월</li>
              <li>3개월 패스: 결제일로부터 3개월</li>
              <li>AI 분석 결과는 결제 후 즉시 제공됩니다.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (문의)</h2>
            <p>
              환불 관련 문의는 아래 채널을 통해 접수해주세요.
            </p>
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
