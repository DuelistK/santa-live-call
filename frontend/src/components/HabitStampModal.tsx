"use client";
// 통화 후 아이와 매일 약속 습관을 실천하며 도장을 모으는 '착한 어린이 칭찬 도장판' 모달

import React from "react";
import { Phone, RotateCcw, Sparkles, Star, X } from "lucide-react";

interface HabitStampModalProps {
  open: boolean;
  childName: string;
  mission: string;
  stamps: string[];
  onToggleStamp: (slotId: string) => void;
  onResetStamps: () => void;
  onStartPraiseCall: () => void;
  onClose: () => void;
}

const STAMP_SLOTS = [
  { id: "day-1", label: "1일차" },
  { id: "day-2", label: "2일차" },
  { id: "day-3", label: "3일차" },
  { id: "day-4", label: "4일차" },
  { id: "day-5", label: "5일차" },
];

// 도장 찍을 때 경쾌한 마법 차임벨 효과음 재생
function playStampChime(completedAll: boolean) {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const notes = completedAll ? [523.25, 659.25, 783.99, 1046.5] : [659.25, 880];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + idx * 0.09;
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
    setTimeout(() => ctx.close().catch(() => {}), 900);
  } catch {
    // ignore audio block
  }
}

export function HabitStampModal({
  open,
  childName,
  mission,
  stamps,
  onToggleStamp,
  onResetStamps,
  onStartPraiseCall,
  onClose,
}: HabitStampModalProps) {
  if (!open) return null;

  const displayName =
    childName && childName !== "우리 아이" ? `${childName} 어린이` : "우리 아이";
  const count = stamps.length;
  const isCompleted = count >= 5;

  const handleSlotClick = (slotId: string) => {
    const willAdd = !stamps.includes(slotId);
    if (willAdd) {
      playStampChime(stamps.length + 1 >= 5);
    }
    onToggleStamp(slotId);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-5"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[370px] rounded-[32px] bg-gradient-to-b from-[#141F3B] via-[#0E162B] to-[#090E1C] border border-[#E5C158]/50 p-6 space-y-5 shadow-[0_28px_80px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#FAF7F2]/75"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 헤더 */}
        <div className="text-center space-y-1.5 pt-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5C158]/15 border border-[#E5C158]/40 text-xs font-bold text-[#F3DC99]">
            <Sparkles className="w-3.5 h-3.5 text-[#E5C158]" />
            <span>북극 마법 칭찬 도장판 ({count}/5)</span>
          </div>
          <h3 className="text-xl font-extrabold text-[#FAF7F2] pt-1">
            {displayName}의 약속 도장
          </h3>
          <p className="text-xs font-medium text-[#F3DC99]/90 bg-[#080E1E]/75 border border-white/10 rounded-xl px-3 py-2">
            🤙 “{mission}”
          </p>
        </div>

        {/* 5칸 도장 슬롯 */}
        <div className="grid grid-cols-5 gap-2 py-1">
          {STAMP_SLOTS.map((slot) => {
            const stamped = stamps.includes(slot.id);
            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleSlotClick(slot.id)}
                className="flex flex-col items-center gap-1.5 group"
              >
                <div
                  className={`aspect-square w-full rounded-full flex items-center justify-center transition-all duration-300 ${
                    stamped
                      ? "chip-gold-active scale-105 shadow-[0_0_20px_rgba(229,193,88,0.5)]"
                      : "bg-[#090F1F] border border-dashed border-[#E5C158]/35 text-[#FAF7F2]/30 group-hover:border-[#E5C158]/70"
                  }`}
                >
                  <Star
                    className={`w-5 h-5 ${
                      stamped ? "fill-[#121726] text-[#121726]" : ""
                    }`}
                  />
                </div>
                <span
                  className={`text-[11px] font-bold ${
                    stamped ? "text-[#F3DC99]" : "text-[#FAF7F2]/45"
                  }`}
                >
                  {slot.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 달성 안내 또는 진행 가이드 */}
        {isCompleted ? (
          <div className="rounded-2xl bg-gradient-to-r from-[#4E3912]/80 to-[#39270B]/80 border border-[#F3DC99]/60 p-3.5 text-center space-y-1">
            <p className="text-xs font-extrabold text-[#FFF5CF]">
              🎉 우와! 약속 도장 5개를 모두 모았어요!
            </p>
            <p className="text-[11px] text-[#FAF7F2]/80">
              지금 산타할아버지에게 전화해서 도장판을 다 채웠다고 자랑해 보세요!
            </p>
          </div>
        ) : (
          <p className="text-center text-xs text-[#FAF7F2]/60 leading-relaxed">
            약속을 지킨 날 동그라미를 눌러 황금 별 도장을 찍어 주세요!
            <br />
            도장 5개를 모으면 산타할아버지가 특별히 더 칭찬해 줘요 ✨
          </p>
        )}

        {/* 하단 버튼 */}
        <div className="flex items-center gap-2.5 pt-1">
          {count > 0 && (
            <button
              type="button"
              onClick={onResetStamps}
              title="도장판 초기화"
              className="h-12 px-3.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-[#FAF7F2]/70 inline-flex items-center gap-1 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>초기화</span>
            </button>
          )}
          <button
            type="button"
            onClick={onStartPraiseCall}
            className="flex-1 h-12 rounded-full btn-velvet-crimson text-xs font-bold text-[#FAF7F2] flex items-center justify-center gap-2 transition active:scale-[0.98]"
          >
            <Phone className="w-3.5 h-3.5 fill-current" />
            <span>
              {isCompleted
                ? "산타에게 칭찬 확인 전화하기"
                : "산타와 영상통화 걸기"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
