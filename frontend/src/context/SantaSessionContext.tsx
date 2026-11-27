"use client";
// 다자녀 프로필, 산타 수첩, 칭찬 도장판, 통화 히스토리 및 하이라이트 녹화 영상을 관리하는 전역 컨텍스트

import React, { createContext, useContext, useEffect, useState } from "react";
import { ChildProfile, SantaReportData, SecretSantaNote } from "@/types/santa";

const STORAGE_PROFILES_KEY = "santa_mvp_profiles_v3";
const STORAGE_ACTIVE_PROFILE_KEY = "santa_mvp_active_profile_v3";
const STORAGE_REPORT_KEY = "santa_mvp_report_v2";
const SESSION_PARENT_UNLOCK_KEY = "santa_parent_unlocked_v1";

export const DEFAULT_SANTA_NOTE: SecretSantaNote = {
  childName: "",
  childAge: "6",
  praise: "올해도 건강하고 밝게 자라며 친구들과 사이좋게 지낸 일",
  mission: "밤에 일찍 잠자리에 들고 스스로 깨끗이 양치질하기",
  giftHint: "크리스마스 깜짝 선물",
  avatarProvider: "anam",
};

export const DEFAULT_SANTA_REPORT: SantaReportData = {
  id: "report-default",
  createdAt: new Date().toISOString(),
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

const INITIAL_PROFILE: ChildProfile = {
  id: "child-1",
  note: DEFAULT_SANTA_NOTE,
  habitStamps: [],
  reports: [],
};

interface SantaSessionContextValue {
  note: SecretSantaNote;
  setNote: (next: SecretSantaNote) => void;
  report: SantaReportData;
  setReport: React.Dispatch<React.SetStateAction<SantaReportData>>;
  profiles: ChildProfile[];
  activeProfileId: string;
  switchProfile: (profileId: string) => void;
  addChildProfile: () => void;
  removeChildProfile: (profileId: string) => void;
  habitStamps: string[];
  toggleHabitStamp: (slotId: string) => void;
  resetHabitStamps: () => void;
  callHistory: SantaReportData[];
  appendReportToHistory: (newReport: SantaReportData) => void;
  parentUnlocked: boolean;
  unlockParentGate: () => void;
  lockParentGate: () => void;
  recordedVideoUrl: string | null;
  recordedVideoExt: string;
  setRecordedVideo: (url: string | null, ext?: string) => void;
}

const SantaSessionContext = createContext<SantaSessionContextValue | undefined>(undefined);

export function SantaSessionProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<ChildProfile[]>([INITIAL_PROFILE]);
  const [activeProfileId, setActiveProfileId] = useState<string>(INITIAL_PROFILE.id);
  const [report, setReportState] = useState<SantaReportData>(DEFAULT_SANTA_REPORT);
  const [parentUnlocked, setParentUnlocked] = useState<boolean>(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoExt, setRecordedVideoExt] = useState<string>("webm");

  useEffect(() => {
    try {
      const savedProfiles = window.localStorage.getItem(STORAGE_PROFILES_KEY);
      if (savedProfiles) {
        const parsed = JSON.parse(savedProfiles) as ChildProfile[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setProfiles(parsed);
        }
      }
      const savedActiveId = window.localStorage.getItem(STORAGE_ACTIVE_PROFILE_KEY);
      if (savedActiveId) {
        setActiveProfileId(savedActiveId);
      }
      const savedReport = window.localStorage.getItem(STORAGE_REPORT_KEY);
      if (savedReport) {
        const parsedReport = JSON.parse(savedReport) as SantaReportData;
        setReportState(parsedReport);
      }
      const unlocked = window.sessionStorage.getItem(SESSION_PARENT_UNLOCK_KEY) === "1";
      setParentUnlocked(unlocked);
    } catch {
      // ignore storage errors
    }
  }, []);

  const persistProfiles = (nextProfiles: ChildProfile[], nextActiveId?: string) => {
    setProfiles(nextProfiles);
    try {
      window.localStorage.setItem(STORAGE_PROFILES_KEY, JSON.stringify(nextProfiles));
      if (nextActiveId) {
        window.localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, nextActiveId);
      }
    } catch {
      // ignore
    }
  };

  const activeProfile =
    profiles.find((p) => p.id === activeProfileId) || profiles[0] || INITIAL_PROFILE;

  const lastReport =
    activeProfile.reports.length > 0
      ? activeProfile.reports[activeProfile.reports.length - 1]
      : null;

  const enrichedNote: SecretSantaNote = {
    ...activeProfile.note,
    previousMemory: {
      callCount: activeProfile.reports.length,
      lastCallDate: lastReport?.createdAt || "",
      lastGifts: lastReport?.detectedGifts || [],
      lastPromise: lastReport?.missionPromise || activeProfile.note.mission,
      stampsCollected: activeProfile.habitStamps.length,
    },
  };

  const setNote = (next: SecretSantaNote) => {
    const updated = profiles.map((p) =>
      p.id === activeProfile.id ? { ...p, note: next } : p
    );
    persistProfiles(updated);
  };

  const switchProfile = (profileId: string) => {
    setActiveProfileId(profileId);
    try {
      window.localStorage.setItem(STORAGE_ACTIVE_PROFILE_KEY, profileId);
    } catch {
      // ignore
    }
  };

  const addChildProfile = () => {
    const newId = `child-${Date.now()}`;
    const newProf: ChildProfile = {
      id: newId,
      note: { ...DEFAULT_SANTA_NOTE },
      habitStamps: [],
      reports: [],
    };
    const nextList = [...profiles, newProf];
    setActiveProfileId(newId);
    persistProfiles(nextList, newId);
  };

  const removeChildProfile = (profileId: string) => {
    if (profiles.length <= 1) return;
    const filtered = profiles.filter((p) => p.id !== profileId);
    const nextActive = filtered[0].id;
    setActiveProfileId(nextActive);
    persistProfiles(filtered, nextActive);
  };

  const toggleHabitStamp = (slotId: string) => {
    const updated = profiles.map((p) => {
      if (p.id !== activeProfile.id) return p;
      const exists = p.habitStamps.includes(slotId);
      const nextStamps = exists
        ? p.habitStamps.filter((id) => id !== slotId)
        : [...p.habitStamps, slotId];
      return { ...p, habitStamps: nextStamps };
    });
    persistProfiles(updated);
  };

  const resetHabitStamps = () => {
    const updated = profiles.map((p) =>
      p.id === activeProfile.id ? { ...p, habitStamps: [] } : p
    );
    persistProfiles(updated);
  };

  const appendReportToHistory = (newReport: SantaReportData) => {
    const stampedReport: SantaReportData = {
      ...newReport,
      id: newReport.id || `rep-${Date.now()}`,
      createdAt: newReport.createdAt || new Date().toISOString(),
    };
    const updated = profiles.map((p) =>
      p.id === activeProfile.id
        ? { ...p, reports: [...p.reports.slice(-9), stampedReport] }
        : p
    );
    persistProfiles(updated);
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

  const unlockParentGate = () => {
    setParentUnlocked(true);
    try {
      window.sessionStorage.setItem(SESSION_PARENT_UNLOCK_KEY, "1");
    } catch {
      // ignore
    }
  };

  const lockParentGate = () => {
    setParentUnlocked(false);
    try {
      window.sessionStorage.removeItem(SESSION_PARENT_UNLOCK_KEY);
    } catch {
      // ignore
    }
  };

  const setRecordedVideo = (url: string | null, ext = "webm") => {
    setRecordedVideoUrl((prevUrl) => {
      if (prevUrl && prevUrl !== url) {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {
          // ignore
        }
      }
      return url;
    });
    setRecordedVideoExt(ext);
  };

  return (
    <SantaSessionContext.Provider
      value={{
        note: enrichedNote,
        setNote,
        report,
        setReport,
        profiles,
        activeProfileId: activeProfile.id,
        switchProfile,
        addChildProfile,
        removeChildProfile,
        habitStamps: activeProfile.habitStamps,
        toggleHabitStamp,
        resetHabitStamps,
        callHistory: activeProfile.reports,
        appendReportToHistory,
        parentUnlocked,
        unlockParentGate,
        lockParentGate,
        recordedVideoUrl,
        recordedVideoExt,
        setRecordedVideo,
      }}
    >
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
