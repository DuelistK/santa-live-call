"use client";
// 산타에게 전화를 거는 발신 연출 및 실시간 음성·아바타 통화 화면

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  VideoTrack,
  useDataChannel,
  useLocalParticipant,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  Gift,
  MessageSquare,
  Send,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { ChatTurn, ConnectionDetailsResponse } from "@/types/santa";

// Web Audio API 기반 통화 연결음(신호음 + 은은한 차임) 생성 훅
function useOutgoingDialTone(active: boolean, muted: boolean) {
  useEffect(() => {
    if (!active || muted || typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const playRingback = () => {
      try {
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === "suspended") ctx.resume();

        // 부드러운 전화 연결 신호음 (440Hz + 480Hz 듀얼 톤)
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.035, now + 0.05);
        gain.gain.setValueAtTime(0.035, now + 0.75);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.88);
        osc2.stop(now + 0.88);
      } catch {
        // 브라우저 자동재생 정책 차단 시 무시
      }
    };

    playRingback();
    timer = setInterval(playRingback, 2200);

    return () => {
      if (timer) clearInterval(timer);
      if (ctx) {
        ctx.close().catch(() => {});
      }
    };
  }, [active, muted]);
}

// 우측 상단 전면 카메라 PIP (사용자가 카메라 버튼을 켰을 때 표시)
function ChildFrontCameraPip({
  videoEnabled,
  childName,
  onPermissionDenied,
}: {
  videoEnabled: boolean;
  childName: string;
  onPermissionDenied: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    let activeStream: MediaStream | null = null;
    let cancelled = false;

    if (!videoEnabled) {
      setHasCamera(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: "user", width: { ideal: 320 }, height: { ideal: 420 } },
        audio: false,
      })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        activeStream = mediaStream;
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
        setHasCamera(true);
      })
      .catch(() => {
        setHasCamera(false);
        onPermissionDenied();
      });

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEnabled, onPermissionDenied]);

  if (!videoEnabled) return null;

  return (
    <div className="relative w-24 h-32 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-[#111827] shrink-0 transition-all duration-300">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
          hasCamera ? "opacity-100" : "opacity-0"
        }`}
      />
      {!hasCamera && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#111827] p-2 text-center">
          <span className="text-[11px] text-[#F9F6F0]/60 font-medium">카메라 준비 중</span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
        <span className="text-[10px] font-medium text-[#F9F6F0] truncate">
          {childName || "나"}
        </span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            hasCamera ? "bg-emerald-400" : "bg-white/40"
          }`}
        />
      </div>
    </div>
  );
}

// LiveKit Room 내부 실시간 아바타 비디오 트랙 & DataChannel 수신 컴포넌트
function LiveKitActiveStage({
  onAvatarReady,
  onRemoteReport,
  onRemoteTranscript,
  onProvideChatSender,
  micEnabled,
}: {
  onAvatarReady: (hasVideo: boolean) => void;
  onRemoteReport: (payload: Record<string, unknown>) => void;
  onRemoteTranscript: (speaker: "santa" | "child", text: string) => void;
  onProvideChatSender: (sender: ((text: string) => void) | null) => void;
  micEnabled: boolean;
}) {
  const tracks = useTracks(
    [Track.Source.Camera, Track.Source.ScreenShare, Track.Source.Unknown],
    { onlySubscribed: false }
  );
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {});
  }, [localParticipant, micEnabled]);

  useEffect(() => {
    const sendFn = (text: string) => {
      try {
        const bytes = new TextEncoder().encode(text);
        localParticipant
          .publishData(bytes, { reliable: true, topic: "child-chat" })
          .catch(() => {});
      } catch {
        // ignore
      }
    };
    onProvideChatSender(sendFn);
    return () => onProvideChatSender(null);
  }, [localParticipant, onProvideChatSender]);

  const remoteAvatarTrack = tracks.find(
    (t) => !t.participant.isLocal && t.publication?.kind === Track.Kind.Video
  );

  useEffect(() => {
    onAvatarReady(Boolean(remoteAvatarTrack));
  }, [remoteAvatarTrack, onAvatarReady]);

  // 선물 키워드 리포트 수신
  useDataChannel("santa-report", (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text);
      onRemoteReport(parsed);
    } catch {
      // ignore
    }
  });

  // 백엔드 산타 AI 및 아이 음성 인식 실시간 자막 수신
  useDataChannel("santa-transcript", (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as { speaker?: "santa" | "child"; text?: string };
      if (parsed.speaker && parsed.text) {
        onRemoteTranscript(parsed.speaker, parsed.text);
      }
    } catch {
      // ignore
    }
  });

  if (!remoteAvatarTrack) {
    return null;
  }

  return (
    <VideoTrack
      trackRef={remoteAvatarTrack}
      className="w-full h-full object-cover"
    />
  );
}

export default function CallPage() {
  const router = useRouter();
  const { note, setReport } = useSantaSession();

  const displayName =
    note.childName && note.childName !== "우리 아이" ? note.childName : "";

  const [connDetails, setConnDetails] = useState<ConnectionDetailsResponse | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // dialing: 전화 거는 중 연출 -> connected: 통화 연결됨 -> ending: 통화 종료 전환
  const [callPhase, setCallPhase] = useState<"dialing" | "connected" | "ending">("dialing");
  const [hasRemoteAvatarVideo, setHasRemoteAvatarVideo] = useState(false);

  const [ringMuted, setRingMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(false);
  const [showPromptSheet, setShowPromptSheet] = useState(false);

  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [camPermissionWarning, setCamPermissionWarning] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [santaSpeaking, setSantaSpeaking] = useState(true);
  const [childInputText, setChildInputText] = useState("");
  const [detectedGifts, setDetectedGifts] = useState<string[]>(
    note.giftHint && note.giftHint !== "크리스마스 깜짝 선물" ? [note.giftHint] : []
  );
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const livekitChatSenderRef = useRef<((text: string) => void) | null>(null);

  const handleProvideChatSender = useCallback(
    (sender: ((text: string) => void) | null) => {
      livekitChatSenderRef.current = sender;
    },
    []
  );

  // 발신 연결 중일 때 부드러운 전화 연결음 재생
  useOutgoingDialTone(callPhase === "dialing", ringMuted);

  // 마이크 권한 사전 확인 및 안내 처리
  const requestMicPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermissionState("granted");
    } catch {
      setMicPermissionState("denied");
      setMicEnabled(false);
      setShowPromptSheet(true);
    }
  }, []);

  // LiveKit 연결 토큰 발급 및 자동 발신 연결
  const fetchConnectionToken = useCallback(async () => {
    setConnectionError(null);
    try {
      const res = await fetch("/api/connection-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(note),
      });
      if (!res.ok) {
        throw new Error("연결 정보를 가져오지 못했습니다.");
      }
      const data = (await res.json()) as ConnectionDetailsResponse;
      setConnDetails(data);
    } catch {
      setConnectionError("네트워크 상태를 확인한 후 다시 시도해 주세요.");
    }
  }, [note]);

  useEffect(() => {
    requestMicPermission();
    fetchConnectionToken();
  }, [requestMicPermission, fetchConnectionToken]);

  // 토큰 발급 후 실제 전화가 연결되는 듯한 발신 연출(약 1.8초) 뒤 통화 화면으로 자연스럽게 전환
  useEffect(() => {
    if (callPhase !== "dialing" || !connDetails) return;

    const timer = setTimeout(() => {
      setCallPhase("connected");
      setTranscript((prev) =>
        prev.length > 0
          ? prev
          : [
              {
                id: `santa-init-${Date.now()}`,
                speaker: "santa",
                text: displayName
                  ? `호호호! 우리 ${displayName} 어린이 안녕? 북극 산타 마을에서 산타할아버지가 전화를 받았단다!`
                  : "호호호! 반갑구나! 북극 산타 마을에서 산타할아버지가 전화를 받았단다! 우리 친구 이름이 무엇이니?",
                timestamp: "00:01",
              },
            ]
      );
    }, 1800);

    return () => clearTimeout(timer);
  }, [callPhase, connDetails, displayName]);

  // 통화 시간 타이머
  useEffect(() => {
    if (callPhase !== "connected") return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callPhase]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 백엔드 DataChannel 리포트 수신 핸들러
  const handleRemoteReport = useCallback((payload: Record<string, unknown>) => {
    if (Array.isArray(payload.detectedGifts) && payload.detectedGifts.length > 0) {
      setDetectedGifts(payload.detectedGifts as string[]);
    }
  }, []);

  // 백엔드 산타 AI의 실제 음성 대사 & 아이 음성 인식 결과를 실시간 자막에 반영
  const handleRemoteTranscript = useCallback(
    (speaker: "santa" | "child", text: string) => {
      // 산타 첫 음성이 도착하면 발신 대기 중이더라도 즉시 연결 상태로 전환
      setCallPhase((prev) => (prev === "dialing" ? "connected" : prev));
      setTranscript((prev) => [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text,
          timestamp: formatTime(elapsedSec),
        },
      ]);
      if (speaker === "santa") {
        setSantaSpeaking(true);
        setTimeout(() => setSantaSpeaking(false), 3200);
      }
    },
    [elapsedSec]
  );

  // 선택형 대화 칩 또는 키보드 입력 전송
  const handleSendChildUtterance = (textToSend?: string) => {
    const text = (textToSend ?? childInputText).trim();
    if (!text) return;

    const nowStamp = formatTime(elapsedSec);
    const childTurn: ChatTurn = {
      id: `child-${Date.now()}`,
      speaker: "child",
      text,
      timestamp: nowStamp,
    };

    setTranscript((prev) => [...prev, childTurn]);
    setChildInputText("");

    if (livekitChatSenderRef.current && connDetails && !connDetails.demoMode) {
      livekitChatSenderRef.current(text);
      return;
    }

    // 데모/오프라인 폴백 응답
    let santaReply = "";
    if (text.includes("진짜") || text.includes("가짜")) {
      santaReply =
        "호호호! 방금 루돌프 코가 반짝이는 바람에 북극 전파가 살짝 흔들렸나 보구나! 진짜 산타할아버지란다!";
    } else if (text.includes("선물") || text.includes("받고 싶")) {
      santaReply =
        "허허허, 그렇구나! 산타할아버지가 마법 수첩에 꼭 적어두었단다. 크리스마스이브를 기대하렴!";
    } else {
      santaReply = `호호호! 목소리가 아주 씩씩해서 듣기 좋구나! 산타할아버지와 '${note.mission}' 약속도 꼭 지켜주렴!`;
    }

    setSantaSpeaking(true);
    setTimeout(() => setSantaSpeaking(false), 3000);

    setTranscript((prev) => [
      ...prev,
      {
        id: `santa-${Date.now() + 1}`,
        speaker: "santa",
        text: santaReply,
        timestamp: formatTime(elapsedSec + 2),
      },
    ]);
  };

  // 통화 종료 -> 부드러운 페이드 아웃 후 리포트 화면으로 이동
  const handleEndCall = () => {
    if (callPhase === "ending") return;
    setCallPhase("ending");

    const finalChildName = displayName || "우리 아이";
    const finalGifts =
      detectedGifts.length > 0
        ? detectedGifts
        : [note.giftHint || "크리스마스 깜짝 선물"];

    setReport({
      childName: finalChildName,
      callDurationSec: Math.max(elapsedSec, 15),
      detectedGifts: finalGifts,
      conversationSummary: `${finalChildName}와(과) 따뜻한 인사를 나누며 '${note.praise}'에 대해 칭찬해 주었고, 크리스마스 소원(${finalGifts.join(", ")})에 대해 즐겁게 대화했습니다.`,
      missionPromise: `'${note.mission}' 약속을 산타할아버지와 손가락 걸고 지키기로 다짐했습니다.`,
      santaComment: `호호호! ${finalChildName}의 반짝이는 목소리를 들으니 북극 마을까지 따뜻해졌답니다. 메리 크리스마스!`,
      transcript,
    });

    setTimeout(() => {
      router.push("/report");
    }, 420);
  };

  const latestTurn = transcript[transcript.length - 1];
  const latestSantaMessage =
    [...transcript].reverse().find((t) => t.speaker === "santa")?.text ||
    "호호호! 반갑구나! 산타할아버지 목소리 잘 들리니?";

  const quickChips = [
    displayName ? `안녕 산타할아버지! 저 ${displayName}예요!` : "안녕하세요 산타할아버지!",
    "크리스마스 선물 받고 싶어요!",
    "올해 착한 일 많이 했어요!",
    "산타할아버지 진짜 있어요?",
  ];

  return (
    <div
      className={`relative flex-1 w-full h-full bg-[#0A0F1D] text-[#F9F6F0] overflow-hidden flex flex-col justify-between select-none transition-opacity duration-500 ${
        callPhase === "ending" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* LiveKit WebRTC 세션 (발신 시작과 동시에 백그라운드에서 즉시 룸 연결) */}
      {connDetails && !connDetails.demoMode && (
        <LiveKitRoom
          serverUrl={connDetails.serverUrl}
          token={connDetails.participantToken}
          connect={true}
          audio={micEnabled && micPermissionState !== "denied"}
          video={false}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          <RoomAudioRenderer />
          <LiveKitActiveStage
            onAvatarReady={setHasRemoteAvatarVideo}
            onRemoteReport={handleRemoteReport}
            onRemoteTranscript={handleRemoteTranscript}
            onProvideChatSender={handleProvideChatSender}
            micEnabled={micEnabled && micPermissionState !== "denied"}
          />
        </LiveKitRoom>
      )}

      {/* 상단/하단 은은한 비네팅 (영상 스트림 위에서도 텍스트 가독성 유지) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-[#0A0F1D]/85 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-[#0A0F1D] via-[#0A0F1D]/80 to-transparent z-10" />

      {/* ============================================================
          중앙 스테이지: 음성 중심 산타 비주얼 및 발신 연결 애니메이션
          (실시간 아바타 비디오가 도착하면 부드럽게 비디오로 Cross-fade)
      ============================================================ */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-700 ${
          callPhase === "connected" && hasRemoteAvatarVideo
            ? "opacity-0 pointer-events-none z-0"
            : "opacity-100 z-10"
        }`}
      >
        {/* 은은한 웜 레드 배경 조명 */}
        <div className="pointer-events-none absolute w-80 h-80 rounded-full bg-[#9E1B20]/18 blur-[95px]" />

        <div className="relative flex flex-col items-center text-center -mt-12">
          {/* 상태 텍스트 (발신 중 vs 통화 연결됨) */}
          <p className="text-xs font-medium tracking-widest uppercase text-[#D4AF37] mb-2">
            {callPhase === "dialing" ? "North Pole Connecting" : "Voice & Avatar Live"}
          </p>
          <h1 className="text-2xl font-bold text-[#F9F6F0] tracking-tight">
            산타할아버지
          </h1>
          <p className="text-sm text-[#F9F6F0]/60 mt-1 font-normal">
            {callPhase === "dialing"
              ? "북극 산타 마을로 연결 중..."
              : formatTime(elapsedSec)}
          </p>

          {/* 산타 아바타 오브제 & 음성 파동 링 */}
          <div className="relative flex items-center justify-center mt-10 mb-6">
            <div
              className={`absolute w-56 h-56 rounded-full border border-[#D4AF37]/20 transition-all duration-700 ${
                callPhase === "dialing" || santaSpeaking
                  ? "scale-110 opacity-100 animate-ping"
                  : "scale-95 opacity-25"
              }`}
              style={{ animationDuration: "2.4s" }}
            />
            <div
              className={`absolute w-44 h-44 rounded-full border border-[#D4AF37]/35 transition-transform duration-500 ${
                santaSpeaking ? "scale-105" : "scale-100"
              }`}
            />

            <div className="relative w-36 h-36 rounded-full bg-[#111827] border-2 border-[#D4AF37]/75 shadow-[0_24px_60px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center">
              <span className="text-7xl select-none" role="img" aria-label="산타할아버지">
                🎅
              </span>
            </div>
          </div>

          {/* 통화 중 음성 파형 인디케이터 */}
          {callPhase === "connected" && (
            <div className="flex items-center gap-1.5 h-5 mt-1">
              {[0, 1, 2, 3, 4].map((bar) => (
                <span
                  key={bar}
                  className={`w-1 rounded-full bg-[#D4AF37] transition-all duration-300 ${
                    santaSpeaking ? "h-4 animate-bounce" : "h-1.5 opacity-40"
                  }`}
                  style={{ animationDelay: `${bar * 110}ms` }}
                />
              ))}
            </div>
          )}

          {/* 발신 중 벨소리 음소거 토글 */}
          {callPhase === "dialing" && (
            <button
              type="button"
              onClick={() => setRingMuted((m) => !m)}
              className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs text-[#F9F6F0]/75 transition"
            >
              {ringMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-[#F9F6F0]/50" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-[#D4AF37]" />
              )}
              <span>{ringMuted ? "연결음 꺼짐" : "연결음 켜짐"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================
          상단 HUD: 통화 상태 배지, 예외 알림 배너 & 전면 카메라 PIP
      ============================================================ */}
      <header className="relative z-20 px-6 pt-6 space-y-2.5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#111827]/80 backdrop-blur-md border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  callPhase === "connected"
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-[#D4AF37] animate-ping"
                }`}
              />
              <span className="text-xs font-medium text-[#F9F6F0]">
                {callPhase === "dialing" ? "연결 중" : "산타할아버지"}
              </span>
              {callPhase === "connected" && (
                <span className="text-xs font-mono text-[#D4AF37] pl-0.5">
                  {formatTime(elapsedSec)}
                </span>
              )}
            </div>

            {detectedGifts.length > 0 && callPhase === "connected" && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111827]/85 backdrop-blur-md border border-[#D4AF37]/40">
                <Gift className="w-3.5 h-3.5 text-[#D4AF37] shrink-0" />
                <span className="text-[11px] text-[#F9F6F0]/90 font-medium truncate max-w-[180px]">
                  {detectedGifts[0]}
                </span>
              </div>
            )}
          </div>

          {/* 우측 상단 PIP (카메라 켜짐 시에만 깔끔하게 노출) */}
          <ChildFrontCameraPip
            videoEnabled={camEnabled}
            childName={displayName || "나"}
            onPermissionDenied={() => {
              setCamEnabled(false);
              setCamPermissionWarning(true);
              setTimeout(() => setCamPermissionWarning(false), 4000);
            }}
          />
        </div>

        {/* 마이크 권한 거부 안내 배너 */}
        {micPermissionState === "denied" && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#111827]/95 border border-[#D4AF37]/40 text-xs text-[#F9F6F0]/90 shadow-lg">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>마이크 권한이 꺼져 있어 대화 칩으로 말할 수 있어요.</span>
            </div>
            <button
              type="button"
              onClick={requestMicPermission}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[11px] font-semibold text-[#D4AF37] shrink-0"
            >
              재시도
            </button>
          </div>
        )}

        {/* 카메라 권한 거부 토스트 */}
        {camPermissionWarning && (
          <div className="px-3.5 py-2 rounded-xl bg-[#111827]/95 border border-white/15 text-xs text-[#F9F6F0]/80">
            카메라 접근 권한이 허용되지 않아 음성 통화로 계속 진행합니다.
          </div>
        )}

        {/* 네트워크/연결 오류 시 재시도 배너 */}
        {connectionError && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-2xl bg-[#9E1B20]/90 border border-white/20 text-xs text-[#F9F6F0]">
            <span>{connectionError}</span>
            <button
              type="button"
              onClick={fetchConnectionToken}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>재연결</span>
            </button>
          </div>
        )}
      </header>

      {/* ============================================================
          하단 영역: 실시간 자막, 선택형 대화 칩 & Apple 스타일 통화 컨트롤 독
      ============================================================ */}
      <footer className="relative z-20 mt-auto px-6 pb-8 pt-3 space-y-3.5">
        {/* 연결 완료 후 산타 실시간 자막 배너 */}
        {callPhase === "connected" && (
          <div className="px-4 py-3.5 rounded-2xl bg-[#111827]/80 backdrop-blur-md border border-white/10 space-y-1.5">
            <p className="text-sm text-[#F9F6F0] leading-relaxed font-medium">
              &ldquo;{latestSantaMessage}&rdquo;
            </p>
            {latestTurn?.speaker === "child" && (
              <p className="text-xs text-[#D4AF37] truncate pt-1 border-t border-white/[0.08]">
                나: &ldquo;{latestTurn.text}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* 선택형 대화 칩 & 텍스트 입력창 (대화 칩 버튼 활성화 시 표시) */}
        {callPhase === "connected" && showPromptSheet && (
          <div className="p-3.5 rounded-2xl bg-[#111827]/95 backdrop-blur-md border border-white/10 space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {quickChips.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendChildUtterance(chip)}
                  className="text-xs px-3 py-1.5 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-[#F9F6F0]/90 border border-white/10 shrink-0 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChildUtterance();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={childInputText}
                onChange={(e) => setChildInputText(e.target.value)}
                placeholder="산타에게 전할 말을 입력하세요"
                className="flex-1 h-10 px-3.5 rounded-xl bg-[#0A0F1D] border border-white/10 text-xs text-[#F9F6F0] placeholder-[#F9F6F0]/35 focus:outline-none focus:border-[#D4AF37]"
              />
              <button
                type="submit"
                aria-label="전송"
                className="h-10 px-3.5 rounded-xl bg-[#D4AF37] hover:bg-[#e0bc42] text-[#0A0F1D] font-semibold text-xs flex items-center gap-1 shrink-0 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>전송</span>
              </button>
            </form>
          </div>
        )}

        {/* Apple FaceTime / iOS 통화 스타일 하단 원형 컨트롤 바 */}
        <div className="flex items-center justify-around pt-1">
          {/* 1. 음소거 토글 */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (micPermissionState === "denied") {
                  requestMicPermission();
                  return;
                }
                setMicEnabled((v) => !v);
              }}
              aria-label="음소거 토글"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
                !micEnabled || micPermissionState === "denied"
                  ? "bg-[#F9F6F0] text-[#0A0F1D]"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-[#F9F6F0] border border-white/15"
              }`}
            >
              {!micEnabled || micPermissionState === "denied" ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <span className="text-[11px] text-[#F9F6F0]/65 font-medium">
              {!micEnabled || micPermissionState === "denied" ? "음소거됨" : "음소거"}
            </span>
          </div>

          {/* 2. 카메라 PIP 토글 */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCamEnabled((v) => !v)}
              aria-label="카메라 토글"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
                camEnabled
                  ? "bg-[#F9F6F0] text-[#0A0F1D]"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-[#F9F6F0] border border-white/15"
              }`}
            >
              {camEnabled ? (
                <Video className="w-5 h-5" />
              ) : (
                <VideoOff className="w-5 h-5" />
              )}
            </button>
            <span className="text-[11px] text-[#F9F6F0]/65 font-medium">
              {camEnabled ? "카메라 켜짐" : "카메라"}
            </span>
          </div>

          {/* 3. 대화 칩 / 텍스트 입력 토글 */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowPromptSheet((v) => !v)}
              aria-label="대화 칩 열기"
              className={`w-14 h-14 rounded-full flex items-center justify-center transition active:scale-95 ${
                showPromptSheet
                  ? "bg-[#D4AF37] text-[#0A0F1D]"
                  : "bg-white/[0.08] hover:bg-white/[0.14] text-[#F9F6F0] border border-white/15"
              }`}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <span className="text-[11px] text-[#F9F6F0]/65 font-medium">
              대화 칩
            </span>
          </div>

          {/* 4. 통화 종료 버튼 (딥 레드 강조) */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              type="button"
              onClick={handleEndCall}
              aria-label="통화 종료"
              className="w-16 h-16 rounded-full bg-[#9E1B20] hover:bg-[#B22026] text-[#F9F6F0] shadow-[0_10px_28px_rgba(158,27,32,0.55)] border border-white/15 flex items-center justify-center transition active:scale-95"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
            <span className="text-[11px] text-[#F9F6F0]/80 font-semibold">
              종료
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
