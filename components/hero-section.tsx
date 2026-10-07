/**
 * 히어로 섹션 — 랜딩 페이지 최상단
 *
 * 첫 화면은 대표 문구 한 줄을 품은 큰 업로드 창 하나. 파일을 놓거나 고르면
 * lib/pending-upload에 담아 /analyze로 넘기고, 분석 페이지가 이어서 처리한다.
 * 서비스 차별점 카드는 첫 화면 아래로 내렸다.
 * 사용: app/page.tsx
 */
"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { Plus, XCircle, CheckCircle2, BarChart3 } from "lucide-react"
import { UPLOAD_ACCEPT, UPLOAD_MAX_SIZE, setPendingUpload, getDroppedFiles } from "@/lib/pending-upload"

export function HeroSection() {
  const router = useRouter()
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: UPLOAD_ACCEPT,
    getFilesFromEvent: getDroppedFiles,
    maxFiles: 1,
    maxSize: UPLOAD_MAX_SIZE,
    onDrop: (files) => {
      if (!files.length) return
      setPendingUpload(files)
      router.push("/analyze")
    },
  })
  const rejected = fileRejections.length > 0

  return (
    <section className="bg-background">
      {/* 첫 화면 — 대표 문구 + 큰 업로드 창 (가로:세로 ≈ 2.35:1) + 동의 안내 */}
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 md:px-8 pt-20 pb-12">
        <h1 className="sr-only">문라이트 아카이브 — 게임 기획 포트폴리오 AI 피드백</h1>

        <p className="mb-8 md:mb-10 text-center text-xl sm:text-2xl md:text-3xl text-foreground leading-snug font-medium">
          <span className="font-extrabold text-primary">187개의 합격 포트폴리오</span>를 기준으로,
          <br className="hidden sm:block" /> 당신의 기획 문서가 실제로 통하는지 진단합니다.
        </p>

        <div
          {...getRootProps()}
          className={`group relative w-full max-w-5xl min-h-[360px] sm:min-h-0 sm:aspect-[16/9] lg:aspect-[2.35/1] cursor-pointer rounded-[2rem] border-2 border-dashed
            flex flex-col items-center justify-center gap-6 px-6 text-center transition-all
            ${isDragActive
              ? "border-primary bg-accent/60 shadow-[0_24px_70px_-20px_rgba(0,70,173,0.45)]"
              : "border-primary/25 bg-card shadow-[0_12px_50px_-24px_rgba(0,70,173,0.35)] hover:border-primary/60 hover:bg-accent/25"}`}
        >
          <input {...getInputProps()} aria-label="분석할 문서 올리기" />

          <span className={`flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full transition-all
            ${isDragActive ? "bg-primary text-white scale-110" : "bg-accent text-primary group-hover:bg-primary group-hover:text-white"}`}>
            <Plus className="w-8 h-8 md:w-10 md:h-10" strokeWidth={2.25} />
          </span>

          <div className="flex flex-col items-center gap-1.5">
            <p className={`text-lg md:text-xl font-extrabold ${rejected ? "text-red-600" : "text-primary"}`}>
              {rejected
                ? "PDF · PPT · DOCX · Excel · TXT 파일 1개, 200MB까지 올릴 수 있어요"
                : isDragActive ? "놓으면 바로 분석을 시작합니다" : "여기에 문서를 드래그해 주세요"}
            </p>
            {!rejected && !isDragActive && (
              <p className="text-sm text-muted-foreground">또는 클릭해서 파일 선택</p>
            )}
          </div>
        </div>

        <p className="mt-4 text-xs text-muted-foreground/80 text-center">
          업로드 시 <a href="/privacy" className="underline underline-offset-2 hover:text-foreground">개인정보 처리방침</a>에 동의한 것으로 봅니다 · 자료는 분석 후 서버에서 삭제됩니다
        </p>
      </div>

      {/* 첫 화면 아래 — 차별점 */}
      <div id="why" className="max-w-6xl mx-auto px-4 md:px-6 pb-20 grid md:grid-cols-2 gap-4">
        <div className="bg-accent/60 border border-primary/15 rounded-2xl p-6">
          <p className="text-primary font-bold text-sm mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            이 서비스는?
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80"><span className="text-foreground font-medium">187개 합격 포트폴리오</span>를 기준으로 비교</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">넥슨·넷마블·크래프톤 등 <span className="text-foreground font-medium">지원 회사 맞춤</span> 분석</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">문서에 없는 내용은 <span className="text-foreground font-medium">절대 칭찬하지 않음</span></p>
            </div>
            <div className="flex items-start gap-2.5">
              <BarChart3 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">수정본을 다시 올리면 <span className="text-foreground font-medium">이전 버전 대비 점수 변화</span> 확인</p>
            </div>
          </div>
        </div>

        <div className="bg-secondary border border-border rounded-2xl p-6">
          <p className="text-red-600 font-bold text-sm mb-4 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            GPT / Gemini에 넣으면?
          </p>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">&quot;핵심 루프를 잘 설계하세요&quot; — <span className="text-red-600/80">누구나 아는 교과서 말</span></p>
            </div>
            <div className="flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">&quot;밸런싱을 고려하세요&quot; — <span className="text-red-600/80">뭘 어떻게?</span></p>
            </div>
            <div className="flex items-start gap-2.5">
              <XCircle className="w-4 h-4 text-red-600/60 shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">&quot;유저 경험을 개선하세요&quot; — <span className="text-red-600/80">합격 기준 모름</span></p>
            </div>
          </div>
        </div>

        <p className="md:col-span-2 text-xs text-muted-foreground/80 text-center">
          11년차 현업 게임 기획자가 만든 학습 데이터 기반 AI
        </p>
      </div>
    </section>
  )
}
