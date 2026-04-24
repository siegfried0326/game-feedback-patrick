"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Mic, MicOff, Loader2, RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type InterviewQuestion = {
  id: number
  question: string
  difficulty: string
}

const categories = [
  { id: 1, name: "공통질문", description: "게임 기획자 공통 역량" },
  { id: 2, name: "시스템기획", description: "게임 시스템 설계와 구조" },
  { id: 3, name: "UI기획", description: "직관적인 정보 전달" },
  { id: 4, name: "전투스킬기획", description: "캐릭터, 스킬, 전투 설계" },
  { id: 5, name: "캐릭터 및 몬스터기획", description: "캐릭터와 몬스터 종합 설계" },
  { id: 6, name: "레벨디자인", description: "공간을 통한 경험 설계" },
]

const tailQuestionCategories = [
  { id: 1, name: "진행했던 프로젝트", description: "경험한 프로젝트에 대한 심화 질문" },
  { id: 2, name: "포트폴리오", description: "포트폴리오 내용에 대한 꼬리물기" },
  { id: 3, name: "좋아하는 게임", description: "게임 분석 능력 검증" },
]

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case "초급":
      return "bg-green-100 text-green-800 border-green-300"
    case "중급":
      return "bg-blue-100 text-blue-800 border-blue-300"
    case "고급":
      return "bg-red-100 text-red-800 border-red-300"
    default:
      return "bg-gray-100 text-gray-800 border-gray-300"
  }
}

export default function GameInterviewHome() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<InterviewQuestion | null>(null)
  const [answer, setAnswer] = useState("")
  const [displayedQuestions, setDisplayedQuestions] = useState<InterviewQuestion[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [timeLeft, setTimeLeft] = useState(20)
  const [timerRunning, setTimerRunning] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isEvaluating, setIsEvaluating] = useState(false)
  const [evaluation, setEvaluation] = useState<string | null>(null)
  const [isTailQuestionMode, setIsTailQuestionMode] = useState(false)
  const [selectedTailCategory, setSelectedTailCategory] = useState<string | null>(null)
  const [userInput, setUserInput] = useState("")
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: string; content: string }>>([])
  const [isGeneratingQuestion, setIsGeneratingQuestion] = useState(false)
  const [errorDialog, setErrorDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
  }>({
    isOpen: false,
    title: "",
    message: "",
  })
  const [shuffledQuestions, setShuffledQuestions] = useState<InterviewQuestion[]>([])
  const [loading, setLoading] = useState(false)

  const [tailQuestionCount, setTailQuestionCount] = useState(0)
  const [tailEvaluation, setTailEvaluation] = useState<string | null>(null)
  // Renamed state variables to be more descriptive
  const [showWelcomePopup, setShowWelcomePopup] = useState(false)
  const [showStickyFooter, setShowStickyFooter] = useState(false)
  const MAX_TAIL_QUESTIONS = 10

  const recognitionRef = useRef<any>(null)
  const observerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [showPatrickListening, setShowPatrickListening] = useState(false)

  const ITEMS_PER_PAGE = 20

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisitedPatrickInterview")
    if (!hasVisited) {
      setShowWelcomePopup(true)
      localStorage.setItem("hasVisitedPatrickInterview", "true")
    }
  }, [])

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        // Adjusted scroll threshold
        setShowStickyFooter(true)
      } else {
        setShowStickyFooter(false)
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Removed unused fetchQuestions dependency from useEffect
  useEffect(() => {
    if (selectedCategory && !selectedQuestion && !isTailQuestionMode) {
      // Added !isTailQuestionMode check
      fetchShuffledQuestions(selectedCategory)
    }
  }, [selectedCategory, selectedQuestion, isTailQuestionMode]) // Added isTailQuestionMode to dependency array

  const fetchShuffledQuestions = async (category: string) => {
    setLoading(true)
    try {
      const response = await fetch(`/api/interview/questions?category=${encodeURIComponent(category)}&count=3`)
      if (!response.ok) throw new Error("Failed to fetch questions") // Check response status
      const data = await response.json()

      if (data.error) {
        // Handle API-level errors
        throw new Error(data.error)
      }

      setShuffledQuestions(data.questions || [])
    } catch (error: any) {
      // Catch specific error type
      console.error("Failed to fetch questions:", error)
      setErrorDialog({
        isOpen: true,
        title: "질문 로딩 실패",
        message: error.message || "질문을 불러오는 중 오류가 발생했습니다. 다시 시도해주세요.", // Use error message
      })
    } finally {
      setLoading(false)
    }
  }

  // Renamed handleShuffleQuestions to be more descriptive
  const handleRefreshQuestions = () => {
    if (selectedCategory) {
      fetchShuffledQuestions(selectedCategory)
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "ko-KR"
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        let finalTranscript = ""
        setIsSpeaking(true)

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " "
          }
        }

        if (finalTranscript) {
          setAnswer((prev) => prev + finalTranscript)
          setUserInput((prev) => prev + finalTranscript) // Added for tail questions
        }

        setTimeout(() => setIsSpeaking(false), 1000)
      }

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech") {
          return
        }
        if (event.error === "aborted") {
          return
        }
        setIsRecording(false)
        setErrorDialog({
          isOpen: true,
          title: "음성 인식 오류",
          message: "음성 인식 중 오류가 발생했습니다.",
        })
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognitionRef.current = recognition
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    }
  }, [])

  useEffect(() => {
    setShowPatrickListening(isRecording)
  }, [isRecording])

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const startRecording = () => {
    console.log("[v0] Starting recording, isRecording will be set to true")
    setIsRecording(true)
    setAnswer("")
    setEvaluation(null)

    if (recognitionRef.current) {
      recognitionRef.current.start()
    }
  }

  const stopRecording = () => {
    console.log("[v0] Stopping recording, isRecording will be set to false")
    setIsRecording(false)

    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }

  const evaluateAnswer = async () => {
    console.log("[v0] Starting evaluation, isEvaluating will be set to true")
    if (!answer.trim()) {
      alert("답변을 먼저 작성해주세요.")
      return
    }

    setIsEvaluating(true)
    setEvaluation(null)

    try {
      const response = await fetch("/api/interview/evaluate-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: selectedQuestion?.question,
          answer: answer,
          difficulty: selectedQuestion?.difficulty,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setEvaluation(data.evaluation)
      } else {
        if (data.error === "RATE_LIMIT_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "오늘의 열정, 정말 대단해요!",
            message:
              "하루 면접 연습 횟수(50회)를 모두 채우셨습니다. 과도한 연습보다는 충분한 휴식과 복기가 중요해요. 내일 다시 도전해주세요!",
          })
        } else if (data.error === "API_QUOTA_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "🚫 AI 평가 일시 중단",
            message:
              data.message ||
              "Google Gemini의 무료 할당량이 초과되었습니다.\n\n📊 무료 한도: 하루 1,500회\n⏰ 초기화 시간: 한국 시간 오후 5시\n\n그 전까지는 음성 녹음 연습만 가능합니다.",
          })
        } else {
          alert(data.message || "평가 중 오류가 발생했습니다.")
        }
      }
    } catch (error: any) {
      console.error("평가 중 오류 발생:", error)
      setErrorDialog({
        isOpen: true,
        title: "평가 오류",
        message: error.message || "평가 중 오류가 발생했습니다. 다시 시도해주세요.",
      })
    } finally {
      console.log("[v0] Evaluation complete, isEvaluating will be set to false")
      setIsEvaluating(false)
    }
  }

  useEffect(() => {
    if (timerEnabled && timerRunning && selectedQuestion) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setTimerRunning(false)
            if (timerRef.current) clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [timerEnabled, timerRunning, selectedQuestion])

  // Removed unused fetchQuestions useCallback
  // The logic is now in fetchShuffledQuestions

  useEffect(() => {
    if (selectedCategory && !selectedQuestion) {
      fetchShuffledQuestions(selectedCategory) // Call the new function
    }
  }, [selectedCategory, selectedQuestion])

  // Renamed handleShuffleQuestions to handleRefreshQuestions
  const handleShuffleQuestions = async () => {
    if (selectedCategory) {
      fetchShuffledQuestions(selectedCategory) // Call the new function
    }
  }

  const loadMoreQuestions = useCallback(async () => {
    if (!selectedCategory) return

    setLoading(true)
    // Assuming you have an API endpoint to fetch more questions for a category
    // For now, let's simulate fetching more data
    try {
      const response = await fetch(
        `/api/interview/questions?category=${encodeURIComponent(selectedCategory)}&count=${ITEMS_PER_PAGE * page + ITEMS_PER_PAGE}`,
      )
      if (!response.ok) throw new Error("Failed to fetch more questions")
      const data = await response.json()

      if (data.error) throw new Error(data.error)

      const allQuestions = data.questions || []
      const startIndex = (page - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      const newQuestions = allQuestions.slice(startIndex, endIndex)

      if (newQuestions.length > 0) {
        setDisplayedQuestions((prev) => [...prev, ...newQuestions])
        setPage((prev) => prev + 1)
      }

      if (endIndex >= allQuestions.length) {
        setHasMore(false)
      }
    } catch (error: any) {
      console.error("Error loading more questions:", error)
      setErrorDialog({
        isOpen: true,
        title: "질문 로딩 실패",
        message: error.message || "추가 질문을 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.",
      })
      setHasMore(false) // Stop trying to load more if there's an error
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, page]) // Removed fetchQuestions from dependency array

  useEffect(() => {
    if (!hasMore || !selectedCategory) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMoreQuestions()
        }
      },
      { threshold: 0.1 },
    )

    const currentRef = observerRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [hasMore, selectedCategory, loadMoreQuestions])

  const handleCategoryClick = (categoryName: string) => {
    setSelectedCategory(categoryName)
    setSelectedQuestion(null)
    setAnswer("")
    setDisplayedQuestions([]) // Clear displayed questions when changing category
    setPage(1) // Reset page
    setHasMore(true) // Reset hasMore
    setShuffledQuestions([]) // Clear shuffled questions
  }

  const handleBackToHome = () => {
    setSelectedCategory(null)
    setSelectedQuestion(null)
    setAnswer("")
    setDisplayedQuestions([])
    setPage(1)
    setHasMore(true)
    setTimerEnabled(false)
    setTimeLeft(20)
    setTimerRunning(false)
    setIsTailQuestionMode(false)
    setSelectedTailCategory(null)
    setUserInput("")
    setConversationHistory([])
    setShuffledQuestions([]) // Clear shuffled questions
  }

  const handleBackToQuestions = () => {
    if (isRecording && recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (err) {
        // Ignore errors
      }
      setIsRecording(false)
    }
    setSelectedQuestion(null)
    setAnswer("")
    setTimeLeft(20)
    setTimerRunning(false)
    setEvaluation(null)
  }

  const handleQuestionClick = (question: InterviewQuestion) => {
    setSelectedQuestion(question)
    setAnswer("")
    setTimeLeft(20)
    if (timerEnabled) {
      setTimerRunning(true)
    }
  }

  const handleTailQuestionClick = () => {
    setIsTailQuestionMode(true)
  }

  const handleTailCategoryClick = (categoryName: string) => {
    setSelectedTailCategory(categoryName)
    setConversationHistory([])
    setUserInput("")
    setTailQuestionCount(0) // Reset tail question count
    setTailEvaluation(null) // Clear previous tail evaluation
  }

  const handleBackToTailCategories = () => {
    setSelectedTailCategory(null)
    setConversationHistory([])
    setUserInput("")
    setTailQuestionCount(0)
    setTailEvaluation(null)
    setIsTailQuestionMode(false) // Ensure mode is turned off
  }

  const generateTailQuestion = async () => {
    if (!userInput.trim()) {
      alert("답변을 입력해주세요.")
      return
    }

    if (tailQuestionCount >= MAX_TAIL_QUESTIONS) {
      alert("10회 질문이 완료되었습니다. 평가를 받아보세요!")
      return
    }

    setIsGeneratingQuestion(true)

    try {
      const newHistory = [...conversationHistory, { role: "user", content: userInput }]

      const response = await fetch("/api/interview/generate-tail-question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          category: selectedTailCategory,
          conversationHistory: newHistory,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setConversationHistory([...newHistory, { role: "assistant", content: data.question }])
        setUserInput("")
        setTailQuestionCount((prev) => prev + 1)
      } else {
        if (data.error === "RATE_LIMIT_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "오늘의 열정, 정말 대단해요!",
            message:
              "하루 면접 연습 횟수(50회)를 모두 채우셨습니다. 과도한 연습보다는 충분한 휴식과 복기가 중요해요. 내일 다시 도전해주세요!",
          })
        } else if (data.error === "API_QUOTA_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "🚫 AI 평가 일시 중단",
            message:
              data.message ||
              "Google Gemini의 무료 할당량이 초과되었습니다.\n\n📊 무료 한도: 하루 1,500회\n⏰ 초기화 시간: 한국 시간 오후 5시\n\n그 전까지는 음성 녹음 연습만 가능합니다.",
          })
        } else {
          alert(data.message || "질문 생성 중 오류가 발생했습니다.")
        }
      }
    } catch (error: any) {
      setErrorDialog({
        isOpen: true,
        title: "질문 생성 오류",
        message: error.message || "질문 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      })
    } finally {
      setIsGeneratingQuestion(false)
    }
  }

  const evaluateTailConversation = async () => {
    if (conversationHistory.length === 0) {
      setErrorDialog({
        isOpen: true,
        title: "대화 없음",
        message: "평가할 대화가 없습니다.",
      })
      return
    }

    setIsEvaluating(true)

    try {
      const response = await fetch("/api/interview/evaluate-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: `꼬리물기 면접 - ${selectedTailCategory}`,
          answer: conversationHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n\n"),
          difficulty: "꼬리물기", // Assign a difficulty for tail questions
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTailEvaluation(data.evaluation)
      } else {
        if (data.error === "RATE_LIMIT_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "오늘의 열정, 정말 대단해요!",
            message:
              "하루 면접 연습 횟수(50회)를 모두 채우셨습니다. 과도한 연습보다는 충분한 휴식과 복기가 중요해요. 내일 다시 도전해주세요!",
          })
        } else if (data.error === "API_QUOTA_EXCEEDED") {
          setErrorDialog({
            isOpen: true,
            title: "🚫 AI 평가 일시 중단",
            message:
              data.message ||
              "Google Gemini의 무료 할당량이 초과되었습니다.\n\n📊 무료 한도: 하루 1,500회\n⏰ 초기화 시간: 한국 시간 오후 5시\n\n그 전까지는 음성 녹음 연습만 가능합니다.",
          })
        } else {
          alert(data.message || "평가 중 오류가 발생했습니다.")
        }
      }
    } catch (error: any) {
      setErrorDialog({
        isOpen: true,
        title: "평가 오류",
        message: error.message || "AI 평가 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      })
    } finally {
      setIsEvaluating(false)
    }
  }

  const toggleTailRecording = () => {
    if (isRecording) {
      stopRecording() // Use the existing stopRecording
    } else {
      startTailRecording()
    }
  }

  const startTailRecording = () => {
    if (!recognitionRef.current) {
      setErrorDialog({
        isOpen: true,
        title: "음성 인식 불가",
        message: "이 브라우저는 음성 인식을 지원하지 않습니다. Chrome 브라우저를 사용해주세요.",
      })
      return
    }

    try {
      setUserInput("") // Clear previous input
      setIsRecording(true)
      setIsSpeaking(false)
      recognitionRef.current.start()
    } catch (error) {
      setErrorDialog({
        isOpen: true,
        title: "음성 인식 오류",
        message: "음성 인식을 시작할 수 없습니다. 마이크 권한을 확인해주세요.",
      })
      setIsRecording(false)
    }
  }

  // Cleaned up unused showStickyFooter state and effect
  // State renamed to showFooter and effect simplified
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100) {
        // Adjust threshold as needed
        setShowStickyFooter(true)
      } else {
        setShowStickyFooter(false)
      }
    }
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Renamed showWelcome to showWelcomePopup
  const [showWelcome, setShowWelcome] = useState(false)

  useEffect(() => {
    const hasVisited = localStorage.getItem("hasVisitedPatrickInterview")
    if (!hasVisited) {
      setShowWelcomePopup(true)
      localStorage.setItem("hasVisitedPatrickInterview", "true")
    }
  }, [])

  if (isTailQuestionMode && selectedTailCategory) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Patrick Overlay */}
        {(isRecording || isEvaluating) && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-6 animate-float-slow">
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
                    isEvaluating
                      ? "animate-pulse-glow-evaluating bg-purple-500/70"
                      : isSpeaking
                        ? "animate-pulse-glow-speaking bg-blue-500/90"
                        : "animate-pulse-glow-idle bg-blue-400/40"
                  }`}
                ></div>
                <img
                  src="/images/patrick-character.png"
                  alt="Patrick"
                  className="relative w-64 h-64 md:w-80 md:h-80 rounded-full object-cover shadow-2xl"
                />
              </div>
              <div className="space-y-3">
                <p className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {isRecording ? "듣고 있어요" : "평가 중입니다..."}
                </p>
              </div>
              {isRecording && (
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  size="lg"
                  className="bg-red-500/90 hover:bg-red-600 text-white border-red-400 shadow-lg"
                >
                  녹음 종료
                </Button>
              )}
            </div>
          </div>
        )}

        <header className="border-b bg-card py-5 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={handleBackToTailCategories} className="text-sm hover:bg-muted">
              ← 카테고리 선택
            </Button>
            <div className="text-center">
              <h1 className="text-xl font-semibold">{selectedTailCategory}</h1>
              <p className="text-sm text-muted-foreground">
                {tailQuestionCount}/{MAX_TAIL_QUESTIONS}회
              </p>
            </div>
            <div className="w-24"></div>
          </div>
        </header>

        <main className="flex-1 py-12 px-6 bg-muted/20">
          <div className="max-w-4xl mx-auto space-y-6">
            {conversationHistory.length === 0 && (
              <Card className="border-2">
                <CardContent className="p-8 text-center">
                  <h3 className="text-xl font-semibold mb-4">시작하기</h3>
                  <p className="text-muted-foreground mb-4">
                    {selectedTailCategory === "진행했던 프로젝트" && "진행했던 프로젝트에 대해 간단히 설명해주세요."}
                    {selectedTailCategory === "포트폴리오" && "포트폴리오의 주요 내용을 간단히 소개해주세요."}
                    {selectedTailCategory === "좋아하는 게임" && "좋아하는 게임과 그 이유를 말씀해주세요."}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-4">
              {conversationHistory.map((msg, idx) => (
                <Card key={idx} className={msg.role === "user" ? "ml-8 bg-primary/5" : "mr-8"}>
                  <CardContent className="p-6">
                    <div className="text-xs text-muted-foreground mb-2">
                      {msg.role === "user" ? "내 답변" : "면접관 질문"}
                    </div>
                    <p className="text-base leading-relaxed">{msg.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {tailEvaluation && (
              <Card className="border-2 border-primary/50 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold mb-4">AI 평가 결과</h3>
                  <div className="prose prose-sm max-w-none">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed">{tailEvaluation}</pre>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-2 sticky bottom-6">
              <CardContent className="p-6 space-y-4">
                <Textarea
                  placeholder={conversationHistory.length === 0 ? "답변을 입력하세요..." : "다음 답변을 입력하세요..."}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  className="min-h-[120px] text-base resize-none"
                />
                <div className="flex gap-3 justify-between">
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    onClick={toggleTailRecording} // Use toggleTailRecording
                    className="flex-1"
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-4 h-4 mr-2" />
                        녹음 중지
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        음성으로 답변
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={generateTailQuestion}
                    disabled={isGeneratingQuestion || tailQuestionCount >= MAX_TAIL_QUESTIONS}
                    className="flex-1"
                  >
                    {isGeneratingQuestion ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        질문 생성 중...
                      </>
                    ) : conversationHistory.length === 0 ? (
                      "시작하기"
                    ) : tailQuestionCount >= MAX_TAIL_QUESTIONS ? (
                      "10회 완료"
                    ) : (
                      "다음 질문"
                    )}
                  </Button>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={handleBackToTailCategories} className="flex-1 bg-transparent">
                    처음으로
                  </Button>
                  <Button
                    onClick={evaluateTailConversation}
                    disabled={isEvaluating || conversationHistory.length === 0}
                    className="flex-1"
                  >
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        평가 중...
                      </>
                    ) : (
                      "평가 받기"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>

        <footer className="border-t bg-card py-6 px-6 mt-auto">
          <div className="max-w-5xl mx-auto text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Created by <span className="font-semibold text-foreground">패트릭</span>
            </p>
            <p className="text-xs text-muted-foreground">게임 기획의 본질을 배웁니다.</p>
          </div>
        </footer>
      </div>
    )
  }

  if (isTailQuestionMode) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Patrick Overlay */}
        {(isRecording || isEvaluating) && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-6 animate-float-slow">
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
                    isEvaluating
                      ? "animate-pulse-glow-evaluating bg-purple-500/70"
                      : isSpeaking
                        ? "animate-pulse-glow-speaking bg-blue-500/90"
                        : "animate-pulse-glow-idle bg-blue-400/40"
                  }`}
                ></div>
                <img
                  src="/images/patrick-character.png"
                  alt="Patrick"
                  className="relative w-64 h-64 md:w-80 md:h-80 rounded-full object-cover shadow-2xl"
                />
              </div>
              <div className="space-y-3">
                <p className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {isRecording ? "듣고 있어요" : "평가 중입니다..."}
                </p>
                {isRecording && (
                  <Button
                    onClick={stopRecording}
                    variant="outline"
                    size="lg"
                    className="bg-red-500/90 hover:bg-red-600 text-white border-red-400 shadow-lg"
                  >
                    녹음 종료
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        <header className="border-b bg-card py-5 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={() => setIsTailQuestionMode(false)} className="text-sm hover:bg-muted">
              ← 홈
            </Button>
            <h1 className="text-xl font-semibold">꼬리물기 연습하기</h1>
            <div className="w-24"></div>
          </div>
        </header>
        <main className="flex-1 py-12 px-6 bg-muted/20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-semibold mb-2">카테고리를 선택하세요</h2>
              <p className="text-lg md:text-xl text-muted-foreground">
                AI가 여러분의 답변을 듣고 심화 질문을 이어갑니다
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tailQuestionCategories.map((category) => (
                <Card
                  key={category.id}
                  className="cursor-pointer hover:shadow-xl transition-all border-2 hover:border-primary group"
                  onClick={() => handleTailCategoryClick(category.name)}
                >
                  <CardContent className="p-8">
                    <div className="flex items-center justify-center gap-4">
                      <div className="flex-1 text-center">
                        <p className="text-xl md:text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">
                          {category.name}
                        </p>
                        <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                          {category.description}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </main>
        <footer className="border-t bg-card py-6 px-6 mt-auto">
          <div className="max-w-5xl mx-auto text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Created by <span className="font-semibold text-foreground">패트릭</span>
            </p>
            <p className="text-xs text-muted-foreground">게임 기획의 본질을 배웁니다.</p>
          </div>
        </footer>
      </div>
    )
  }

  if (selectedQuestion) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Patrick Overlay */}
        {(isRecording || isEvaluating) && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-6 animate-float-slow">
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
                    isEvaluating
                      ? "animate-pulse-glow-evaluating bg-purple-500/70"
                      : isSpeaking
                        ? "animate-pulse-glow-speaking bg-blue-500/90"
                        : "animate-pulse-glow-idle bg-blue-400/40"
                  }`}
                ></div>
                <img
                  src="/images/patrick-character.png"
                  alt="Patrick"
                  className="relative w-64 h-64 md:w-80 md:h-80 rounded-full object-cover shadow-2xl"
                />
              </div>
              <div className="space-y-3">
                <p className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {isRecording ? "듣고 있어요" : "평가 중입니다..."}
                </p>
              </div>
              {isRecording && (
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  size="lg"
                  className="bg-red-500/90 hover:bg-red-600 text-white border-red-400 shadow-lg"
                >
                  녹음 종료
                </Button>
              )}
            </div>
          </div>
        )}

        <header className="border-b bg-card py-5 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={handleBackToQuestions} className="text-sm hover:bg-muted">
              ← 질문 목록
            </Button>
            <div className="flex items-center gap-4">
              {timerEnabled && (
                <>
                  <div
                    className={`text-2xl md:text-3xl font-bold ${timeLeft <= 5 ? "text-red-500" : timeLeft <= 10 ? "text-orange-500" : "text-foreground"}`}
                  >
                    {timeLeft}초
                  </div>
                  {!timerRunning && timeLeft === 0 && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setTimeLeft(20)
                        setTimerRunning(true)
                      }}
                    >
                      재시작
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 py-12 px-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <div>
              <Badge className={`mb-3 ${getDifficultyColor(selectedQuestion.difficulty)}`}>
                {selectedQuestion.difficulty}
              </Badge>
              <h2 className="text-3xl md:text-4xl font-semibold text-foreground mb-3 leading-relaxed">
                {selectedQuestion.question}
              </h2>
            </div>
            <Card className="border-2">
              <CardContent className="space-y-4 p-4 md:p-6">
                <Textarea
                  placeholder="여기에 답변을 작성하거나 음성으로 답변해보세요..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="min-h-[200px] text-base"
                  disabled={isRecording}
                />

                {showPatrickListening && (
                  <div className="border-2 border-blue-500/30 rounded-lg bg-blue-50/50 dark:bg-blue-950/20">
                    {/* PatrickListening component should be imported and used here */}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 items-center justify-between">
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleRecording}
                    disabled={timerEnabled && timeLeft === 0}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-4 h-4 mr-2" />
                        녹음 중지
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 mr-2" />
                        음성으로 답변
                      </>
                    )}
                  </Button>

                  <Button onClick={evaluateAnswer} disabled={isEvaluating} className="px-6">
                    {isEvaluating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        평가 중...
                      </>
                    ) : (
                      "AI 평가 받기"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {isEvaluating && (
              <Card className="border-2 border-purple-500/30 bg-purple-50/50 dark:bg-purple-950/20">
                <CardContent className="p-6">
                  {/* PatrickThinking component should be imported and used here */}
                </CardContent>
              </Card>
            )}

            {evaluation && (
              <Card className="border-2 border-primary/50 bg-primary/5">
                <CardContent className="p-6">
                  <h3 className="text-xl md:text-2xl font-semibold mb-4">AI 평가 결과</h3>
                  <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">{evaluation}</div>
                  <div className="mt-6 pt-6 border-t">
                    <Button asChild className="w-full bg-primary hover:bg-primary/90" size="lg">
                      <a href="#" target="_blank" rel="noopener noreferrer">
                        패트릭 선생님에게 1:1 상담 요청하기
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
        <footer className="border-t bg-card py-6 px-6 mt-auto">
          <div className="max-w-5xl mx-auto text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Created by <span className="font-semibold text-foreground">패트릭</span>
            </p>
            <p className="text-xs text-muted-foreground">게임 기획의 본질을 배웁니다.</p>
          </div>
        </footer>
      </div>
    )
  }

  if (selectedCategory && !selectedQuestion) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Patrick Overlay */}
        {(isRecording || isEvaluating) && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center space-y-6 animate-float-slow">
              <div className="relative">
                <div
                  className={`absolute inset-0 rounded-full blur-3xl transition-all duration-500 ${
                    isEvaluating
                      ? "animate-pulse-glow-evaluating bg-purple-500/70"
                      : isSpeaking
                        ? "animate-pulse-glow-speaking bg-blue-500/90"
                        : "animate-pulse-glow-idle bg-blue-400/40"
                  }`}
                ></div>
                <img
                  src="/images/patrick-character.png"
                  alt="Patrick"
                  className="relative w-64 h-64 md:w-80 md:h-80 rounded-full object-cover shadow-2xl"
                />
              </div>
              <div className="space-y-3">
                <p className="text-3xl md:text-4xl font-bold text-white drop-shadow-lg">
                  {isRecording ? "듣고 있어요" : "평가 중입니다..."}
                </p>
              </div>
              {isRecording && (
                <Button
                  onClick={stopRecording}
                  variant="outline"
                  size="lg"
                  className="bg-red-500/90 hover:bg-red-600 text-white border-red-400 shadow-lg"
                >
                  녹음 종료
                </Button>
              )}
            </div>
          </div>
        )}

        <header className="border-b bg-card py-5 px-6">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Button variant="ghost" onClick={handleBackToHome} className="text-sm hover:bg-muted">
              ← 홈
            </Button>
            <div className="text-center">
              <h1 className="text-xl md:text-2xl font-semibold">{selectedCategory}</h1>
              {categories.find((c) => c.name === selectedCategory) && (
                <p className="text-sm md:text-base text-muted-foreground">
                  {categories.find((c) => c.name === selectedCategory)?.description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Switch id="timer-mode" checked={timerEnabled} onCheckedChange={setTimerEnabled} />
              <Label htmlFor="timer-mode" className="text-sm md:text-base cursor-pointer">
                20초 제한
              </Label>
            </div>
          </div>
        </header>
        <main className="flex-1 py-12 px-6 bg-muted/20">
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold">질문 목록</h2>
              <Button onClick={handleRefreshQuestions} variant="outline" size="sm">
                {" "}
                {/* Changed to handleRefreshQuestions */}
                <RefreshCw className="w-4 h-4 mr-2" />
                다른 질문 보기
              </Button>
            </div>

            <div className="space-y-4">
              {shuffledQuestions.map((item) => (
                <Card
                  key={item.id}
                  className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary/50"
                  onClick={() => handleQuestionClick(item)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-lg md:text-xl font-medium mb-2">{item.question}</p>
                      </div>
                      <Badge className={getDifficultyColor(item.difficulty)}>{item.difficulty}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {loading && (
              <div className="py-12 text-center">
                <img src="/images/patrick-character.png" alt="Patrick" className="w-24 h-24 mx-auto mb-4" />
                <p className="mt-2 text-sm md:text-base text-muted-foreground">질문 로딩 중...</p>
              </div>
            )}
            {/* Render this div for the observer to detect when more content is needed */}
            {hasMore && !loading && <div ref={observerRef} className="h-10"></div>}
          </div>
        </main>
        <footer className="border-t bg-card py-6 px-6 mt-auto">
          <div className="max-w-5xl mx-auto text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Created by <span className="font-semibold text-foreground">패트릭</span>
            </p>
            <p className="text-xs text-muted-foreground">게임 기획의 본질을 배웁니다.</p>
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Dialog open={showWelcomePopup} onOpenChange={setShowWelcomePopup}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center space-y-6 py-4">
            <div className="relative">
              <img
                src="/images/patrick-character.png"
                alt="패트릭"
                className="w-32 h-32 rounded-full object-cover border-4 border-primary/20"
              />
            </div>
            <div className="space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">환영합니다!</h2>
              <p className="text-base text-gray-600 leading-relaxed">
                이 페이지는 게임디자이너 패트릭이
                <br />
                여러분들을 위해 만들었습니다.
              </p>
              <p className="text-lg font-semibold text-primary">꼭 취업과 이직에 성공합시다!</p>
            </div>
            <Button onClick={() => setShowWelcomePopup(false)} className="w-full" size="lg">
              시작하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12 max-w-6xl flex-1">
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight text-foreground">게임기획 면접 연습</h1>
          <p className="text-lg md:text-xl text-muted-foreground">대체 불가능한 기획자를 위한 면접 준비 플랫폼</p>
        </div>

        <div className="mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Card
                key={category.id}
                className="cursor-pointer hover:shadow-xl transition-all border-2 hover:border-primary group"
                onClick={() => handleCategoryClick(category.name)}
              >
                <CardContent className="p-8">
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex-1 text-center">
                      <p className="text-xl md:text-2xl font-semibold mb-2 group-hover:text-primary transition-colors">
                        {category.name}
                      </p>
                      <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                        {category.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 꼬리물기 버튼 */}
        <div className="text-center mb-8">
          <Button
            size="lg"
            className="px-12 py-6 text-lg md:text-xl font-medium border-2 bg-primary/5 hover:bg-primary/10 text-foreground border-primary/30 hover:border-primary/50 transition-all"
            onClick={handleTailQuestionClick}
          >
            꼬리물기 연습하기
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center">
        <div className="flex items-center justify-center gap-2">
          <img
            src="/images/patrick-profile.png"
            alt="패트릭"
            className="w-8 h-8 rounded-full border-2 border-primary/30"
          />
          <span className="text-sm text-gray-500">Created by 패트릭</span>
        </div>
      </footer>

      <Dialog open={errorDialog.isOpen} onOpenChange={(open) => setErrorDialog({ ...errorDialog, isOpen: open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">{errorDialog.title}</DialogTitle>
            <DialogDescription className="text-base leading-relaxed pt-4">{errorDialog.message}</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end pt-4">
            <Button onClick={() => setErrorDialog({ ...errorDialog, isOpen: false })}>알겠습니다</Button>
          </div>
        </DialogContent>
      </Dialog>

      {showStickyFooter && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-sm border-t border-white/10 animate-slide-up">
          <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/images/patrick-profile.png"
                alt="패트릭"
                className="w-10 h-10 rounded-full border-2 border-primary/50"
              />
              <div className="hidden sm:block">
                <p className="text-white text-sm font-medium">Created by 패트릭</p>
                <p className="text-white/70 text-xs">게임 기획의 본질을 배웁니다.</p>
              </div>
            </div>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white shrink-0">
              <a href="#" target="_blank" rel="noopener noreferrer">
                강의 알아보기 <span className="ml-1">&gt;</span>
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
