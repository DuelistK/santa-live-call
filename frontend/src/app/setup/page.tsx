"use client";
// 부모님이 아이 몰래 아이 이름, 칭찬, 약속 미션, 선물 힌트를 설정하고 아이 모드로 전환하는 화면

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
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Volume2,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { SecretSantaNote } from "@/types/santa";

const PRESET_TEMPLATES: Array<{ label: string; data: SecretSantaNote }> = [
  {
    label: "👧 6세 지우 (양치질 & 레고)",
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
    label: "🧒 5세 서연 (편식 안 하기 & 티니핑)",
    data: {
      childName: "서연",
      childAge: "5",
      praise: "동생에게 그림책을 다정하게 읽어주고 신발 정리를 스스로 잘한 일",
      mission: "채소 반찬도 골고루 먹고 장난감 제자리에 정리하기",
      giftHint: "캐치! 티니핑 하츄핑 인형",
      avatarProvider: "anam",
    },
  },
  {
    label: "👦 7세 민준 (일찍 자기 & 닌텐도)",
    data: {
      childName: "민준",
      childAge: "7",
      praise: "태권도 학원에 씩씩하게 잘 다니고 엄마 아빠 심부름도 기쁘게 도와준 일",
      mission: "유튜브는 약속한 시간만 보고 밤 9시 반 전에 잠들기",
      giftHint: "닌텐도 스위치 마리오카트",
      avatarProvider: "anam",
    },
  },
];

const PRAISE_CHIPS = [
  "친구들과 장난감을 사이좋게 나누어 쓴 일",
  "채소 반찬도 남기지 않고 밥을 잘 먹은 일",
  "동생을 다정하게 챙겨주고 잘 놀아준 일",
  "어린이집·유치원에 울지 않고 씩씩하게 등원한 일",
];

const MISSION_CHIPS = [
  "밤 9시 전에 스스로 양치질하고 잠자리에 들기",
  "놀고 난 장난감은 스스로 제자리에 정리하기",
  "유튜브·스마트폰은 엄마 아빠와 약속한 시간만 보기",
  "편식하지 않고 골고루 맛있게 밥 먹기",
];

export default function SetupPage() {
  const router = useRouter();
  const { note, setNote } = useSantaSession();
  const [form, setForm] = useState<SecretSantaNote>(note);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showHandoverModal, setShowHandoverModal] = useState(false);

  const handleChange = (field: keyof SecretSantaNote, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenHandover = (e: React.FormEvent) => {
    e.preventDefault();
    setNote(form);
    setShowHandoverModal(true);
  };

  const handleConfirmCall = () => {
    setNote(form);
    router.push("/call");
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-gradient-to-b from-[#131F3E] via-[#0F172A] to-[#090D1A] text-slate-100 overflow-y-auto">
      {/* 상단 헤더 배너 */}
      <header className="relative px-5 pt-5 pb-3.5 border-b border-white/10 bg-gradient-to-r from-red-950/60 via-slate-900/80 to-emerald-950/50">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>처음으로</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30">
            <ShieldCheck className="w-3.5 h-3.5" />
            부모님 전용 (아이 몰래 작성)
          </span>
        </div>

        <div className="flex items-center gap-3 mt-1">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-600 to-red-800 flex items-center justify-center shadow-lg shadow-red-900/50 border border-white/20 shrink-0">
            <span className="text-2xl" role="img" aria-label="Santa">
              🎅
            </span>
          </div>
          <div>
            <h1 className="text-base font-extrabold tracking-tight text-white flex items-center gap-1.5">
              비밀 산타 노트 작성
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h1>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              추천 칩을 터치하면 타자 없이 5초 만에 산타의 마법 수첩이 완성됩니다.
            </p>
          </div>
        </div>

        {/* 빠른 예시 프리셋 버튼 */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[11px] text-amber-300 font-semibold shrink-0">원터치 프리셋:</span>
          {PRESET_TEMPLATES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setForm(preset.data)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-100 border border-white/15 transition shrink-0"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      {/* 메인 입력 폼 */}
      <form onSubmit={handleOpenHandover} className="flex-1 px-5 py-3.5 space-y-3.5">
        {/* 1. 아이 이름 & 나이 */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="col-span-2">
            <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-amber-400" />
              아이 이름 (산타가 부를 호칭)
            </label>
            <input
              type="text"
              required
              value={form.childName}
              onChange={(e) => handleChange("childName", e.target.value)}
              placeholder="예: 지우"
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-200 mb-1">
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
              className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-sm font-semibold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* 2. 올해 칭찬할 일 + 추천 칩 */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Heart className="w-3.5 h-3.5 text-rose-400" />
              올해 산타가 꼭 칭찬해 줄 일
            </span>
            <span className="text-[10px] text-slate-400 font-normal">아래 칩 터치 가능</span>
          </label>
          <textarea
            rows={2}
            required
            value={form.praise}
            onChange={(e) => handleChange("praise", e.target.value)}
            placeholder="예: 유치원에서 친구들과 장난감을 사이좋게 나누어 쓴 일"
            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs leading-relaxed text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 resize-none"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {PRAISE_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChange("praise", chip)}
                className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                  form.praise === chip
                    ? "bg-rose-500/20 border-rose-400 text-rose-200 font-semibold"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* 3. 당부할 습관 / 약속 미션 + 추천 칩 */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              산타와 손가락 걸고 약속할 생활 습관
            </span>
            <span className="text-[10px] text-slate-400 font-normal">아래 칩 터치 가능</span>
          </label>
          <input
            type="text"
            required
            value={form.mission}
            onChange={(e) => handleChange("mission", e.target.value)}
            placeholder="예: 밤 9시 전에 스스로 양치질하고 일찍 자기"
            className="w-full px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-700/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {MISSION_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => handleChange("mission", chip)}
                className={`text-[10px] px-2 py-1 rounded-lg border transition ${
                  form.mission === chip
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-200 font-semibold"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                + {chip}
              </button>
            ))}
          </div>
        </div>

        {/* 4. 선물 힌트 */}
        <div>
          <label className="block text-xs font-bold text-slate-200 mb-1 flex items-center gap-1">
            <Gift className="w-3.5 h-3.5 text-amber-400" />
            부모님이 생각하는 선물 힌트 (산타가 은근슬쩍 물어봐요)
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

        {/* 산타 첫인사 미리보기 카드 */}
        <div className="p-3 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/95 to-red-950/30 border border-amber-400/30">
          <div className="text-[11px] font-bold text-amber-300 mb-1 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            산타할아버지 첫인사 대사 미리보기
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">
            &ldquo;호호호! 우리 <strong className="text-amber-300">{form.childName || "아이"}</strong> 어린이 안녕! 올해{" "}
            <span className="underline decoration-amber-400/60">{form.praise || "착한 일"}</span> 한 모습을 북극 마법 수첩에서 다 보았단다!&rdquo;
          </p>
        </div>

        {/* 고급 설정 (아바타 엔진 스위칭 접기/펼치기) */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400 hover:text-slate-200 transition"
          >
            <span className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              실시간 아바타 엔진 설정 (현재:{" "}
              <strong className="text-emerald-300 uppercase">
                {form.avatarProvider || "anam"}
              </strong>
              )
            </span>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => handleChange("avatarProvider", "anam")}
                className={`px-2.5 py-2 rounded-xl border text-left transition ${
                  (form.avatarProvider || "anam") === "anam"
                    ? "bg-emerald-400/15 border-emerald-400 text-emerald-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>Anam</span>
                  <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-400/20 text-emerald-300">
                    무료 권장
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">기본 · 페르소나</p>
              </button>

              <button
                type="button"
                onClick={() => handleChange("avatarProvider", "lemonslice")}
                className={`px-2.5 py-2 rounded-xl border text-left transition ${
                  form.avatarProvider === "lemonslice"
                    ? "bg-amber-400/15 border-amber-400 text-amber-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">LemonSlice</div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">사진 1장 립싱크</p>
              </button>

              <button
                type="button"
                onClick={() => handleChange("avatarProvider", "heygen")}
                className={`px-2.5 py-2 rounded-xl border text-left transition ${
                  form.avatarProvider === "heygen"
                    ? "bg-sky-400/15 border-sky-400 text-sky-200"
                    : "bg-slate-900/60 border-slate-800 text-slate-400"
                }`}
              >
                <div className="text-xs font-bold">HeyGen</div>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">LiveAvatar Lite</p>
              </button>
            </div>
          )}
        </div>

        {/* 하단 CTA 버튼 */}
        <div className="pt-1 pb-4">
          <button
            type="submit"
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-red-600 via-red-500 to-amber-500 hover:from-red-500 hover:to-amber-400 text-white font-extrabold text-sm shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 transition transform active:scale-[0.99]"
          >
            <PhoneCall className="w-4 h-4 animate-bounce" />
            <span>작성 완료 · 아이에게 산타 전화 걸기</span>
          </button>
        </div>
      </form>

      {/* ============================================================
          아이에게 스마트폰 건네주기 전환 브릿지 모달 (부모 모드 -> 아이 모드)
      ============================================================ */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-5">
          <div className="w-full max-w-[380px] rounded-3xl bg-gradient-to-b from-[#1A274B] via-[#111A30] to-[#0B1020] border-2 border-amber-400/50 shadow-2xl p-6 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-red-600/25 border-2 border-amber-300 flex items-center justify-center text-5xl shadow-lg">
              🤫
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[11px] font-bold">
                아이 모드 전환 준비 완료!
              </span>
              <h2 className="text-xl font-extrabold text-white">
                이제 <span className="text-amber-300">{form.childName}</span> 어린이에게
                <br />
                스마트폰을 건네주세요!
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed pt-1">
                아래 버튼을 누르면 <strong className="text-white">북극 산타할아버지에게서 영상통화가 걸려오는 수신 화면</strong>이 시작됩니다.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 text-left space-y-1 text-[11px] text-slate-300">
              <div>• 아이가 직접 초록색 <strong className="text-emerald-300">[통화 받기]</strong> 버튼을 누르게 해주세요.</div>
              <div>• 마이크와 카메라 권한 팝업이 뜨면 <strong className="text-amber-300">[허용]</strong>을 눌러주세요.</div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowHandoverModal(false)}
                className="py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 transition"
              >
                다시 수정
              </button>
              <button
                type="button"
                onClick={handleConfirmCall}
                className="col-span-2 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-950/60 flex items-center justify-center gap-1.5 transition"
              >
                <PhoneCall className="w-4 h-4" />
                <span>지금 산타 전화 울리기!</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
