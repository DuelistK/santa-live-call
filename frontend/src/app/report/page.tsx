"use client";
// 통화 종료 후 아이가 말한 선물 키워드, 착한 어린이 인증서, 쇼핑 검색 및 통화권 패키지를 제공하는 리포트 화면

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
  ShoppingBag,
  ExternalLink,
  Home,
  Ticket,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";

export default function ReportPage() {
  const router = useRouter();
  const { note, report } = useSantaSession();

  const childDisplayName = report.childName || note.childName || "지우";
  const gifts =
    report.detectedGifts && report.detectedGifts.length > 0
      ? report.detectedGifts
      : [note.giftHint || "레고 시티 소방차 세트"];

  const primaryGift = gifts[0];
  const naverShoppingUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(
    primaryGift
  )}`;
  const coupangSearchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(
    primaryGift
  )}`;

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#131F3E] via-[#0F172A] to-[#090D1A] text-slate-100 overflow-y-auto">
      {/* 상단 리포트 헤더 */}
      <header className="px-5 pt-5 pb-4 border-b border-white/10 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-red-950/60">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white transition"
          >
            <Home className="w-3.5 h-3.5" />
            <span>홈으로</span>
          </button>

          <span className="inline-flex items-center gap-1 text-xs text-slate-300 font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            {Math.floor(report.callDurationSec / 60)}분 {report.callDurationSec % 60}초 통화 완료
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/15 text-emerald-300 border border-emerald-400/30 mb-1">
              <Sparkles className="w-3 h-3" />
              부모님 전용 · 북극 통화 분석 리포트
            </span>
            <h1 className="text-xl font-extrabold text-white tracking-tight">
              🎁 산타의 비밀 리포트
            </h1>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-400/15 border border-amber-400/40 flex items-center justify-center text-2xl">
            📜
          </div>
        </div>
      </header>

      {/* 본문 영역 */}
      <div className="flex-1 px-5 py-4 space-y-3.5">
        {/* 1. 북극 공식 '착한 어린이 인증서' 상장 카드 */}
        <section className="relative p-4 rounded-2xl bg-gradient-to-br from-[#2B1D14] via-[#1E162B] to-[#111827] border-2 border-amber-400/70 shadow-xl overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded bg-amber-400 text-slate-950">
              NORTH POLE OFFICIAL CERTIFICATE
            </span>
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
              <Award className="w-4 h-4 text-amber-400" />
              착한 어린이 임명장
            </span>
          </div>

          <div className="text-center py-2 space-y-1">
            <div className="text-base font-extrabold text-white">
              위 어린이: <span className="text-amber-300 underline underline-offset-4">{childDisplayName}</span> ({note.childAge}세)
            </div>
            <p className="text-[11px] text-slate-200 leading-relaxed">
              올 한 해 <strong className="text-amber-200">&ldquo;{note.praise}&rdquo;</strong> 모습을 보여주었으며, 산타할아버지와{" "}
              <strong className="text-emerald-300">&ldquo;{note.mission}&rdquo;</strong> 약속을 씩씩하게 다짐하였기에 북극 공식 착한 어린이로 임명합니다.
            </p>
          </div>

          <div className="mt-2 pt-2 border-t border-amber-400/20 flex items-center justify-between text-[10px] text-amber-200/80">
            <span>발급처: 북극 산타 마을 중앙 본부</span>
            <span className="font-bold text-amber-300">🎅 산타할아버지 (인)</span>
          </div>
        </section>

        {/* 2. 아이가 말한 받고 싶은 선물 하이라이트 & 최저가 바로 구매 */}
        <section className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-red-900/25 to-slate-900 border border-amber-400/40 shadow-lg space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
              <Gift className="w-4 h-4 text-amber-400" />
              대화 중 포착된 희망 선물 키워드
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200 font-semibold">
              AI 실시간 추출
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
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

          {/* 제휴 커머스 바로가기 버튼 (BM 연동) */}
          <div className="pt-1.5 grid grid-cols-2 gap-2">
            <a
              href={coupangSearchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-xl bg-red-600/90 hover:bg-red-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>쿠팡 최저가 찾기</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
            <a
              href={naverShoppingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>네이버 쇼핑 검색</span>
              <ExternalLink className="w-3 h-3 opacity-80" />
            </a>
          </div>
        </section>

        {/* 3. 대화 요약 & 생활 습관 약속 결과 */}
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

        {/* 4. 주요 대화 로그 하이라이트 */}
        {report.transcript && report.transcript.length > 0 && (
          <section className="p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/90">
            <h3 className="text-xs font-bold text-slate-300 mb-2">
              📝 실시간 통화 대화록 ({report.transcript.length}건)
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
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
                    {turn.speaker === "santa" ? "🎅 산타:" : `🧒 ${childDisplayName}:`}
                  </span>
                  <span>{turn.text}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. 북극 직통 통화권 패키지 안내 배너 (BM 프로토타입) */}
        <section className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-400/30 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-extrabold text-amber-300 flex items-center gap-1">
              <Ticket className="w-3.5 h-3.5" />
              산타의 약속 10분 통화권 패키지
            </div>
            <p className="text-[11px] text-slate-300 leading-snug">
              3분씩 3번 나눠 부르는 다회차 통화권 (칭찬 · 습관점검 · 이브 통화)
            </p>
          </div>
          <span className="px-2.5 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 font-extrabold text-xs shrink-0">
            9,900원
          </span>
        </section>
      </div>

      {/* 하단 액션 버튼 */}
      <footer className="px-5 pt-2.5 pb-5 grid grid-cols-2 gap-2.5 border-t border-white/10 bg-slate-950/80">
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
