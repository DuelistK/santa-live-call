export interface SecretSantaNote {
  childName: string;
  childAge: string;
  praise: string;
  mission: string;
  giftHint: string;
  avatarProvider?: "anam" | "lemonslice" | "heygen";
}

export interface ChatTurn {
  id: string;
  speaker: "santa" | "child";
  text: string;
  timestamp: string;
}

export interface SantaReportData {
  childName: string;
  callDurationSec: number;
  detectedGifts: string[];
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
