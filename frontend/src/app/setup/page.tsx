"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  Gift,
  Heart,
  CheckCircle2,
  PhoneCall,
  ShieldCheck,
  UserCheck,
  Cpu,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { SecretSantaNote } from "@/types/santa";

const PRESET_TEMPLATES: Array<{ label: string; data: SecretSantaNote }> = [
  {
    label: "6세 지우 (양치질 & 레고)",
    data: {
      childName: "지우",
      childAge: "6",
      praise: "유치원에서 친구들과 장난감을 사이좋게 나누어 쓰고 브로콜리도 다 먹은 일",
      mission: "밤 9시 전에 스스로 양치질하고 잠자리에 들기",
      giftHint: "레고 시티 소방차 세트",
      avatarProvider: "anam",
    },
  },
  {
    label: "5세 서연 (편식 안 하기 & 티니핑)",
    data: {
      childName: "서연",
      childAge: "5",
      praise: "동생에게 그림책을 다정하게 읽어주고 신발 정리를 스스로 잘한 일",
      mission: "채소 반찬도 골고루 먹고 장난감 제자리에 정리하기",
      giftHint: "캐치! 티니핑 하츄핑 인형",
      avatarProvider: "anam",
    },
  },
];

export default function SetupPage() {
  const router = useRouter();
  const { note, setNote } = useSantaSession();
  const [form, setForm] = useState<SecretSantaNote>(note);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (
    field: keyof SecretSantaNote,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleStartCall = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setNote(form);
    router.push("/call");
  };

  return (
    <div className="flex-1 flex flex-col justify-between bg-gradient-to-b from-[#131F3E] via-[#0F172A] to-[#090D1A] text-slate-100 overflow-y-auto">
      {/* 상단 헤더 배너 */}
      <header className="relative px-5 pt-6 pb-4 border-b border-white/10 bg-gradient-to-r from-red-950/60 via-slate-900/80 to-emerald-950/50">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            부모님 전용 설정 (아이 몰래 작성하세요)
          </span>
          <span className="text-[11px] text-slate-400 font-mono">North Pole v1.0</span>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/50 border border-white/20 shrink-0">
            <span className="text-2xl" role="img" aria-label="Santa">
              🎅
            </span>
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
              비밀 산타 노트
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              입력하신 정보가 산타할아버지의 마법 수첩(AI 프롬프트)으로 즉시 전달됩니다.
            </p>
          </div>
        </div>

        {/* 빠른 예시 프리셋 버튼 */}
        <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
          <span className="text-[11px] text-slate-400 shrink-0">빠른 예시:</span>
          {PRESET_TEMPLATES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setForm(preset.data)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 border border-white/10 transition shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      {/* 메인 입력 폼 */}
      <form onSubmit={handleStartCall} className="flex-1 px-5 py-4 space-y-3.5">
        {/* 아이 이름 & 나이 */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              아이 이름 (호칭)
            </label>
            <input
              type="text"
              required
              value={form.childName}
              onChange={(e) => handleChange("childName", e.target.value)}
              placeholder="예: 지우"
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-200 mb-1">
              나이 (세)
            </label>
            <input
              type="number"
              min={2}
              max={13}
              required
              value={form.childAge}
              onChange={(e) => handleChange("childAge", e.target.value)}
              placeholder="6"
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* 올해 칭찬할 일 */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center gap-1">
            <Heart className="w-3.5 h-3.5 text-rose-400" />
            올해 산타가 꼭 칭찬해 줄 일
          </label>
          <textarea
            rows={2}
            required
            value={form.praise}
            onChange={(e) => handleChange("praise", e.target.value)}
            placeholder="예: 유치원에서 친구들과 장난감을 사이좋게 나누어 쓴 일"
            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs leading-relaxed text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
          />
        </div>

        {/* 당부할 습관 / 약속 미션 */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            산타와 손가락 걸고 약속할 생활 습관
          </label>
          <input
            type="text"
            required
            value={form.mission}
            onChange={(e) => handleChange("mission", e.target.value)}
            placeholder="예: 밤 9시 전에 스스로 양치질하고 일찍 자기"
            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* 선물 힌트 */}
        <div>
          <label className="block text-xs font-semibold text-slate-200 mb-1 flex items-center gap-1">
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            부모님이 생각하는 선물 힌트
          </label>
          <input
            type="text"
            required
            value={form.giftHint}
            onChange={(e) => handleChange("giftHint", e.target.value)}
            placeholder="예: 레고 시티 소방차 세트"
            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* 아바타 엔진 선택 (Anam 기본 / LemonSlice / HeyGen 스위칭) */}
        <div className="pt-1">
          <label className="block text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            실시간 아바타 파이프라인 (Factory Switching)
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleChange("avatarProvider", "anam")}
              className={`px-2.5 py-2 rounded-xl border text-left transition ${
                (form.avatarProvider || "anam") === "anam"
                  ? "bg-emerald-400/15 border-emerald-400 text-emerald-200"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                <span>Anam</span>
                <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-300">
                  무료 테스트 권장
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                기본 · 실시간 페르소나
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleChange("avatarProvider", "lemonslice")}
              className={`px-2.5 py-2 rounded-xl border text-left transition ${
                form.avatarProvider === "lemonslice"
                  ? "bg-amber-400/15 border-amber-400 text-amber-200"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                <span>LemonSlice</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                사진 1장 립싱크
              </p>
            </button>

            <button
              type="button"
              onClick={() => handleChange("avatarProvider", "heygen")}
              className={`px-2.5 py-2 rounded-xl border text-left transition ${
                form.avatarProvider === "heygen"
                  ? "bg-sky-400/15 border-sky-400 text-sky-200"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                <span>HeyGen</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                LiveAvatar Lite
              </p>
            </button>
          </div>
        </div>

        {/* 산타 첫인사 미리보기 카드 */}
        <div className="p-3 rounded-2xl bg-slate-900/90 border border-amber-400/25">
          <div className="text-[11px] font-semibold text-amber-300 mb-1">
            🎙️ 산타할아버지 첫인사 프리뷰
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            &ldquo;호호호! 우리 <strong className="text-amber-300">{form.childName || "아이"}</strong> 어린이 안녕! 올해{" "}
            <span className="underline decoration-amber-400/60">{form.praise || "착한 일"}</span> 한 모습을 북극 마법 수첩에서 다 보았단다!&rdquo;
          </p>
        </div>

        {/* 하단 CTA 버튼 */}
        <div className="pt-2 pb-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-bold text-sm shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 transition transform active:scale-[0.99]"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" />
            <span>아이에게 전화 건네주고 북극 연결하기</span>
          </button>
        </div>
      </form>
    </div>
  );
}
