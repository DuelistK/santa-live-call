"use client";
// 앱 실행 후 3초 안에 산타와 즉시 통화를 시작할 수 있는 메인 화면 및 간결한 바텀시트 설정 컴포넌트

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Phone, SlidersHorizontal, X, Check, ChevronRight } from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { SecretSantaNote } from "@/types/santa";

const QUICK_PRAISES = [
  { label: "친구와 사이좋게 지냄", value: "친구들과 사이좋게 지내고 양보도 잘한 일" },
  { label: "골고루 밥 잘 먹음", value: "편식하지 않고 반찬을 골고루 맛있게 먹은 일" },
  { label: "스스로 정리정돈", value: "가방과 장난감을 스스로 제자리에 잘 정리한 일" },
  { label: "씩씩한 등원·등교", value: "아침마다 울지 않고 씩씩하게 인사하며 등원한 일" },
];

const QUICK_MISSIONS = [
  { label: "일찍 잠자리 들기", value: "밤 9시 전에 스스로 잠자리에 들기" },
  { label: "깨끗이 양치하기", value: "밥 먹고 잠들기 전에 스스로 깨끗이 양치질하기" },
  { label: "장난감 제자리 정리", value: "놀고 난 장난감은 스스로 정리하기" },
  { label: "약속한 시간만 영상 보기", value: "유튜브와 영상은 부모님과 약속한 시간만 보기" },
];

export default function HomePage() {
  const router = useRouter();
  const { note, setNote } = useSantaSession();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [draft, setDraft] = useState<SecretSantaNote>(note);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  const hasCustomName = Boolean(note.childName && note.childName !== "우리 아이");

  const handleImmediateCall = () => {
    router.push("/call");
  };

  const handleOpenSheet = () => {
    setDraft(note);
    setIsSheetOpen(true);
  };

  const handleSaveAndClose = (startCallAfterSave: boolean) => {
    const cleaned: SecretSantaNote = {
      ...draft,
      childName: draft.childName.trim(),
      childAge: draft.childAge.trim() || "6",
      praise: draft.praise.trim() || "올해도 건강하고 밝게 자라며 친구들과 사이좋게 지낸 일",
      mission: draft.mission.trim() || "밤에 일찍 잠자리에 들고 스스로 깨끗이 양치질하기",
      giftHint: draft.giftHint.trim() || "크리스마스 깜짝 선물",
      avatarProvider: draft.avatarProvider || "anam",
    };
    setNote(cleaned);
    setIsSheetOpen(false);
    if (startCallAfterSave) {
      router.push("/call");
    }
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-[#0A0F1D] text-[#F9F6F0] px-7 pt-7 pb-10 select-none overflow-hidden">
      {/* 은은한 상단 배경 조명 (절제된 웜 레드 포인트) */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#9E1B20]/18 blur-[95px]" />

      {/* 상단 바: 북극 연결 상태 & 미니멀 맞춤 설정 버튼 */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-medium text-[#F9F6F0]/80 tracking-tight">
            북극 산타 마을 연결 가능
          </span>
        </div>

        <button
          type="button"
          onClick={handleOpenSheet}
          aria-label="아이 정보 맞춤 설정"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-xs font-medium text-[#F9F6F0]/75 transition active:scale-95"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4AF37]" />
          <span>{hasCustomName ? `${note.childName} 맞춤` : "맞춤 설정"}</span>
        </button>
      </header>

      {/* 중앙 영역: 전화를 기다리는 산타 캐릭터와 간결한 타이포그래피 */}
      <section className="relative z-10 flex flex-col items-center text-center my-auto py-6">
        <div className="relative flex items-center justify-center mb-8">
          {/* 절제된 골드 파동 링 */}
          <div className="absolute w-52 h-52 rounded-full border border-[#D4AF37]/15 animate-pulse-slow" />
          <div className="absolute w-44 h-44 rounded-full border border-[#D4AF37]/25" />

          <div className="relative w-36 h-36 rounded-full bg-[#111827] border-2 border-[#D4AF37]/65 shadow-[0_24px_60px_rgba(0,0,0,0.65)] flex items-center justify-center">
            <span className="text-7xl select-none" role="img" aria-label="산타할아버지">
              🎅
            </span>
            {/* 실시간 대기 중 표시 */}
            <span className="absolute bottom-1.5 right-2.5 w-4 h-4 rounded-full bg-emerald-400 ring-4 ring-[#0A0F1D]" />
          </div>
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#D4AF37] mb-2.5">
          North Pole Direct Call
        </p>

        <h1 className="text-[28px] font-bold tracking-tight text-[#F9F6F0] leading-[1.3]">
          산타할아버지가
          <br />
          전화를 기다리고 있어요
        </h1>

        <p className="mt-3 text-sm text-[#F9F6F0]/55 font-normal">
          {hasCustomName ? (
            <>
              <button
                type="button"
                onClick={handleOpenSheet}
                className="text-[#F9F6F0]/90 font-medium underline decoration-[#D4AF37]/60 underline-offset-4 hover:text-white"
              >
                {note.childName} 어린이
              </button>
              와 통화할 준비가 되었어요
            </>
          ) : (
            "별도 설정 없이 바로 산타와 대화할 수 있어요"
          )}
        </p>
      </section>

      {/* 하단 영역: 가장 눈에 띄는 '산타와 통화하기' 메인 버튼 */}
      <footer className="relative z-10 flex flex-col items-center gap-3.5">
        <button
          type="button"
          onClick={handleImmediateCall}
          className="w-full h-16 rounded-full bg-[#9E1B20] hover:bg-[#B22026] active:scale-[0.98] text-[#F9F6F0] font-semibold text-lg tracking-tight shadow-[0_14px_35px_rgba(158,27,32,0.45)] border border-white/15 flex items-center justify-center gap-3 transition-all duration-200"
        >
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <Phone className="w-4 h-4 fill-current" />
          </span>
          <span>산타와 통화하기</span>
        </button>

        <div className="flex items-center justify-between w-full px-2 pt-0.5 text-xs text-[#F9F6F0]/45">
          <button
            type="button"
            onClick={handleOpenSheet}
            className="hover:text-[#F9F6F0]/80 transition"
          >
            아이 이름·칭찬 설정 (선택)
          </button>
          <button
            type="button"
            onClick={() => router.push("/report")}
            className="inline-flex items-center gap-0.5 hover:text-[#F9F6F0]/80 transition"
          >
            <span>통화 기록</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* ============================================================
          바텀시트 (선택 사항): 아이 이름 & 원터치 칭찬/약속 칩
      ============================================================ */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSheetOpen(false)}
        >
          <div
            className="w-full max-w-[420px] rounded-t-[32px] bg-[#111827] border-t border-white/10 p-6 pb-8 space-y-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 rounded-full bg-white/15 mx-auto -mt-1 mb-1" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#F9F6F0]">
                  맞춤 통화 설정 (선택)
                </h2>
                <p className="text-xs text-[#F9F6F0]/55 mt-0.5">
                  비워두면 산타가 통화 중에 자연스럽게 이름을 물어봐요
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSheetOpen(false)}
                aria-label="닫기"
                className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#F9F6F0]/70"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. 아이 이름 (선택 입력) */}
            <div>
              <label className="block text-xs font-medium text-[#F9F6F0]/70 mb-1.5">
                아이 이름
              </label>
              <input
                type="text"
                value={draft.childName === "우리 아이" ? "" : draft.childName}
                onChange={(e) => setDraft({ ...draft, childName: e.target.value })}
                placeholder="입력하지 않아도 바로 통화 가능해요 (예: 지우)"
                className="w-full h-11 px-3.5 rounded-xl bg-[#0A0F1D] border border-white/10 text-sm text-[#F9F6F0] placeholder-[#F9F6F0]/30 focus:outline-none focus:border-[#D4AF37]"
              />
            </div>

            {/* 2. 칭찬 주제 (선택형 칩) */}
            <div>
              <label className="block text-xs font-medium text-[#F9F6F0]/70 mb-1.5">
                산타가 칭찬해 줄 일
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PRAISES.map((item) => {
                  const selected = draft.praise === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, praise: item.value })}
                      className={`px-3 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition ${
                        selected
                          ? "bg-[#D4AF37]/15 border-[#D4AF37] text-[#F9F6F0]"
                          : "bg-[#0A0F1D]/70 border-white/[0.07] text-[#F9F6F0]/65 hover:border-white/20"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 약속할 습관 (선택형 칩) */}
            <div>
              <label className="block text-xs font-medium text-[#F9F6F0]/70 mb-1.5">
                산타와 약속할 습관
              </label>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_MISSIONS.map((item) => {
                  const selected = draft.mission === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, mission: item.value })}
                      className={`px-3 py-2.5 rounded-xl border text-left text-xs font-medium flex items-center justify-between transition ${
                        selected
                          ? "bg-[#D4AF37]/15 border-[#D4AF37] text-[#F9F6F0]"
                          : "bg-[#0A0F1D]/70 border-white/[0.07] text-[#F9F6F0]/65 hover:border-white/20"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 시트 하단 액션 버튼 */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleSaveAndClose(false)}
                className="h-12 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-[#F9F6F0] transition"
              >
                저장만 하기
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndClose(true)}
                className="h-12 rounded-full bg-[#9E1B20] hover:bg-[#B22026] text-xs font-semibold text-[#F9F6F0] flex items-center justify-center gap-1.5 shadow-lg transition"
              >
                <Phone className="w-3.5 h-3.5 fill-current" />
                <span>저장 후 바로 통화</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
