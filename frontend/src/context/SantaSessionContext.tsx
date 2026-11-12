"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { SantaReportData, SecretSantaNote } from "@/types/santa";

const STORAGE_NOTE_KEY = "santa_mvp_secret_note_v1";
const STORAGE_REPORT_KEY = "santa_mvp_report_v1";

export const DEFAULT_SANTA_NOTE: SecretSantaNote = {
  childName: "지우",
  childAge: "6",
  praise: "유치원에서 친구들과 장난감을 사이좋게 나누어 쓰고 브로콜리도 남기지 않고 잘 먹은 일",
  mission: "밤 9시 전에 스스로 양치질하고 잠자리에 들기",
  giftHint: "변신 로봇 카봇 또는 레고 소방차 세트",
  avatarProvider: "anam",
};

export const DEFAULT_SANTA_REPORT: SantaReportData = {
  childName: DEFAULT_SANTA_NOTE.childName,
  callDurationSec: 95,
  detectedGifts: ["레고 시티 소방차 세트", "변신 로봇 카봇"],
  conversationSummary:
    "산타할아버지가 유치원에서 친구들과 사이좋게 지낸 점을 칭찬하자 지우가 환하게 웃으며 대답했습니다. 크리스마스 선물로 레고 소방차와 변신 로봇을 받고 싶다고 신나게 이야기했습니다.",
  missionPromise:
    "오늘부터 밤 9시 전에 스스로 치카치카 양치질을 하고 일찍 자기로 산타할아버지와 손가락 걸고 약속했습니다.",
  santaComment:
    "호호호! 우리 지우가 약속을 아주 씩씩하게 잘해 주었답니다. 크리스마스이브에 머리맡 양말을 꼭 확인해 주세요!",
  transcript: [
    {
      id: "t-1",
      speaker: "santa",
      text: "호호호! 우리 지우 어린이, 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다! 올해 유치원에서 친구들이랑 장난감도 사이좋게 나누어 썼다고 마법 수첩에 다 적혀 있더구나!",
      timestamp: "00:04",
    },
    {
      id: "t-2",
      speaker: "child",
      text: "우와 산타할아버지 진짜예요? 네! 저 브로콜리도 다 먹었어요!",
      timestamp: "00:14",
    },
    {
      id: "t-3",
      speaker: "santa",
      text: "허허허, 그럼 진짜 산타할아버지이고말고! 방금 옆에서 루돌프가 반짝이는 코로 인사하느라 바빴단다. 우리 지우는 밤에 치카치카 양치질하고 일찍 자는 약속도 지킬 수 있겠니?",
      timestamp: "00:25",
    },
    {
      id: "t-4",
      speaker: "child",
      text: "네 약속할게요! 할아버지 저 크리스마스 선물로 레고 소방차랑 변신 로봇 받고 싶어요!",
      timestamp: "00:38",
    },
  ],
};

interface SantaSessionContextValue {
  note: SecretSantaNote;
  setNote: (next: SecretSantaNote) => void;
  report: SantaReportData;
  setReport: React.Dispatch<React.SetStateAction<SantaReportData>>;
}

const SantaSessionContext = createContext<SantaSessionContextValue | undefined>(undefined);

export function SantaSessionProvider({ children }: { children: React.ReactNode }) {
  const [note, setNoteState] = useState<SecretSantaNote>(DEFAULT_SANTA_NOTE);
  const [report, setReportState] = useState<SantaReportData>(DEFAULT_SANTA_REPORT);

  useEffect(() => {
    try {
      const savedNote = window.localStorage.getItem(STORAGE_NOTE_KEY);
      if (savedNote) {
        const parsed = JSON.parse(savedNote) as SecretSantaNote;
        setNoteState(parsed);
      }
      const savedReport = window.localStorage.getItem(STORAGE_REPORT_KEY);
      if (savedReport) {
        const parsedReport = JSON.parse(savedReport) as SantaReportData;
        setReportState(parsedReport);
      }
    } catch {
      // ignore localStorage read errors
    }
  }, []);

  const setNote = (next: SecretSantaNote) => {
    setNoteState(next);
    try {
      window.localStorage.setItem(STORAGE_NOTE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const setReport: React.Dispatch<React.SetStateAction<SantaReportData>> = (updater) => {
    setReportState((prev) => {
      const resolved = typeof updater === "function" ? updater(prev) : updater;
      try {
        window.localStorage.setItem(STORAGE_REPORT_KEY, JSON.stringify(resolved));
      } catch {
        // ignore
      }
      return resolved;
    });
  };

  return (
    <SantaSessionContext.Provider value={{ note, setNote, report, setReport }}>
      {children}
    </SantaSessionContext.Provider>
  );
}

export function useSantaSession() {
  const ctx = useContext(SantaSessionContext);
  if (!ctx) {
    throw new Error("useSantaSession must be used within SantaSessionProvider");
  }
  return ctx;
}
