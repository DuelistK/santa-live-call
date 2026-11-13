// 산타 통화 설정, 리포트, 마법 이펙트 및 WebRTC 연결을 위한 공통 타입 정의

export type SantaMagicEffectType = "snow" | "stamp" | "rudolph" | "gift";

export interface SantaMagicEvent {
  id: string;
  effect: SantaMagicEffectType;
  label: string;
}

export interface PreviousCallMemory {
  callCount: number;
  lastCallDate: string;
  lastGifts: string[];
  lastPromise: string;
  stampsCollected?: number;
}

export interface SecretSantaNote {
  childName: string;
  childAge: string;
  praise: string;
  mission: string;
  giftHint: string;
  avatarProvider?: "anam" | "lemonslice" | "heygen";
  previousMemory?: PreviousCallMemory;
}

export interface ChildProfile {
  id: string;
  note: SecretSantaNote;
  habitStamps: string[];
  reports: SantaReportData[];
}

export interface ChatTurn {
  id: string;
  speaker: "santa" | "child";
  text: string;
  timestamp: string;
}

export interface SantaReportData {
  id?: string;
  createdAt?: string;
  childName: string;
  callDurationSec: number;
  detectedGifts: string[];
  giftReasonSummary?: string;
  conversationSummary: string;
  missionPromise: string;
  santaComment: string;
  transcript: ChatTurn[];
}

export interface ConnectionDetailsResponse {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
  demoMode: boolean;
  metadata: SecretSantaNote;
}
