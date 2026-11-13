"use client";
// Step 1: 북극 직통 메인 홈 화면 & Step 2: 다자녀·기억 연동 '부모님 비밀 산타 수첩' + 수신 전화 예약 + 칭찬 도장판

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneIncoming,
  Video,
  Lock,
  Sparkles,
  X,
  Check,
  ChevronRight,
  Gift,
  Star,
  Plus,
  Trash2,
  BrainCircuit,
  PencilLine,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { SecretSantaNote } from "@/types/santa";
import {
  NorthPoleBackdrop,
  SantaSnowglobePortal,
} from "@/components/NorthPoleBackdrop";
import { ParentGateModal } from "@/components/ParentGateModal";
import { HabitStampModal } from "@/components/HabitStampModal";

const AGE_OPTIONS = [
  { label: "5세", value: "5" },
  { label: "6세", value: "6" },
  { label: "7세", value: "7" },
  { label: "8세+", value: "8" },
];

const QUICK_PRAISES = [
  {
    label: "친구와 사이좋게 지냄",
    value: "친구들과 사이좋게 지내고 양보도 잘한 일",
  },
  {
    label: "골고루 밥 잘 먹음",
    value: "편식하지 않고 반찬을 골고루 맛있게 먹은 일",
  },
  {
    label: "스스로 정리정돈",
    value: "가방과 장난감을 스스로 제자리에 잘 정리한 일",
  },
  {
    label: "씩씩한 등원",
    value: "아침마다 울지 않고 씩씩하게 인사하며 등원한 일",
  },
];

const QUICK_MISSIONS = [
  {
    label: "일찍 잠자리 들기",
    value: "밤 9시 전에 스스로 잠자리에 들기",
  },
  {
    label: "깨끗이 양치하기",
    value: "밥 먹고 잠들기 전에 스스로 깨끗이 양치질하기",
  },
  {
    label: "장난감 정리하기",
    value: "놀고 난 장난감은 스스로 정리하기",
  },
  {
    label: "약속 시간만 영상 보기",
    value: "유튜브와 영상은 부모님과 약속한 시간만 보기",
  },
];

const INCOMING_DELAY_OPTIONS = [
  { label: "즉시 벨 울리기", sec: 0 },
  { label: "5초 뒤 걸려오기", sec: 5 },
  { label: "15초 뒤 걸려오기", sec: 15 },
  { label: "30초 뒤 걸려오기", sec: 30 },
];

// 북극 황금 왁스실(Wax Seal) 비밀 편지 봉투 그래픽 아이콘
function GoldWaxEnvelopeBadge() {
  return (
    <div className="relative mx-auto w-14 h-11 rounded-xl bg-gradient-to-b from-[#F6E3AA] via-[#DFB95B] to-[#AD8428] p-[1px] shadow-[0_8px_22px_rgba(229,193,88,0.32)]">
      <div className="relative w-full h-full rounded-[11px] bg-gradient-to-b from-[#F5DF9E] to-[#C89E3B] overflow-hidden flex items-center justify-center">
        <svg
          viewBox="0 0 56 44"
          className="absolute inset-0 w-full h-full"
          fill="none"
        >
          <path
            d="M2 3L28 23L54 3"
            stroke="#8B6516"
            strokeOpacity="0.45"
            strokeWidth="1.5"
          />
          <path
            d="M2 41L20 24M54 41L36 24"
            stroke="#8B6516"
            strokeOpacity="0.28"
            strokeWidth="1.2"
          />
        </svg>
        <div className="relative z-10 w-6 h-6 rounded-full bg-gradient-to-b from-[#B47E1E] to-[#7B520E] border border-[#FFF2C2]/70 shadow-md flex items-center justify-center">
          <span className="text-[11px] font-serif font-bold text-[#FBE9B2] leading-none">
            S
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const {
    note,
    setNote,
    profiles,
    activeProfileId,
    switchProfile,
    addChildProfile,
    removeChildProfile,
    habitStamps,
    toggleHabitStamp,
    resetHabitStamps,
    callHistory,
    parentUnlocked,
    unlockParentGate,
    lockParentGate,
  } = useSantaSession();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showParentGate, setShowParentGate] = useState(false);
  const [pendingParentAction, setPendingParentAction] = useState<
    "sheet" | "incoming" | null
  >(null);
  const [showStampModal, setShowStampModal] = useState(false);
  const [showIncomingPicker, setShowIncomingPicker] = useState(false);
  const [draft, setDraft] = useState<SecretSantaNote>(note);
  const praiseInputRef = useRef<HTMLInputElement | null>(null);
  const missionInputRef = useRef<HTMLInputElement | null>(null);

  const isCustomPraise = Boolean(
    draft.praise.trim() &&
      !QUICK_PRAISES.some((item) => item.value === draft.praise)
  );
  const isCustomMission = Boolean(
    draft.mission.trim() &&
      !QUICK_MISSIONS.some((item) => item.value === draft.mission)
  );

  useEffect(() => {
    setDraft(note);
  }, [note, activeProfileId]);

  // /setup 리다이렉트(?setup=1)로 접근한 경우 시트 자동 오픈
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("setup") === "1") {
        setIsSheetOpen(true);
        window.history.replaceState(null, "", "/");
      }
    }
  }, []);

  const hasCustomName = Boolean(
    note.childName && note.childName.trim() && note.childName !== "우리 아이"
  );

  const handleImmediateCall = () => {
    router.push("/call");
  };

  const requestOpenParentFeature = (target: "sheet" | "incoming") => {
    if (parentUnlocked) {
      if (target === "sheet") {
        setDraft(note);
        setIsSheetOpen(true);
      } else {
        setShowIncomingPicker(true);
      }
      return;
    }
    setPendingParentAction(target);
    setShowParentGate(true);
  };

  const handleParentVerified = () => {
    unlockParentGate();
    setShowParentGate(false);
    if (pendingParentAction === "incoming") {
      setShowIncomingPicker(true);
    } else {
      setDraft(note);
      setIsSheetOpen(true);
    }
    setPendingParentAction(null);
  };

  const handleSaveAndClose = (startCallAfterSave: boolean) => {
    const cleaned: SecretSantaNote = {
      ...draft,
      childName: draft.childName.trim(),
      childAge: draft.childAge.trim() || "6",
      praise:
        draft.praise.trim() || "친구들과 사이좋게 지내고 양보도 잘한 일",
      mission: draft.mission.trim() || "밤 9시 전에 스스로 잠자리에 들기",
      giftHint: draft.giftHint.trim() || "크리스마스 깜짝 선물",
      avatarProvider: draft.avatarProvider || "anam",
    };
    setNote(cleaned);
    setIsSheetOpen(false);
    if (startCallAfterSave) {
      router.push("/call");
    }
  };

  const handleStartIncomingCall = (delaySec: number) => {
    setShowIncomingPicker(false);
    router.push(`/call?incoming=${delaySec}`);
  };

  return (
    <div className="relative flex-1 flex flex-col justify-between bg-[#080E1E] text-[#FAF7F2] px-6 pt-7 pb-8 select-none overflow-hidden">
      {/* 북극 오로라 & 눈송이 파티클 배경 */}
      <NorthPoleBackdrop intensity="normal" />

      {/* ============================================================
          상단 헤더: 북극 연결 가능 배지 & 동심 보호 '부모님 비밀수첩' 버튼
      ============================================================ */}
      <header className="relative z-10 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full glass-pill">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse" />
          <span className="text-xs font-semibold text-[#FAF7F2]/90 tracking-tight">
            북극 연결 가능
          </span>
        </div>

        <button
          type="button"
          onClick={() => requestOpenParentFeature("sheet")}
          aria-label="부모님 비밀 산타 수첩 열기"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full glass-pill hover:border-[#E5C158]/50 text-xs font-semibold text-[#FAF7F2]/90 transition active:scale-95"
        >
          <Lock className="w-3.5 h-3.5 text-[#E5C158]" />
          <span>부모님 비밀수첩</span>
        </button>
      </header>

      {/* ============================================================
          중앙 히어로: 황금 스노우글로브 산타 포털 & 메인 타이포그래피
      ============================================================ */}
      <section className="relative z-10 flex flex-col items-center text-center my-auto py-3">
        <div className="mb-6">
          <SantaSnowglobePortal mode="home" size="lg" />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#E5C158] mb-2">
          NORTH POLE DIRECT CALL
        </p>

        <h1 className="text-[28px] sm:text-[30px] font-extrabold tracking-tight text-[#FAF7F2] leading-[1.28] drop-shadow-[0_4px_16px_rgba(0,0,0,0.5)]">
          산타할아버지가 전화를
          <br />
          기다리고 있어요
        </h1>

        {/* 맞춤 상태 배지 & 칭찬 도장판 진입 배지 */}
        <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => requestOpenParentFeature("sheet")}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.09] border border-[#E5C158]/35 text-xs font-medium text-[#F3DC99] shadow-sm transition active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#E5C158] shrink-0" />
            <span>
              {hasCustomName
                ? `${note.childName} 어린이 (${note.childAge || "6"}세) 맞춤 준비 완료`
                : "아이 이름·칭찬 맞춤 준비 (선택)"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setShowStampModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E5C158]/14 hover:bg-[#E5C158]/22 border border-[#E5C158]/45 text-xs font-bold text-[#FFF2BF] transition active:scale-95"
          >
            <Star className="w-3.5 h-3.5 text-[#E5C158] fill-[#E5C158]" />
            <span>도장 {habitStamps.length}/5</span>
          </button>
        </div>

        {/* 다자녀 프로필이 2명 이상일 때 빠른 어린이 전환 칩 */}
        {profiles.length > 1 && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
            {profiles.map((prof, idx) => {
              const active = prof.id === activeProfileId;
              const label =
                prof.note.childName && prof.note.childName !== "우리 아이"
                  ? prof.note.childName
                  : `아이 ${idx + 1}`;
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => switchProfile(prof.id)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition ${
                    active
                      ? "bg-[#E5C158] text-[#080E1E]"
                      : "bg-white/[0.05] text-[#FAF7F2]/60 hover:text-white border border-white/10"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* ============================================================
          하단 푸터: 메인 영상통화 CTA + 산타 수신 전화 예약 + 보조 메뉴
      ============================================================ */}
      <footer className="relative z-10 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleImmediateCall}
          className="w-full h-16 rounded-full btn-velvet-crimson active:scale-[0.98] text-[#FAF7F2] font-bold text-[17px] tracking-tight flex items-center justify-center gap-3 transition-all duration-200"
        >
          <span className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center shadow-inner">
            <Video className="w-4 h-4 fill-current" />
          </span>
          <span>산타와 영상통화 시작하기</span>
        </button>

        {/* 산타에게서 먼저 걸려오는 수신 전화 예약 버튼 */}
        <button
          type="button"
          onClick={() => requestOpenParentFeature("incoming")}
          className="w-full h-11 rounded-full glass-pill hover:border-[#E5C158]/45 text-xs font-semibold text-[#F3DC99] flex items-center justify-center gap-2 transition active:scale-[0.99]"
        >
          <PhoneIncoming className="w-3.5 h-3.5 text-[#E5C158]" />
          <span>산타에게서 먼저 전화 걸려오기 (수신 예약)</span>
        </button>

        <div className="flex items-center justify-between w-full px-3 pt-0.5 text-xs font-medium text-[#FAF7F2]/55">
          <button
            type="button"
            onClick={() => requestOpenParentFeature("sheet")}
            className="hover:text-[#F3DC99] transition py-0.5"
          >
            아이 맞춤 설정
          </button>
          <button
            type="button"
            onClick={() => router.push("/report")}
            className="inline-flex items-center gap-0.5 hover:text-[#F3DC99] transition py-0.5"
          >
            <span>지난 통화 리포트</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* ============================================================
          모달 1: 어른 확인 잠금 게이트 (Parent Gate)
      ============================================================ */}
      <ParentGateModal
        open={showParentGate}
        onClose={() => {
          setShowParentGate(false);
          setPendingParentAction(null);
        }}
        onVerified={handleParentVerified}
      />

      {/* ============================================================
          모달 2: 착한 어린이 칭찬 습관 도장판
      ============================================================ */}
      <HabitStampModal
        open={showStampModal}
        childName={note.childName}
        mission={note.mission}
        stamps={habitStamps}
        onToggleStamp={toggleHabitStamp}
        onResetStamps={resetHabitStamps}
        onStartPraiseCall={() => {
          setShowStampModal(false);
          router.push("/call");
        }}
        onClose={() => setShowStampModal(false)}
      />

      {/* ============================================================
          모달 3: 산타 수신 전화 타이머 선택 모달 (Incoming Call Reservation)
      ============================================================ */}
      {showIncomingPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md px-6"
          onClick={() => setShowIncomingPicker(false)}
        >
          <div
            className="relative w-full max-w-[355px] rounded-[30px] bg-gradient-to-b from-[#141F3A] to-[#0A1122] border border-[#E5C158]/50 p-6 space-y-4 shadow-[0_24px_70px_rgba(0,0,0,0.9)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowIncomingPicker(false)}
              aria-label="닫기"
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-[#FAF7F2]/75"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center space-y-1">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-[#E5C158]/15 border border-[#E5C158]/40 flex items-center justify-center text-[#F3DC99] mb-2">
                <PhoneIncoming className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-extrabold text-[#FAF7F2]">
                산타 수신 전화 예약
              </h3>
              <p className="text-xs text-[#FAF7F2]/65 leading-relaxed">
                시간을 고른 뒤 아이 옆에 스마트폰을 놓아두면
                <br />
                북극 산타할아버지에게서 실제로 벨이 울리며 전화가 와요!
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {INCOMING_DELAY_OPTIONS.map((opt) => (
                <button
                  key={opt.sec}
                  type="button"
                  onClick={() => handleStartIncomingCall(opt.sec)}
                  className="h-12 rounded-2xl bg-[#18233E] hover:bg-[#223257] border border-[#E5C158]/40 text-xs font-bold text-[#FFF2BF] transition active:scale-95"
                >
                  🔔 {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          Step 2. 부모님 비밀 산타 수첩 바텀시트 (다자녀 프로필 + 에피소드 기억)
      ============================================================ */}
      {isSheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-md transition-opacity"
          onClick={() => setIsSheetOpen(false)}
        >
          <div
            className="relative w-full max-w-[420px] max-h-[92dvh] overflow-y-auto rounded-t-[34px] bg-gradient-to-b from-[#131E38] via-[#0E162B] to-[#090F1E] border-t-[1.5px] border-[#E5C158]/55 px-6 pt-4 pb-8 space-y-4 shadow-[0_-24px_70px_rgba(0,0,0,0.85)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 상단 드래그 핸들 & 다시 잠그기 / 닫기 버튼 */}
            <div className="w-11 h-1 rounded-full bg-white/20 mx-auto mb-1" />

            <button
              type="button"
              onClick={() => {
                lockParentGate();
                setIsSheetOpen(false);
              }}
              className="absolute top-5 left-5 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-semibold text-[#F3DC99]"
            >
              <Lock className="w-3 h-3" />
              <span>다시 잠그기</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSheetOpen(false)}
              aria-label="닫기"
              className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 flex items-center justify-center text-[#FAF7F2]/75 transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 봉투 왁스실 엠블럼 & 타이틀 */}
            <div className="text-center space-y-1 pt-1">
              <GoldWaxEnvelopeBadge />
              <h2 className="text-xl font-extrabold tracking-tight text-[#FAF7F2] pt-1">
                부모님 비밀 산타 수첩
              </h2>
              <p className="text-xs text-[#FAF7F2]/60">
                아이 몰래 입력하면 산타가 대화에 반영해요
              </p>
            </div>

            {/* 다자녀 프로필 전환 탭 바 */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {profiles.map((prof, idx) => {
                const isSelected = prof.id === activeProfileId;
                const tabName =
                  prof.note.childName && prof.note.childName !== "우리 아이"
                    ? prof.note.childName
                    : `아이 ${idx + 1}`;
                return (
                  <div key={prof.id} className="inline-flex items-center shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveAndClose(false);
                        setTimeout(() => {
                          switchProfile(prof.id);
                          setIsSheetOpen(true);
                        }, 0);
                      }}
                      className={`h-8 px-3 rounded-full text-xs font-bold transition ${
                        isSelected
                          ? "chip-gold-active"
                          : "bg-[#141D32] border border-white/10 text-[#FAF7F2]/65 hover:border-white/25"
                      }`}
                    >
                      {tabName}
                    </button>
                    {isSelected && profiles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChildProfile(prof.id)}
                        aria-label="프로필 삭제"
                        className="ml-1 w-7 h-7 rounded-full bg-white/[0.06] hover:bg-red-500/25 text-[#FAF7F2]/60 hover:text-red-300 flex items-center justify-center transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              {profiles.length < 4 && (
                <button
                  type="button"
                  onClick={() => {
                    setNote(draft);
                    addChildProfile();
                  }}
                  className="h-8 px-3 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-dashed border-[#E5C158]/45 text-xs font-semibold text-[#F3DC99] inline-flex items-center gap-1 shrink-0 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>동생·자녀 추가</span>
                </button>
              )}
            </div>

            {/* 에피소드 기억 안내 배지 (이전 통화 기록이 있을 때 노출) */}
            {callHistory.length > 0 && (
              <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-[#E5C158]/10 border border-[#E5C158]/35 text-xs text-[#F3DC99]">
                <BrainCircuit className="w-4 h-4 text-[#E5C158] shrink-0" />
                <span className="truncate">
                  이전 통화 {callHistory.length}회 기억 중 · 산타가 지난 약속을 먼저 물어봐요!
                </span>
              </div>
            )}

            {/* 1. 아이 이름 & 나이 원터치 선택 */}
            <div className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-5">
                <label className="block text-xs font-semibold text-[#FAF7F2]/75 mb-1.5">
                  아이 이름
                </label>
                <input
                  type="text"
                  value={draft.childName === "우리 아이" ? "" : draft.childName}
                  onChange={(e) =>
                    setDraft({ ...draft, childName: e.target.value })
                  }
                  placeholder="예: 지우"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#1A243B]/85 border border-white/15 text-sm font-medium text-[#FAF7F2] placeholder-[#FAF7F2]/35 focus:outline-none focus:border-[#E5C158]"
                />
              </div>

              <div className="col-span-7">
                <label className="block text-xs font-semibold text-[#FAF7F2]/75 mb-1.5">
                  나이
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {AGE_OPTIONS.map((opt) => {
                    const selected = (draft.childAge || "6") === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, childAge: opt.value })
                        }
                        className={`h-11 rounded-full text-xs font-bold transition ${
                          selected
                            ? "chip-gold-active"
                            : "bg-[#141D32] border border-white/10 text-[#FAF7F2]/65 hover:border-white/25"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. 산타가 칭찬해 줄 일 (원터치 칩 + 직접 입력) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#FAF7F2]/80">
                  <span role="img" aria-hidden="true">
                    🌟
                  </span>
                  <span>산타가 칭찬해 줄 일</span>
                </label>
                {isCustomPraise ? (
                  <span className="text-[11px] font-bold text-[#F3DC99]">
                    ✨ 직접 입력됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, praise: "" });
                      setTimeout(() => praiseInputRef.current?.focus(), 0);
                    }}
                    className="text-[11px] font-semibold text-[#E5C158]/85 hover:text-[#FFF2BF] transition"
                  >
                    + 직접 쓰기
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_PRAISES.map((item) => {
                  const selected = draft.praise === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setDraft({ ...draft, praise: item.value })}
                      className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                        selected
                          ? "chip-gold-active"
                          : "bg-[#141D32]/90 border border-white/15 text-[#FAF7F2]/75 hover:border-white/25"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="relative flex items-center">
                <PencilLine className="w-3.5 h-3.5 text-[#E5C158]/80 absolute left-3.5 pointer-events-none" />
                <input
                  ref={praiseInputRef}
                  type="text"
                  maxLength={50}
                  value={draft.praise}
                  onChange={(e) =>
                    setDraft({ ...draft, praise: e.target.value })
                  }
                  placeholder="직접 입력 (예: 유치원 발표회에서 씩씩하게 노래 부른 일)"
                  className={`w-full h-10 pl-9 pr-8 rounded-xl bg-[#1A243B]/85 text-xs font-medium text-[#FAF7F2] placeholder-[#FAF7F2]/35 focus:outline-none transition ${
                    isCustomPraise
                      ? "border border-[#E5C158]/65 shadow-[0_0_12px_rgba(229,193,88,0.14)]"
                      : "border border-white/15 focus:border-[#E5C158]"
                  }`}
                />
                {draft.praise && (
                  <button
                    type="button"
                    aria-label="칭찬 내용 지우고 직접 입력"
                    onClick={() => {
                      setDraft({ ...draft, praise: "" });
                      praiseInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#FAF7F2]/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. 손가락 걸고 약속할 습관 (원터치 칩 + 직접 입력) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[#FAF7F2]/80">
                  <span role="img" aria-hidden="true">
                    🤙
                  </span>
                  <span>손가락 걸고 약속할 습관</span>
                </label>
                {isCustomMission ? (
                  <span className="text-[11px] font-bold text-[#F3DC99]">
                    ✨ 직접 입력됨
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({ ...draft, mission: "" });
                      setTimeout(() => missionInputRef.current?.focus(), 0);
                    }}
                    className="text-[11px] font-semibold text-[#E5C158]/85 hover:text-[#FFF2BF] transition"
                  >
                    + 직접 쓰기
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {QUICK_MISSIONS.map((item) => {
                  const selected = draft.mission === item.value;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, mission: item.value })
                      }
                      className={`px-3.5 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
                        selected
                          ? "chip-gold-active"
                          : "bg-[#141D32]/90 border border-white/15 text-[#FAF7F2]/75 hover:border-white/25"
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>

              <div className="relative flex items-center">
                <PencilLine className="w-3.5 h-3.5 text-[#E5C158]/80 absolute left-3.5 pointer-events-none" />
                <input
                  ref={missionInputRef}
                  type="text"
                  maxLength={50}
                  value={draft.mission}
                  onChange={(e) =>
                    setDraft({ ...draft, mission: e.target.value })
                  }
                  placeholder="직접 입력 (예: 동생 장난감 뺏지 않고 사이좋게 놀기)"
                  className={`w-full h-10 pl-9 pr-8 rounded-xl bg-[#1A243B]/85 text-xs font-medium text-[#FAF7F2] placeholder-[#FAF7F2]/35 focus:outline-none transition ${
                    isCustomMission
                      ? "border border-[#E5C158]/65 shadow-[0_0_12px_rgba(229,193,88,0.14)]"
                      : "border border-white/15 focus:border-[#E5C158]"
                  }`}
                />
                {draft.mission && (
                  <button
                    type="button"
                    aria-label="약속 습관 지우고 직접 입력"
                    onClick={() => {
                      setDraft({ ...draft, mission: "" });
                      missionInputRef.current?.focus();
                    }}
                    className="absolute right-2.5 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-[#FAF7F2]/70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. 몰래 알려주는 선물 힌트 */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-semibold text-[#FAF7F2]/80 mb-1.5">
                <Gift className="w-3.5 h-3.5 text-[#E5C158]" />
                <span>몰래 알려주는 선물 힌트</span>
              </label>
              <div className="relative flex items-center">
                <span
                  className="absolute left-3.5 text-sm select-none"
                  role="img"
                  aria-hidden="true"
                >
                  🎁
                </span>
                <input
                  type="text"
                  value={
                    draft.giftHint === "크리스마스 깜짝 선물"
                      ? ""
                      : draft.giftHint
                  }
                  onChange={(e) =>
                    setDraft({ ...draft, giftHint: e.target.value })
                  }
                  placeholder="예: 레고 소방차, 티니핑 인형 (선택)"
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-[#1A243B]/85 border border-white/15 text-sm font-medium text-[#FAF7F2] placeholder-[#FAF7F2]/35 focus:outline-none focus:border-[#E5C158]"
                />
              </div>
            </div>

            {/* 시트 하단 액션 버튼 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleSaveAndClose(false)}
                className="h-12 rounded-full bg-[#182238] hover:bg-[#202D49] border border-[#E5C158]/40 text-xs font-bold text-[#F3DC99] transition active:scale-[0.98]"
              >
                수첩만 저장
              </button>
              <button
                type="button"
                onClick={() => handleSaveAndClose(true)}
                className="h-12 rounded-full btn-velvet-crimson text-xs font-bold text-[#FAF7F2] flex items-center justify-center gap-1.5 transition active:scale-[0.98]"
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
