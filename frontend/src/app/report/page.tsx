"use client";
// 통화 종료 후 하이라이트 녹화 영상 재생·저장, 대화 요약 및 다시 전화하기 기능을 제공하는 화면

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  Gift,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ArrowLeft,
  Download,
  Share2,
  Film,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";

export default function ReportPage() {
  const router = useRouter();
  const { note, report, recordedVideoUrl, recordedVideoExt } = useSantaSession();
  const [showTranscript, setShowTranscript] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  const childDisplayName =
    report.childName && report.childName !== "우리 아이"
      ? report.childName
      : note.childName && note.childName !== "우리 아이"
      ? note.childName
      : "우리 아이";

  const gifts =
    report.detectedGifts && report.detectedGifts.length > 0
      ? report.detectedGifts
      : [note.giftHint || "크리스마스 깜짝 선물"];

  const primaryGift = gifts[0];
  const naverShoppingUrl = `https://search.shopping.naver.com/search/all?query=${encodeURIComponent(
    primaryGift
  )}`;
  const coupangSearchUrl = `https://www.coupang.com/np/search?q=${encodeURIComponent(
    primaryGift
  )}`;

  const minutes = Math.floor(report.callDurationSec / 60);
  const seconds = report.callDurationSec % 60;
  const durationLabel =
    minutes > 0 ? `${minutes}분 ${seconds}초 통화` : `${seconds}초 통화`;

  const downloadFilename = `santa-call-${childDisplayName}-${new Date()
    .toISOString()
    .slice(0, 10)}.${recordedVideoExt || "webm"}`;

  const handleShareVideo = async () => {
    if (!recordedVideoUrl) return;
    try {
      const response = await fetch(recordedVideoUrl);
      const blob = await response.blob();
      const file = new File([blob], downloadFilename, {
        type: blob.type || "video/webm",
      });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `${childDisplayName}와(과) 산타할아버지의 영상통화`,
          text: `북극 산타할아버지와 ${childDisplayName}의 특별한 크리스마스 통화 기록입니다.`,
          files: [file],
        });
        return;
      }
    } catch {
      // 모바일 파일 공유 미지원 또는 취소 시 다운로드로 대체
    }

    const a = document.createElement("a");
    a.href = recordedVideoUrl;
    a.download = downloadFilename;
    a.click();
    setShareToast("영상 파일 다운로드를 시작했습니다.");
    setTimeout(() => setShareToast(null), 3000);
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-[#0A0F1D] text-[#F9F6F0] px-7 pt-7 pb-9 overflow-y-auto select-none">
      {/* 은은한 상단 배경 조명 */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#9E1B20]/15 blur-[95px]" />

      {/* 상단 내비게이션 */}
      <header className="relative z-10 flex items-center justify-between">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F9F6F0]/70 hover:text-[#F9F6F0] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>홈으로</span>
        </button>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs text-[#F9F6F0]/75">
          <Clock className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{durationLabel}</span>
        </div>
      </header>

      {/* 본문 콘텐츠 */}
      <main className="relative z-10 my-auto py-5 space-y-5">
        {/* 타이틀 & 산타 코멘트 */}
        <section className="text-center space-y-1.5">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#111827] border border-[#D4AF37]/60 flex items-center justify-center text-3xl shadow-lg mb-2">
            🎅
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#D4AF37]">
            Call Summary
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-[#F9F6F0]">
            산타할아버지와의 통화 완료
          </h1>
          <p className="text-xs text-[#F9F6F0]/65 leading-relaxed max-w-[300px] mx-auto pt-0.5">
            {report.santaComment}
          </p>
        </section>

        {/* 통화 하이라이트 녹화 영상 카드 (녹화된 영상이 있을 때 표시) */}
        {recordedVideoUrl && (
          <section className="rounded-3xl bg-[#111827] border border-[#D4AF37]/40 p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#F9F6F0] flex items-center gap-1.5">
                <Film className="w-4 h-4 text-[#D4AF37]" />
                <span>통화 하이라이트 영상 (산타 + {childDisplayName})</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D4AF37]/15 text-[#D4AF37] font-medium">
                자동 녹화됨
              </span>
            </div>

            <div className="relative w-full aspect-[9/16] max-h-64 rounded-2xl overflow-hidden bg-[#0A0F1D] border border-white/10 flex items-center justify-center">
              <video
                src={recordedVideoUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <a
                href={recordedVideoUrl}
                download={downloadFilename}
                className="h-10 rounded-xl bg-[#D4AF37] hover:bg-[#e2be46] text-[#0A0F1D] font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>영상 저장하기</span>
              </a>
              <button
                type="button"
                onClick={handleShareVideo}
                className="h-10 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 text-[#F9F6F0] font-semibold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>공유하기</span>
              </button>
            </div>

            {shareToast && (
              <p className="text-[11px] text-center text-[#D4AF37]">{shareToast}</p>
            )}
          </section>
        )}

        {/* 정제된 단일 요약 카드 */}
        <section className="rounded-3xl bg-[#111827] border border-white/[0.08] p-5 space-y-4 shadow-xl">
          {/* 1. 소원 선물 키워드 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[#F9F6F0]/60 flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>이야기 나눈 선물</span>
              </span>
              <span className="text-[11px] text-[#D4AF37] font-medium">
                {childDisplayName}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {gifts.map((gift, idx) => (
                <span
                  key={`${gift}-${idx}`}
                  className="px-3.5 py-1.5 rounded-full bg-[#0A0F1D] border border-[#D4AF37]/45 text-xs font-semibold text-[#F9F6F0]"
                >
                  {gift}
                </span>
              ))}
            </div>

            {/* 부모님을 위한 절제된 선물 검색 링크 */}
            <div className="flex items-center gap-3 pt-1 text-[11px] text-[#F9F6F0]/55">
              <a
                href={coupangSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#D4AF37] transition"
              >
                <span>쿠팡에서 선물 보기</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <span className="text-white/15">·</span>
              <a
                href={naverShoppingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#D4AF37] transition"
              >
                <span>네이버 쇼핑 검색</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* 2. 산타와의 약속 */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#F9F6F0]/60 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>산타와 약속한 습관</span>
            </span>
            <p className="text-xs text-[#F9F6F0]/90 leading-relaxed">
              {report.missionPromise}
            </p>
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* 3. 대화 요약 */}
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-[#F9F6F0]/60">
              오늘의 대화 요약
            </span>
            <p className="text-xs text-[#F9F6F0]/80 leading-relaxed">
              {report.conversationSummary}
            </p>
          </div>

          {/* 4. 대화 기록 토글 */}
          {report.transcript && report.transcript.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="w-full flex items-center justify-between py-2 px-3 rounded-xl bg-[#0A0F1D]/70 hover:bg-[#0A0F1D] border border-white/[0.06] text-xs text-[#F9F6F0]/70 transition"
              >
                <span>대화 내용 보기 ({report.transcript.length}건)</span>
                {showTranscript ? (
                  <ChevronUp className="w-4 h-4 text-[#D4AF37]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#D4AF37]" />
                )}
              </button>

              {showTranscript && (
                <div className="mt-2.5 space-y-2 max-h-44 overflow-y-auto pr-1">
                  {report.transcript.map((turn) => (
                    <div
                      key={turn.id}
                      className="p-2.5 rounded-xl bg-[#0A0F1D] border border-white/[0.05] text-xs leading-relaxed"
                    >
                      <span
                        className={`font-semibold mr-1.5 ${
                          turn.speaker === "santa"
                            ? "text-[#D4AF37]"
                            : "text-[#F9F6F0]/70"
                        }`}
                      >
                        {turn.speaker === "santa" ? "산타할아버지:" : `${childDisplayName}:`}
                      </span>
                      <span className="text-[#F9F6F0]/90">{turn.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 하단 액션: 다시 전화하기 메인 버튼 & 홈 이동 */}
      <footer className="relative z-10 flex flex-col items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.push("/call")}
          className="w-full h-15 py-4 rounded-full bg-[#9E1B20] hover:bg-[#B22026] active:scale-[0.98] text-[#F9F6F0] font-semibold text-base tracking-tight shadow-[0_14px_35px_rgba(158,27,32,0.45)] border border-white/15 flex items-center justify-center gap-2.5 transition-all duration-200"
        >
          <Phone className="w-4 h-4 fill-current" />
          <span>산타에게 다시 전화하기</span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="py-1.5 text-xs font-medium text-[#F9F6F0]/50 hover:text-[#F9F6F0]/85 transition"
        >
          처음 화면으로 돌아가기
        </button>
      </footer>
    </div>
  );
}
