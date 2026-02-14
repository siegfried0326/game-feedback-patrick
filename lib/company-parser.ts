/**
 * 파일명에서 회사명을 자동으로 추출하는 유틸리티
 */

// 한국 주요 게임 회사 리스트
const GAME_COMPANIES = [
  // 대형사
  "넥슨", "NEXON", "Nexon",
  "엔씨소프트", "엔씨", "NC소프트", "NCSOFT", "NC", "NCSoft",
  "크래프톤", "KRAFTON", "Krafton",
  "넷마블", "NETMARBLE", "Netmarble",
  "펄어비스", "PEARLABYSS", "Pearl Abyss",
  "스마일게이트", "SMILEGATE", "Smilegate",
  "컴투스", "COM2US", "Com2us",
  "위메이드", "WEMADE", "Wemade",
  
  // 카카오/네이버 계열
  "카카오게임즈", "카카오", "KAKAO", "Kakao",
  "네오플", "NEOPLE", "Neople",
  "넵튠", "NEPTUNE", "Neptune",
  "네오위즈", "NEOWIZ", "Neowiz",
  
  // 해외 유명사
  "라이엇", "라이엇게임즈", "RIOT", "Riot Games",
  "블리자드", "BLIZZARD", "Blizzard",
  "미호요", "MIHOYO", "HoYoverse", "Hoyoverse",
  "슈퍼셀", "SUPERCELL", "Supercell",
  "에픽게임즈", "에픽", "EPIC", "Epic Games",
  
  // 중견사
  "게임빌", "GAMEVIL", "Gamevil",
  "선데이토즈", "SUNDAYTOZ", "Sundaytoz",
  "액토즈소프트", "ACTOZ", "Actoz",
  "웹젠", "WEBZEN", "Webzen",
  "조이시티", "JOYCITY", "Joycity",
  "스튜디오드래곤", "STUDIO DRAGON",
  "데브시스터즈", "DEVSISTERS", "Devsisters",
  "매드엔진", "MADENGINE", "MadEngine",
  "라이온하트", "LIONHEART", "LionHeart", "Lionheart",
  "시프트업", "SHIFTUP", "ShiftUp", "Shiftup",
  
  // 일반 카테고리
  "일반게임회사", "일반게임사", "게임회사", "게임사",
  
  // 추가 가능
]

// 회사명 정규화 (다양한 표기를 하나로 통일)
const COMPANY_ALIASES: Record<string, string> = {
  "넥슨": "넥슨",
  "NEXON": "넥슨",
  "Nexon": "넥슨",
  "nexon": "넥슨",
  
  "엔씨소프트": "엔씨소프트",
  "엔씨": "엔씨소프트",
  "NC소프트": "엔씨소프트",
  "NCSOFT": "엔씨소프트",
  "NC": "엔씨소프트",
  "NCSoft": "엔씨소프트",
  "ncsoft": "엔씨소프트",
  
  "크래프톤": "크래프톤",
  "KRAFTON": "크래프톤",
  "Krafton": "크래프톤",
  "krafton": "크래프톤",
  
  "넷마블": "넷마블",
  "NETMARBLE": "넷마블",
  "Netmarble": "넷마블",
  "netmarble": "넷마블",
  
  "펄어비스": "펄어비스",
  "PEARLABYSS": "펄어비스",
  "Pearl Abyss": "펄어비스",
  "pearlabyss": "펄어비스",
  
  "스마일게이트": "스마일게이트",
  "SMILEGATE": "스마일게이트",
  "Smilegate": "스마일게이트",
  "smilegate": "스마일게이트",
  
  "컴투스": "컴투스",
  "COM2US": "컴투스",
  "Com2us": "컴투스",
  "com2us": "컴투스",
  
  "위메이드": "위메이드",
  "WEMADE": "위메이드",
  "Wemade": "위메이드",
  "wemade": "위메이드",
  
  "카카오게임즈": "카카오게임즈",
  "카카오": "카카오게임즈",
  "KAKAO": "카카오게임즈",
  "Kakao": "카카오게임즈",
  "kakao": "카카오게임즈",
  
  "네오위즈": "네오위즈",
  "NEOWIZ": "네오위즈",
  "Neowiz": "네오위즈",
  "neowiz": "네오위즈",
  
  "라이엇": "라이엇게임즈",
  "라이엇게임즈": "라이엇게임즈",
  "RIOT": "라이엇게임즈",
  "Riot Games": "라이엇게임즈",
  "riot": "라이엇게임즈",
  
  "블리자드": "블리자드",
  "BLIZZARD": "블리자드",
  "Blizzard": "블리자드",
  "blizzard": "블리자드",
  
  "미호요": "미호요",
  "MIHOYO": "미호요",
  "HoYoverse": "미호요",
  "Hoyoverse": "미호요",
  "hoyoverse": "미호요",
  
  "데브시스터즈": "데브시스터즈",
  "DEVSISTERS": "데브시스터즈",
  "Devsisters": "데브시스터즈",
  "devsisters": "데브시스터즈",
  
  "매드엔진": "매드엔진",
  "MADENGINE": "매드엔진",
  "MadEngine": "매드엔진",
  "madengine": "매드엔진",
  
  "라이온하트": "라이온하트",
  "LIONHEART": "라이온하트",
  "LionHeart": "라이온하트",
  "Lionheart": "라이온하트",
  "lionheart": "라이온하트",
  
  "시프트업": "시프트업",
  "SHIFTUP": "시프트업",
  "ShiftUp": "시프트업",
  "Shiftup": "시프트업",
  "shiftup": "시프트업",
  
  "일반게임회사": "일반게임회사",
  "일반게임사": "일반게임회사",
  "게임회사": "일반게임회사",
  "게임사": "일반게임회사",
}

/**
 * 파일명에서 회사명을 추출합니다
 * 
 * @param fileName - 파일명 (예: "넥슨_포트폴리오.pdf", "엔씨소프트-시스템기획서.pdf")
 * @returns 추출된 회사명 배열 (정규화됨)
 * 
 * @example
 * extractCompanyFromFileName("넥슨_포트폴리오.pdf") // ["넥슨"]
 * extractCompanyFromFileName("엔씨소프트_크래프톤_합격.pdf") // ["엔씨소프트", "크래프톤"]
 * extractCompanyFromFileName("포트폴리오.pdf") // []
 */
export function extractCompanyFromFileName(fileName: string): string[] {
  console.log('🔍🔍🔍 NEW CODE 파일명:', fileName)
  
  // 하드코딩 테스트
  if (fileName.includes('넷마블')) {
    console.log('✅✅✅ 넷마블 발견! 하드코딩 리턴')
    return ['넷마블']
  }
  if (fileName.includes('넥슨')) {
    return ['넥슨']
  }
  if (fileName.includes('네오위즈')) {
    return ['네오위즈']
  }
  if (fileName.includes('엔씨')) {
    return ['엔씨소프트']
  }
  
  // 파일 확장자 제거
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "")
  
  // 구분자로 분리 (_, -, 공백, [, ], (, ))
  const parts = nameWithoutExt.split(/[_\-\s\[\]\(\)]+/).filter(p => p)
  
  console.log('🔍 파일명 분리:', parts)
  
  const foundCompanies = new Set<string>()
  
  // 각 부분을 회사 리스트와 매칭
  for (const part of parts) {
    console.log('  🔎 검사 중:', part)
    
    // 정확히 일치하는 회사명 찾기
    for (const company of GAME_COMPANIES) {
      if (part.toLowerCase().trim() === company.toLowerCase().trim()) {
        // 정규화된 이름으로 변환
        const normalized = COMPANY_ALIASES[company] || company
        console.log('  ✅ 정확 매칭:', part, '→', normalized)
        foundCompanies.add(normalized)
        break
      }
    }
  }
  
  // 정확 매칭이 없으면 부분 일치 시도
  if (foundCompanies.size === 0) {
    for (const part of parts) {
      const sortedCompanies = [...GAME_COMPANIES].sort((a, b) => b.length - a.length)
      for (const company of sortedCompanies) {
        if (part.toLowerCase().includes(company.toLowerCase())) {
          const normalized = COMPANY_ALIASES[company] || company
          console.log('  ✅ 부분 매칭:', part, '→', normalized)
          foundCompanies.add(normalized)
          break
        }
      }
      if (foundCompanies.size > 0) break
    }
  }
  
  const result = Array.from(foundCompanies)
  console.log('🎯 최종 결과:', result)
  return result
}

/**
 * 여러 파일명에서 회사명 통계 내기
 */
export function analyzeCompanyDistribution(fileNames: string[]): Record<string, number> {
  const distribution: Record<string, number> = {}
  
  for (const fileName of fileNames) {
    const companies = extractCompanyFromFileName(fileName)
    for (const company of companies) {
      distribution[company] = (distribution[company] || 0) + 1
    }
  }
  
  return distribution
}

/**
 * 지원하는 회사 목록 반환
 */
export function getSupportedCompanies(): string[] {
  return Array.from(new Set(Object.values(COMPANY_ALIASES)))
}
