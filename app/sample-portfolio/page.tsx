/**
 * 샘플 포트폴리오 페이지 (324줄)
 *
 * SEO용 예시 포트폴리오 (가상의 게임 기획자 김태현).
 * 검색 엔진 유입을 위한 정적 콘텐츠.
 * 라우트: /sample-portfolio (공개)
 */
export const metadata = {
  title: "게임 기획 포트폴리오 - 김태현 | RPG 시스템 기획",
  description: "RPG 전투 시스템 및 경제 시스템 기획 포트폴리오",
}

export default function SamplePortfolioPage() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* 헤더 */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-indigo-200 text-sm mb-2">GAME DESIGNER PORTFOLIO</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">김태현</h1>
          <p className="text-xl text-indigo-100 mb-6">RPG 시스템 기획자 | 3년차</p>
          <div className="flex flex-wrap gap-3">
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">전투 시스템</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">경제 시스템</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">밸런싱</span>
            <span className="px-3 py-1 bg-white/20 rounded-full text-sm">Unity</span>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-16">

        {/* 자기소개 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4 border-b-2 border-indigo-500 pb-2">About Me</h2>
          <p className="text-gray-700 leading-relaxed">
            3년간 RPG 장르의 시스템 기획을 담당해왔습니다. 전투 시스템의 깊이와 경제 시스템의 균형을
            동시에 추구하며, 데이터 기반의 밸런싱을 통해 유저 리텐션 향상에 기여했습니다.
            Unity 엔진 환경에서의 프로토타이핑 경험이 있으며, 개발팀과의 원활한 커뮤니케이션을
            강점으로 생각합니다.
          </p>
        </section>

        {/* 프로젝트 1: 전투 시스템 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-indigo-500 pb-2">
            Project 1: 턴제 RPG 전투 시스템 리뉴얼
          </h2>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-lg mb-3 text-indigo-700">프로젝트 개요</h3>
            <ul className="space-y-2 text-gray-700">
              <li><strong>프로젝트명:</strong> &quot;크로니클 오브 소울&quot; 전투 시스템 리뉴얼</li>
              <li><strong>기간:</strong> 2023.03 ~ 2023.09 (7개월)</li>
              <li><strong>역할:</strong> 전투 시스템 기획 메인 담당</li>
              <li><strong>팀 규모:</strong> 기획 2명, 프로그래머 3명, 아티스트 2명</li>
              <li><strong>엔진:</strong> Unity 2022 LTS</li>
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">1. 문제 정의</h3>
              <p className="text-gray-700 mb-3">
                기존 전투 시스템은 단순 자동 전투 위주로 설계되어 유저의 전략적 개입 여지가 적었습니다.
                이로 인해 다음과 같은 문제가 발생했습니다:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                <li>전투 콘텐츠 체류 시간 평균 2.3분 (목표: 5분 이상)</li>
                <li>전투 관련 유저 불만 비율 38% (CS 데이터 기준)</li>
                <li>7일 리텐션 42% → 업계 평균 55% 대비 낮음</li>
                <li>전투 스킵율 67% (유저가 전투에 흥미를 느끼지 못함)</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">2. 해결 방안</h3>
              <p className="text-gray-700 mb-3">
                &quot;선택의 깊이&quot;를 핵심 키워드로 설정하고, 3가지 시스템을 도입했습니다:
              </p>

              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-2">속성 상성 시스템</h4>
                  <p className="text-sm text-gray-600">
                    5속성(화/수/풍/지/암) 순환 상성 + 빛/암 상호 상성 구조.
                    상성 우위 시 데미지 1.5배, 열세 시 0.7배.
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-2">체인 콤보 시스템</h4>
                  <p className="text-sm text-gray-600">
                    같은 속성 스킬 연속 사용 시 체인 보너스 발동.
                    2체인 +10%, 3체인 +25%, 4체인 +50% 추가 데미지.
                  </p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h4 className="font-semibold text-indigo-800 mb-2">약점 브레이크</h4>
                  <p className="text-sm text-gray-600">
                    보스 몬스터에 약점 게이지 도입. 약점 속성으로 공격 시 게이지 감소,
                    0 도달 시 브레이크 상태(3턴 무방비).
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">3. 밸런싱 데이터</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-indigo-100">
                      <th className="border border-indigo-200 px-4 py-2 text-left">항목</th>
                      <th className="border border-indigo-200 px-4 py-2 text-center">리뉴얼 전</th>
                      <th className="border border-indigo-200 px-4 py-2 text-center">리뉴얼 후</th>
                      <th className="border border-indigo-200 px-4 py-2 text-center">변화</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 px-4 py-2">전투 체류 시간</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">2.3분</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">6.1분</td>
                      <td className="border border-gray-200 px-4 py-2 text-center text-green-600">+165%</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2">전투 스킵율</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">67%</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">23%</td>
                      <td className="border border-gray-200 px-4 py-2 text-center text-green-600">-44%p</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 px-4 py-2">7일 리텐션</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">42%</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">58%</td>
                      <td className="border border-gray-200 px-4 py-2 text-center text-green-600">+16%p</td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="border border-gray-200 px-4 py-2">유저 만족도 (5점 만점)</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">2.8</td>
                      <td className="border border-gray-200 px-4 py-2 text-center">4.2</td>
                      <td className="border border-gray-200 px-4 py-2 text-center text-green-600">+1.4</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">4. 핵심 기획 문서 (발췌)</h3>
              <div className="bg-gray-50 rounded-lg p-5 space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">4.1 데미지 공식</h4>
                  <code className="block bg-gray-800 text-green-400 p-3 rounded text-sm">
                    최종 데미지 = (기본 공격력 * 스킬 배율) * 속성 보정 * (1 + 체인 보너스) * (1 - 방어율) * 크리티컬 배율
                  </code>
                  <p className="text-sm text-gray-600 mt-2">
                    * 방어율 = 방어력 / (방어력 + 레벨상수), 레벨상수 = 레벨 * 5 + 100
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">4.2 속성 상성표</h4>
                  <p className="text-sm text-gray-600">
                    화 → 풍 → 지 → 수 → 화 (순환 상성), 빛 ↔ 암 (상호 상성)
                  </p>
                  <p className="text-sm text-gray-600">
                    상성 우위: 데미지 x1.5 / 상성 열세: 데미지 x0.7 / 동속성: 데미지 x1.0
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 프로젝트 2: 경제 시스템 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-indigo-500 pb-2">
            Project 2: 인게임 경제 시스템 설계
          </h2>

          <div className="bg-gray-50 rounded-xl p-6 mb-6">
            <h3 className="font-semibold text-lg mb-3 text-indigo-700">프로젝트 개요</h3>
            <ul className="space-y-2 text-gray-700">
              <li><strong>프로젝트명:</strong> 신규 MMORPG &quot;에테르나&quot; 경제 시스템</li>
              <li><strong>기간:</strong> 2024.01 ~ 2024.06 (6개월)</li>
              <li><strong>역할:</strong> 경제 시스템 기획 (재화, 거래소, 제작)</li>
              <li><strong>목표:</strong> 인플레이션 통제 + 유저 간 거래 활성화</li>
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">1. 재화 구조 설계</h3>
              <p className="text-gray-700 mb-4">
                3단계 재화 체계를 도입하여 각 재화의 역할을 명확히 분리했습니다:
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border border-yellow-300 bg-yellow-50 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-800 mb-2">골드 (기본 재화)</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>- 몬스터 드랍, 퀘스트 보상</li>
                    <li>- 일일 획득 상한: 50,000G</li>
                    <li>- 용도: NPC 상점, 장비 수리, 스킬 학습</li>
                    <li>- 싱크: 수리비(30%), 제작비(25%), 세금(15%)</li>
                  </ul>
                </div>
                <div className="border border-blue-300 bg-blue-50 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">크리스탈 (프리미엄)</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>- 유료 구매 또는 거래소 환전</li>
                    <li>- 골드 교환 비율: 동적 (시세 연동)</li>
                    <li>- 용도: 코스메틱, 편의 기능, 가챠</li>
                    <li>- 주간 무료 지급: 100개 (출석 보상)</li>
                  </ul>
                </div>
                <div className="border border-purple-300 bg-purple-50 rounded-lg p-4">
                  <h4 className="font-semibold text-purple-800 mb-2">명예 포인트 (PvP)</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>- PvP/길드전 보상</li>
                    <li>- 시즌제 리셋 (3개월 주기)</li>
                    <li>- 용도: PvP 전용 장비, 칭호</li>
                    <li>- 거래 불가 (바인딩)</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">2. 인플레이션 통제 메커니즘</h3>
              <p className="text-gray-700 mb-3">
                골드 싱크와 소스의 균형을 유지하기 위한 시뮬레이션을 진행했습니다:
              </p>
              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="font-semibold mb-2">시뮬레이션 결과 (1,000명 기준, 6개월):</p>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>- 일일 골드 생성량: 약 5,000만 G</li>
                  <li>- 일일 골드 소멸량: 약 3,500만 G (소멸률 70%)</li>
                  <li>- 월간 인플레이션율: 2.3% (목표: 3% 이하)</li>
                  <li>- 거래소 세금: 5% (판매자 부담)</li>
                  <li>- 장비 강화 실패 시 재료 소멸로 추가 싱크 확보</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-lg mb-3 text-indigo-700">3. 거래소 시스템</h3>
              <ul className="text-gray-700 space-y-2">
                <li><strong>주문서 방식:</strong> 판매/구매 주문을 등록하는 양방향 거래소</li>
                <li><strong>가격 제한:</strong> 시세 ±30% 범위 내에서만 주문 가능 (급격한 시세 변동 방지)</li>
                <li><strong>거래 수수료:</strong> 판매 금액의 5% (골드 싱크 역할)</li>
                <li><strong>거래 기록:</strong> 최근 30일 시세 차트 제공 (유저 의사결정 지원)</li>
                <li><strong>귀속 아이템:</strong> 장비 착용 시 거래 불가 (골드 인플레이션 억제)</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 레퍼런스 분석 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-indigo-500 pb-2">
            레퍼런스 분석
          </h2>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="font-semibold mb-2">옥토패스 트래블러 (턴제 전투)</h3>
              <p className="text-gray-700 text-sm">
                약점 시스템과 브레이크 메커니즘 참고. 단, 옥토패스는 무기 타입 + 속성의 이중 약점 구조인 반면,
                본 프로젝트는 속성 단일 구조로 간소화하여 모바일 환경에 최적화했습니다.
                브레이크 시 행동 불능 + 받는 데미지 증가 메커니즘은 유사하게 차용했으나,
                브레이크 후 보스 패턴 변화를 추가하여 단조로움을 방지했습니다.
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-5">
              <h3 className="font-semibold mb-2">파이널 판타지 14 (경제 시스템)</h3>
              <p className="text-gray-700 text-sm">
                길드 제작/채집 시스템과 마켓보드 구조 참고. FF14의 서버별 독립 경제 모델 대신
                크로스 서버 통합 거래소를 채택하여 유동성을 확보했습니다. 세금 구조(도시별 차등 세율)는
                채택하지 않고 고정 5%로 단순화했습니다.
              </p>
            </div>
          </div>
        </section>

        {/* 기술 스택 */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6 border-b-2 border-indigo-500 pb-2">
            기술 역량
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">기획 도구</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Excel / Google Sheets - 밸런싱 시뮬레이션, 데이터 테이블</li>
                <li>Figma - UI/UX 와이어프레임, 플로우차트</li>
                <li>Notion - 기획 문서 관리, 위키</li>
                <li>Jira / Confluence - 프로젝트 관리</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3">개발 이해</h3>
              <ul className="space-y-2 text-gray-700">
                <li>Unity - 프로토타이핑, 기본 C# 스크립팅</li>
                <li>Python - 밸런싱 시뮬레이션 스크립트</li>
                <li>SQL - 게임 데이터 분석 쿼리</li>
                <li>Git - 버전 관리 기본 사용</li>
              </ul>
            </div>
          </div>
        </section>

        {/* 연락처 */}
        <section className="bg-indigo-50 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact</h2>
          <p className="text-gray-600 mb-4">
            함께 좋은 게임을 만들고 싶습니다. 언제든 연락 주세요!
          </p>
          <div className="flex justify-center gap-8 text-gray-700">
            <span>Email: taehyun.kim@example.com</span>
            <span>Phone: 010-1234-5678</span>
          </div>
        </section>

      </div>

      {/* 푸터 */}
      <footer className="bg-gray-100 py-6 text-center text-gray-500 text-sm">
        <p>&copy; 2024 김태현 Game Design Portfolio. All rights reserved.</p>
      </footer>
    </main>
  )
}
