"use client";
// 산타 통화 설정값(SecretSantaNote) 및 통화 후 리포트(SantaReportData) 전역 상태 컨텍스트

import React, { createContext, useContext, useEffect, useState } from "react";
import { SantaReportData, SecretSantaNote } from "@/types/santa";

const STORAGE_NOTE_KEY = "santa_mvp_secret_note_v2";
const STORAGE_REPORT_KEY = "santa_mvp_report_v2";

export const DEFAULT_SANTA_NOTE: SecretSantaNote = {
  childName: "",
  childAge: "6",
  praise: "올해도 건강하고 밝게 자라며 친구들과 사이좋게 지낸 일",
  mission: "밤에 일찍 잠자리에 들고 스스로 깨끗이 양치질하기",
  giftHint: "크리스마스 깜짝 선물",
  avatarProvider: "anam",
};

export const DEFAULT_SANTA_REPORT: SantaReportData = {
  childName: "우리 아이",
  callDurationSec: 65,
  detectedGifts: ["크리스마스 깜짝 선물"],
  conversationSummary:
    "산타할아버지가 올 한 해 건강하고 밝게 자란 모습을 따뜻하게 칭찬해 주었고, 크리스마스에 받고 싶은 선물과 소원에 대해 즐겁게 이야기를 나누었습니다.",
  missionPromise:
    "오늘부터 밤에 일찍 잠자리에 들고 스스로 양치질을 깨끗이 하기로 산타할아버지와 약속했습니다.",
  santaComment:
    "호호호! 산타할아버지 목소리에 귀 기울이며 씩씩하게 대답해 주었답니다. 따뜻한 크리스마스 보내세요!",
  transcript: [
    {
      id: "t-1",
      speaker: "santa",
      text: "호호호! 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다! 올해도 건강하고 씩씩하게 잘 지냈다고 마법 수첩에 다 적혀 있더구나!",
      timestamp: "00:03",
    },
    {
      id: "t-2",
      speaker: "child",
      text: "우와 산타할아버지 안녕하세요! 저 양치질도 잘했어요!",
      timestamp: "00:12",
    },
    {
      id: "t-3",
      speaker: "santa",
      text: "허허허, 정말 기특하구나! 우리 오늘부터 밤에 일찍 자고 양치질도 스스로 깨끗이 하기로 할아버지랑 손가락 걸고 약속할 수 있겠니?",
      timestamp: "00:22",
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
        setNoteState({ ...DEFAULT_SANTA_NOTE, ...parsed });
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
