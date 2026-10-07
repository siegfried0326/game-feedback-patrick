/**
 * 히어로 섹션 — 랜딩 페이지 최상단
 *
 * 검색창처럼 첫 화면 한가운데에 업로드 창 하나. 파일을 놓거나 고르면
 * lib/pending-upload에 담아 /analyze로 넘기고, 분석 페이지가 이어서 처리한다.
 * 서비스 차별점 카드는 첫 화면 아래로 내렸다.
 * 사용: app/page.tsx
 */
"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { useDropzone } from "react-dropzone"
import { Upload, XCircle, CheckCircle2, ArrowRight, BarChart3, ArrowDown } from "lucide-react"
import { MoonlightMark } from "@/components/brand-logo"
import { UPLOAD_ACCEPT, UPLOAD_MAX_SIZE, setPendingUpload } from "@/lib/pending-upload"

export function HeroSection() {
  const router = useRouter()
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: UPLOAD_ACCEPT,
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
      {/* 첫 화면 — 검색창처럼 업로드 창 하나 */}
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 md:px-6 pt-16 pb-10">
        <MoonlightMark className="w-14 h-12 mb-6" />
        <p className="text-xs md:text-sm font-bold tracking-[0.35em] text-primary uppercase mb-4">
          Moonlight Career Lab
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-foreground tracking-tight leading-tight mb-5 text-center">
          문라이트 아카이브
        </h1>
        <p className="text-base md:text-xl text-foreground/80 text-center max-w-2xl leading-relaxed mb-10">
          <span className="font-semibold text-primary">187개의 합격 포트폴리오</span>를 기준으로,
          <br className="hidden sm:block" /> 당신의 기획 문서가 실제로 통하는지 진단합니다.
        </p>

        {/* 업로드 창 */}
        <div
          {...getRootProps()}
          className={`group w-full max-w-2xl cursor-pointer rounded-full border bg-card pl-6 pr-2 py-2 flex items-center gap-4 transition-all
            shadow-[0_1px_6px_rgba(32,33,36,0.12)] hover:shadow-[0_2px_14px_rgba(0,70,173,0.22)]
            ${isDragActive ? "border-primary ring-4 ring-primary/15 bg-accent/40" : "border-border hover:border-primary/40"}`}
        >
          <input {...getInputProps()} aria-label="분석할 문서 올리기" />
          <Upload className={`w-5 h-5 shrink-0 ${isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
          <span className="flex-1 min-w-0 text-left text-sm md:text-base text-muted-foreground truncate">
            {isDragActive ? "여기에 놓으면 바로 분석을 시작합니다" : (
              <>
                <span className="hidden sm:inline">기획 문서를 끌어다 놓거나 클릭해서 올리세요</span>
                <span className="sm:hidden">기획 문서 올리기</span>
              </>
            )}
          </span>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 md:px-6 py-2.5 md:py-3 text-sm font-semibold text-white group-hover:bg-primary/90 transition-colors">
            분석하기
            <ArrowRight className="w-4 h-4" />
          </span>
        </div>

        <p className={`mt-4 text-xs md:text-sm text-center ${rejected ? "text-red-600" : "text-muted-foreground"}`}>
          {rejected
            ? "PDF · PPT · DOCX · Excel · TXT 파일 1개, 200MB까지 올릴 수 있어요."
            : "PDF · PPT · DOCX · Excel · TXT — 대용량도 OK · 첫 1회 무료"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground/80 text-center">
          업로드 시 개인정보 처리방침에 동의한 것으로 봅니다 · 자료는 분석 후 서버에서 삭제됩니다
        </p>

        <a href="#why" className="mt-14 inline-flex flex-col items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <span className="font-bold tracking-[0.25em] uppercase">Why Moonlight</span>
          <ArrowDown className="w-4 h-4 animate-bounce" />
        </a>
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
              <p className="text-sm text-foreground/80">넥슨·넷마블·크래프톤 등 <span className="text-foreground font-medium">회사별 합격자 평균</span>과 비교</p>
            </div>
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80">문서에 없는 내용은 <span className="text-foreground font-medium">절대 칭찬하지 않음</span></p>
            </div>
            <div className="flex items-start gap-2.5">
              <BarChart3 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80"><span className="text-foreground font-medium">합격자와 점수 비교</span>를 통해 객관적인 피드백 진행</p>
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
