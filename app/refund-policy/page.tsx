import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "환불정책 | 디자이닛(DesignIt)",
  description: "디자이닛(DesignIt) 서비스의 환불정책 안내",
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
        <p className="text-sm text-slate-500 mb-10">최종 수정일: 2025년 1월 20일</p>

        <div className="space-y-8 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (목적)</h2>
            <p>
              본 환불정책은 문라이트커리어랩(이하 &quot;회사&quot;)이 제공하는 디자이닛(DesignIt) 서비스(이하 &quot;서비스&quot;)의
              구독 결제에 대한 환불 및 해지 기준을 규정합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (구독 서비스 안내)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>무료 체험: 1회 무료 분석 (결제 불필요)</li>
              <li>월 구독: 월 17,900원 - 결제일부터 1개월간 무제한 문서 분석</li>
              <li>3개월 패스: 49,000원 - 결제일부터 3개월간 무제한 문서 분석</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (구독 해지)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-1">1. 해지 방법</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    <Link href="/mypage" className="text-[#5B8DEF] hover:underline">마이페이지</Link>에서
                    &quot;구독 해지하기&quot; 버튼을 클릭하여 즉시 해지할 수 있습니다.
                  </li>
                  <li>별도의 문의 없이 직접 해지가 가능합니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">2. 해지 후 이용</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>해지 후에도 남은 구독 기간(만료일)까지 서비스를 계속 이용할 수 있습니다.</li>
                  <li>만료일 이후에는 서비스 이용이 중단됩니다.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (환불 기준)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-1">1. 월 구독</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>월 구독은 해지만 가능하며, 부분 환불은 제공되지 않습니다.</li>
                  <li>해지 시 잔여 기간까지 서비스를 이용할 수 있습니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">2. 3개월 패스</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>결제일로부터 7일 이내에 서비스를 1회도 이용하지 않은 경우 전액 환불이 가능합니다.</li>
                  <li>결제일로부터 7일 경과 또는 서비스 이용 이력이 있는 경우 환불이 불가합니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">3. 환불 불가 사유</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>구독 기간이 모두 경과한 경우</li>
                  <li>이용약관 위반으로 서비스 이용이 제한된 경우</li>
                  <li>서비스를 이용한 이력이 있는 월 구독의 경우</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (환불 절차)</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>아래 채널톡을 통해 환불 요청</li>
              <li>환불 사유 및 이용 이력 확인 (영업일 기준 1~2일)</li>
              <li>환불 승인 후 결제 수단에 따라 3~7영업일 이내 환불 처리</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (문의)</h2>
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

          {/* 요약 박스 */}
          <section className="bg-slate-900/80 rounded-xl border border-[#1e3a5f] p-6">
            <h2 className="text-lg font-semibold text-white mb-4">환불정책 요약</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e3a5f]">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">구분</th>
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">해지</th>
                    <th className="text-left py-2 text-slate-400 font-medium">환불</th>
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  <tr className="border-b border-[#1e3a5f]/50">
                    <td className="py-3 pr-4 font-medium text-white">월 구독</td>
                    <td className="py-3 pr-4">마이페이지에서 즉시 해지<br />(잔여 기간까지 이용 가능)</td>
                    <td className="py-3">환불 불가<br />(해지로 대체)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-white">3개월 패스</td>
                    <td className="py-3 pr-4">마이페이지에서 즉시 해지<br />(잔여 기간까지 이용 가능)</td>
                    <td className="py-3">7일 이내 미이용 시 전액 환불<br />그 외 환불 불가</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
