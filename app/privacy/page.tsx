/**
 * 개인정보처리방침 페이지
 * 라우트: /privacy (공개)
 */
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const metadata = {
  title: "개인정보처리방침 | 아카이브 187(Archive187)",
  description: "아카이브 187(Archive187) 서비스의 개인정보처리방침 안내",
}

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-white mb-2">개인정보처리방침</h1>
        <p className="text-sm text-slate-500 mb-10">최종 수정일: 2026년 3월 27일</p>

        <div className="space-y-8 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제1조 (개인정보의 처리 목적)</h2>
            <p>
              문라이트커리어랩(이하 &quot;회사&quot;)은 아카이브 187(Archive187) 서비스 제공을 위해 다음과 같은 목적으로 개인정보를 처리합니다.
              처리한 개인정보는 다음의 목적 이외의 용도로는 사용되지 않으며, 목적이 변경될 경우 사전 동의를 받겠습니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>회원 가입 및 본인 확인</li>
              <li>서비스 이용 및 AI 문서 분석 결과 제공</li>
              <li>결제 처리 및 환불 처리</li>
              <li>서비스 이용 내역 관리 (크레딧, 구독 현황)</li>
              <li>고객 문의 응대 및 공지사항 전달</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제2조 (수집하는 개인정보 항목 및 수집 방법)</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-white mb-2">1. 수집 항목</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><span className="text-slate-400">Google 소셜 로그인:</span> 이메일 주소, 이름, 프로필 사진</li>
                  <li><span className="text-slate-400">결제 시:</span> 이메일 주소 (나이스페이먼츠 결제창 입력 항목에 한함)</li>
                  <li><span className="text-slate-400">서비스 이용 시:</span> 업로드한 문서 파일, 서비스 이용 기록, 접속 로그</li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium text-white mb-2">2. 수집 방법</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Google OAuth를 통한 소셜 로그인</li>
                  <li>서비스 이용 과정에서 자동 생성·수집</li>
                  <li>결제 처리 과정에서 나이스페이먼츠를 통해 수집</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제3조 (개인정보의 처리 및 보유 기간)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>결제 정보: 전자상거래법에 따라 5년 보관</li>
              <li>업로드 문서: 서비스 이용 기간 동안 보관, 회원 탈퇴 또는 삭제 요청 시 즉시 삭제</li>
              <li>접속 로그: 통신비밀보호법에 따라 3개월 보관</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제4조 (개인정보의 제3자 제공)</h2>
            <p>
              회사는 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제5조 (개인정보 처리 위탁)</h2>
            <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하고 있습니다.</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">수탁업체</th>
                    <th className="text-left py-2 pr-4 text-slate-400 font-medium">위탁 업무</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="py-2 pr-4">Supabase Inc.</td>
                    <td className="py-2">회원 인증, 데이터베이스 운영, 파일 저장</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">나이스페이먼츠(주)</td>
                    <td className="py-2">결제 처리 및 정산</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Anthropic Inc.</td>
                    <td className="py-2">AI 문서 분석 처리 (업로드 문서 포함)</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4">Vercel Inc.</td>
                    <td className="py-2">서버 인프라 및 배포 운영</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제6조 (이용자의 권리 및 행사 방법)</h2>
            <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-1 mt-3">
              <li>개인정보 처리 현황 조회 및 열람 요청</li>
              <li>오류 정보 정정 요청</li>
              <li>개인정보 삭제 및 처리 정지 요청</li>
              <li>회원 탈퇴 (서비스 내 마이페이지 또는 카카오톡 채널 문의)</li>
            </ul>
            <p className="mt-3">
              권리 행사는{" "}
              <a
                href="http://pf.kakao.com/_bXgIX"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#5B8DEF] hover:underline"
              >
                카카오톡 채널
              </a>
              을 통해 요청하실 수 있으며, 지체 없이 조치하겠습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제7조 (개인정보의 안전성 확보 조치)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>HTTPS 암호화 통신을 통한 데이터 전송 보호</li>
              <li>Supabase Row Level Security(RLS)를 통한 데이터 접근 통제</li>
              <li>비밀번호 없는 소셜 로그인(Google OAuth) 사용으로 비밀번호 유출 위험 최소화</li>
              <li>개인정보 접근 권한 최소화</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제8조 (쿠키의 사용)</h2>
            <p>
              서비스는 이용자의 로그인 상태 유지를 위해 쿠키(Cookie)를 사용합니다.
              이용자는 브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나,
              이 경우 로그인이 필요한 서비스 이용이 어려울 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제9조 (개인정보 보호책임자)</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>성명: 이준규</li>
              <li>소속: 문라이트커리어랩</li>
              <li>연락처: 031-695-4230</li>
              <li>
                문의:{" "}
                <a
                  href="http://pf.kakao.com/_bXgIX"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#5B8DEF] hover:underline"
                >
                  카카오톡 채널
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">제10조 (방침 변경)</h2>
            <p>
              이 개인정보처리방침은 법령 또는 서비스 변경에 따라 수정될 수 있으며,
              변경 시 서비스 공지 또는 이 페이지를 통해 안내드립니다.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
