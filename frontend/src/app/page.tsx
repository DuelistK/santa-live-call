"use client";
// 북극 산타 마을 실시간 영상통화 서비스 인트로 및 시작 화면

import React from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  PhoneCall,
  Gift,
  ShieldCheck,
  HeartHandshake,
  Video,
  Award,
  ChevronRight,
  Star,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-gradient-to-b from-[#162247] via-[#0E172E] to-[#080C18] text-slate-100 overflow-y-auto select-none">
      {/* 밤하늘 오로라 & 눈송이 장식 효과 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-96 h-60 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" />
        <div className="absolute top-28 -right-16 w-64 h-64 rounded-full bg-red-600/20 blur-3xl" />
        <div className="absolute bottom-32 -left-16 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl" />
      </div>

      {/* 상단 상태 바 */}
      <header className="relative z-10 px-5 pt-6 pb-2 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[11px] font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          북극 산타 작업실 실시간 연결 가능
        </div>
        <span className="text-[11px] text-amber-300/90 font-semibold flex items-center gap-1">
          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          크리스마스 에디션
        </span>
      </header>

      {/* 메인 히어로 영역 */}
      <section className="relative z-10 px-6 pt-3 pb-4 text-center flex flex-col items-center">
        <div className="relative my-2 flex items-center justify-center">
          <div className="absolute w-36 h-36 rounded-full bg-gradient-to-tr from-red-600/40 via-amber-400/30 to-emerald-400/30 blur-xl animate-pulse" />
          <div className="relative w-28 h-28 rounded-[32px] bg-gradient-to-b from-red-600 via-red-700 to-red-900 border-2 border-amber-300/80 shadow-[0_12px_40px_rgba(220,38,38,0.45)] flex flex-col items-center justify-center">
            <span className="text-6xl animate-float" role="img" aria-label="Santa">
              🎅
            </span>
            <span className="mt-1 px-2 py-0.5 rounded-full bg-black/50 text-[9px] font-bold text-amber-300 border border-amber-400/30">
              AI LIVE AVATAR
            </span>
          </div>
        </div>

        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white leading-snug">
          올겨울, 우리 아이에게
          <br />
          <span className="bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 bg-clip-text text-transparent">
            진짜 산타할아버지
          </span>
          의 전화가 옵니다
        </h1>

        <p className="mt-2 text-xs text-slate-300 leading-relaxed max-w-[320px]">
          부모님이 몰래 적어준 <strong className="text-white">비밀 산타 노트</strong>를 보고,
          산타할아버지가 아이 이름을 부르며 실시간 영상으로 대화해요!
        </p>
      </section>

      {/* 3단계 핵심 기능 카드 */}
      <section className="relative z-10 px-5 space-y-2.5">
        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center shrink-0 text-rose-300">
            <HeartHandshake className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300">
                STEP 1 · 부모님 몰래 설정
              </span>
              <h2 className="text-xs font-bold text-white">맞춤 칭찬 & 생활습관 약속</h2>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              &ldquo;브로콜리도 다 먹었구나!&rdquo;, &ldquo;오늘부터 9시 전에 양치하고 자기로 약속!&rdquo;
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center shrink-0 text-amber-300">
            <Video className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                STEP 2 · 아이와 영상통화
              </span>
              <h2 className="text-xs font-bold text-white">실시간 AI 산타 아바타 & 동심 수호</h2>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              녹화 영상이 아니에요! 아이의 질문을 듣고 눈을 맞추며 실시간으로 대답해요.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 backdrop-blur-md flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300">
            <Gift className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                STEP 3 · 통화 종료 후
              </span>
              <h2 className="text-xs font-bold text-white">산타의 비밀 선물 리포트 & 상장</h2>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              대화 중 아이가 말한 &lsquo;진짜 받고 싶은 선물&rsquo;을 추출해 부모님께 알려드려요.
            </p>
          </div>
        </div>
      </section>

      {/* 하단 통화권 배너 & 시작 CTA 버튼 */}
      <footer className="relative z-10 px-5 pt-4 pb-6 space-y-2.5">
        <div className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/15 via-red-500/15 to-emerald-500/15 border border-amber-400/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
            <span className="text-[11px] text-slate-200">
              현재 <strong className="text-amber-300">북극 직통 무료 체험권</strong>이 활성화되어 있습니다
            </span>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 shrink-0">
            FREE
          </span>
        </div>

        <button
          type="button"
          onClick={() => router.push("/setup")}
          className="w-full py-4 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-xl shadow-red-950/70 border border-white/20 flex items-center justify-center gap-2 transition transform active:scale-[0.99]"
        >
          <PhoneCall className="w-4 h-4 animate-bounce" />
          <span>부모님 전용 · 비밀 산타 노트 작성하기</span>
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="flex items-center justify-between pt-1 px-1">
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            아이 동심 보호 가드레일 적용됨
          </span>
          <button
            type="button"
            onClick={() => router.push("/report")}
            className="inline-flex items-center gap-1 text-[11px] text-amber-300/90 hover:text-amber-200 underline underline-offset-4"
          >
            <Award className="w-3.5 h-3.5" />
            샘플 산타 리포트 보기
          </button>
        </div>
      </footer>
    </div>
  );
}
