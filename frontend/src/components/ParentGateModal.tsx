"use client";
// 아이의 동심을 보호하기 위한 부모 전용 '어른 확인 잠금 게이트' 모달

import React, { useMemo, useState } from "react";
import { Lock, ShieldCheck, X } from "lucide-react";

interface ParentGateModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
}

const CHALLENGES = [
  { a: 6, b: 4, choices: [18, 22, 24, 28] },
  { a: 7, b: 3, choices: [19, 21, 24, 27] },
  { a: 8, b: 4, choices: [28, 30, 32, 36] },
  { a: 9, b: 3, choices: [24, 27, 29, 33] },
];

export function ParentGateModal({
  open,
  onClose,
  onVerified,
}: ParentGateModalProps) {
  const [seed, setSeed] = useState(0);
  const [wrongShake, setWrongShake] = useState(false);

  const puzzle = useMemo(() => {
    return CHALLENGES[seed % CHALLENGES.length];
  }, [seed]);

  if (!open) return null;

  const answer = puzzle.a * puzzle.b;

  const handleSelect = (choice: number) => {
    if (choice === answer) {
      onVerified();
      return;
    }
    setWrongShake(true);
    setTimeout(() => {
      setWrongShake(false);
      setSeed((s) => s + 1);
    }, 450);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-6"
      onClick={onClose}
    >
      <div
        className={`relative w-full max-w-[340px] rounded-[30px] bg-gradient-to-b from-[#141F3A] to-[#0B1224] border border-[#E5C158]/45 p-6 text-center space-y-4 shadow-[0_24px_70px_rgba(0,0,0,0.85)] transition-transform ${
          wrongShake ? "scale-[0.97] border-red-400/70" : "scale-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#FAF7F2]/70"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E5C158]/15 border border-[#E5C158]/45 flex items-center justify-center text-[#F3DC99]">
          <Lock className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#E5C158]">
            PARENTS ONLY
          </p>
          <h3 className="text-lg font-extrabold text-[#FAF7F2]">
            부모님 확인 잠금
          </h3>
          <p className="text-xs text-[#FAF7F2]/65 leading-relaxed">
            아이의 동심을 지키기 위해 정답을 눌러 주세요
          </p>
        </div>

        <div className="py-2.5 rounded-2xl bg-[#080E1E]/85 border border-white/10">
          <span className="text-2xl font-extrabold tracking-wider text-[#F3DC99]">
            {puzzle.a} × {puzzle.b} = ?
          </span>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {puzzle.choices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleSelect(c)}
              className="h-12 rounded-2xl bg-[#182440] hover:bg-[#233359] active:scale-95 border border-[#E5C158]/35 text-sm font-extrabold text-[#FAF7F2] transition"
            >
              {c}
            </button>
          ))}
        </div>

        {wrongShake && (
          <p className="text-xs font-semibold text-red-300">
            앗, 다시 한번 계산해 볼까요?
          </p>
        )}

        <div className="pt-1 flex items-center justify-center gap-1.5 text-[11px] text-[#FAF7F2]/45">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80" />
          <span>현재 브라우저 세션 동안 잠금이 해제됩니다</span>
        </div>
      </div>
    </div>
  );
}
