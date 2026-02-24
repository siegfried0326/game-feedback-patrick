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
              구독 결제 및 컨설팅 서비스에 대한 환불 및 해지 기준을 규정합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (서비스 안내)</h2>
            <div className="space-y-3">
              <div>
                <h3 className="font-medium text-white mb-1">1. 구독 서비스 (AI 문서 분석)</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>무료 체험: 1회 무료 분석 (결제 불필요)</li>
                  <li>월 구독: 월 17,900원 - 결제일부터 1개월간 무제한 문서 분석</li>
                  <li>3개월 패스: 49,000원 - 결제일부터 3개월간 무제한 문서 분석</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">2. 컨설팅 서비스</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>1:1 컨설팅 (4타임): 48만원 (타임당 12만원)</li>
                  <li>모의면접 / 단기 피드백: 20만원 (1회)</li>
                  <li>그룹 컨설팅 (1타임): 9만원 (타임당)</li>
                </ul>
              </div>
            </div>
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
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (구독 서비스 환불 기준)</h2>
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
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (컨설팅 서비스 환불 기준)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-1">1. 환불 원칙</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>컨설팅 서비스는 잔여 회차를 기준으로 환불합니다.</li>
                  <li>환불 금액 = (잔여 회차 ÷ 전체 회차) × 결제 금액</li>
                  <li>이미 진행된 회차에 대해서는 환불이 불가합니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">2. 이용 기한 (소멸 기한)</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>컨설팅 등록 시 기본 이용 기한은 <strong className="text-white">4주</strong>이며, 4주 이내에 모든 회차를 소진해야 합니다.</li>
                  <li>4주 기한 경과 후 미소진 회차는 자동 소멸됩니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">3. 서비스 연장 기간 (2주)</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>기본 4주 이용 기한 종료 후, <strong className="text-white">2주의 서비스 연장 기간</strong>이 무료로 제공됩니다.</li>
                  <li>연장 기간(2주)은 서비스 차원에서 제공되는 것으로, <strong className="text-white">연장 기간 중에는 환불이 불가</strong>합니다.</li>
                  <li>기본 4주가 먼저 소진된 후 2주 서비스 연장 기간이 적용됩니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">4. 강사 사정에 의한 연장</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>강사의 사정으로 예정된 컨설팅이 진행되지 못한 경우, 해당 기간만큼 <strong className="text-white">무료 자동 연장</strong>됩니다.</li>
                  <li>이 경우 이용 기한과 관계없이 수강생에게 불이익이 발생하지 않습니다.</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-1">5. 모의면접 / 단기 피드백</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>1회 서비스로, 미이용 시 결제일로부터 7일 이내 전액 환불 가능합니다.</li>
                  <li>서비스 이용 후 또는 7일 경과 후에는 환불이 불가합니다.</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (환불 절차)</h2>
            <ol className="list-decimal list-inside space-y-1">
              <li>아래 카카오톡 채널을 통해 환불 요청</li>
              <li>환불 사유 및 이용 이력 확인 (영업일 기준 1~2일)</li>
              <li>환불 승인 후 결제 수단에 따라 3~7영업일 이내 환불 처리</li>
            </ol>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (문의)</h2>
            <p>
              환불 관련 문의는 아래 채널을 통해 접수해주세요.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>
                카카오톡 채널:{" "}
                <a
                  href="http://pf.kakao.com/_bXgIX"
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
                  <tr className="border-b border-[#1e3a5f]/50">
                    <td className="py-3 pr-4 font-medium text-white">3개월 패스</td>
                    <td className="py-3 pr-4">마이페이지에서 즉시 해지<br />(잔여 기간까지 이용 가능)</td>
                    <td className="py-3">7일 이내 미이용 시 전액 환불<br />그 외 환불 불가</td>
                  </tr>
                  <tr className="border-b border-[#1e3a5f]/50">
                    <td className="py-3 pr-4 font-medium text-white">1:1 컨설팅<br />(4타임)</td>
                    <td className="py-3 pr-4">기본 4주 + 서비스 2주<br />(총 6주 이내 소진)</td>
                    <td className="py-3">잔여 회차 기준 환불<br />(서비스 연장 기간 중 환불 불가)</td>
                  </tr>
                  <tr className="border-b border-[#1e3a5f]/50">
                    <td className="py-3 pr-4 font-medium text-white">그룹 컨설팅</td>
                    <td className="py-3 pr-4">기본 4주 + 서비스 2주<br />(총 6주 이내 소진)</td>
                    <td className="py-3">잔여 회차 기준 환불<br />(서비스 연장 기간 중 환불 불가)</td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium text-white">모의면접 /<br />단기 피드백</td>
                    <td className="py-3 pr-4">1회 서비스</td>
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
