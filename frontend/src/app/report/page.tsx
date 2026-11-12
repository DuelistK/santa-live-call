"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  Gift,
  Sparkles,
  CheckCircle2,
  MessageCircleHeart,
  Clock,
  RotateCcw,
  PhoneCall,
  Award,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";

export default function ReportPage() {
  const router = useRouter();
  const { note, report } = useSantaSession();

  const gifts =
    report.detectedGifts && report.detectedGifts.length > 0
      ? report.detectedGifts
      : [note.giftHint || "레고 시티 소방차 세트"];

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#131F3E] via-[#0F172A] to-[#090D1A] text-slate-100 overflow-y-auto">
      {/* 상단 리포트 헤더 */}
      <header className="px-5 pt-6 pb-4 border-b border-white/10 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-red-950/60">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30">
            <Sparkles className="w-3.5 h-3.5" />
            부모님 전용 · 북극 통화 분석 완료
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {Math.floor(report.callDurationSec / 60)}분 {report.callDurationSec % 60}초 통화
          </span>
        </div>

        <h1 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <span>🎁 산타의 비밀 리포트</span>
        </h1>
        <p className="text-xs text-slate-300 mt-1">
          산타할아버지가 <strong className="text-amber-300">{report.childName || note.childName}</strong> 어린이와 나누었던 비밀 이야기 요약입니다.
        </p>
      </header>

      {/* 본문 영역 */}
      <div className="flex-1 px-5 py-4 space-y-3.5">
        {/* 1. 아이가 말한 받고 싶은 선물 하이라이트 카드 */}
        <section className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 via-red-900/30 to-slate-900 border border-amber-400/40 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-amber-400" />
              대화 중 포착된 희망 선물 키워드
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-semibold">
              Gemini 2.5 추출
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            {gifts.map((gift, idx) => (
              <span
                key={`${gift}-${idx}`}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs shadow-sm flex items-center gap-1.5"
              >
                <span>🎄</span>
                <span>{gift}</span>
              </span>
            ))}
          </div>

          <p className="text-[11px] text-slate-300 mt-2.5 leading-relaxed">
            부모님이 힌트로 주신 <strong className="text-white">&lsquo;{note.giftHint}&rsquo;</strong> 키워드와 아이의 실제 발화 내용을 종합한 결과입니다.
          </p>
        </section>

        {/* 2. 대화 요약 & 생활 습관 약속 결과 */}
        <section className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2.5">
          <div>
            <h2 className="text-xs font-bold text-sky-300 flex items-center gap-1.5 mb-1">
              <MessageCircleHeart className="w-4 h-4 text-sky-400" />
              오늘의 영상 통화 요약
            </h2>
            <p className="text-xs text-slate-200 leading-relaxed">
              {report.conversationSummary}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <h3 className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              손가락 걸고 다짐한 약속 미션
            </h3>
            <p className="text-xs text-slate-200 leading-relaxed">
              {report.missionPromise}
            </p>
          </div>
        </section>

        {/* 3. 산타할아버지의 코멘트 */}
        <section className="p-3.5 rounded-2xl bg-red-950/35 border border-red-400/25">
          <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5 mb-1">
            <Award className="w-4 h-4 text-amber-400" />
            산타할아버지가 부모님께 전하는 한마디
          </div>
          <p className="text-xs text-slate-200 leading-relaxed italic">
            &ldquo;{report.santaComment}&rdquo;
          </p>
        </section>

        {/* 4. 주요 대화 로그 하이라이트 */}
        {report.transcript && report.transcript.length > 0 && (
          <section className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/90">
            <h3 className="text-xs font-bold text-slate-300 mb-2">
              📝 통화 대화록 하이라이트
            </h3>
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {report.transcript.map((turn) => (
                <div
                  key={turn.id}
                  className={`p-2 rounded-xl text-xs leading-relaxed ${
                    turn.speaker === "santa"
                      ? "bg-red-950/40 border border-red-500/20 text-slate-100"
                      : "bg-sky-950/40 border border-sky-500/20 text-sky-100"
                  }`}
                >
                  <span className="font-bold mr-1.5">
                    {turn.speaker === "santa" ? "🎅 산타:" : `🧒 ${note.childName}:`}
                  </span>
                  <span>{turn.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* 하단 액션 버튼 */}
      <footer className="px-5 pt-2 pb-5 grid grid-cols-2 gap-2.5 border-t border-white/10 bg-slate-950/80">
        <button
          type="button"
          onClick={() => router.push("/setup")}
          className="py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center justify-center gap-1.5 transition"
        >
          <RotateCcw className="w-4 h-4" />
          <span>노트 다시 작성</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/call")}
          className="py-3 px-4 rounded-2xl bg-gradient-to-r from-red-600 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-xs shadow-lg shadow-red-950/50 flex items-center justify-center gap-1.5 transition"
        >
          <PhoneCall className="w-4 h-4" />
          <span>다시 통화하기</span>
        </button>
      </footer>
    </div>
  );
}
