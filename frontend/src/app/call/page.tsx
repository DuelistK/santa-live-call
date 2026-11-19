"use client";
// 산타 발신 연결 연출, 실시간 음성·아바타 통화, 마법 이펙트(AR·사운드) 및 하이라이트 영상 녹화 화면

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
  Sparkles,
  Award,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import {
  ChatTurn,
  ConnectionDetailsResponse,
  SantaMagicEffectType,
  SantaMagicEvent,
} from "@/types/santa";

// Web Audio API 기반 통화 연결음(듀얼 톤 신호음) 생성 훅
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

// Web Audio API 기반 산타 마법 효과음 합성기 (눈꽃 차임벨, 칭찬 도장 팡파르, 루돌프 방울, 선물 하프)
function playSantaMagicSound(effect: SantaMagicEffectType) {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") ctx.resume();

    const patterns: Record<SantaMagicEffectType, number[]> = {
      snow: [1046.5, 1318.5, 1567.98, 2093.0],
      stamp: [523.25, 659.25, 783.99, 1046.5],
      rudolph: [880.0, 1174.66, 1396.91, 1760.0],
      gift: [587.33, 783.99, 987.77, 1174.66, 1567.98],
    };

    const freqs = patterns[effect] || patterns.snow;
    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = effect === "stamp" ? "triangle" : "sine";
      const startTime = ctx.currentTime + idx * 0.09;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.06, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.36);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.38);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // ignore audio errors
  }
}

// 통화 화면 좌측 상단에 작고 세련되게 표시되는 실시간 마법/미션 알림 배지 (산타 얼굴과 입 모양을 절대 가리지 않음)
function SantaMagicStageOverlay({ magic }: { magic: SantaMagicEvent | null }) {
  if (!magic) return null;

  const iconMap: Record<SantaMagicEffectType, string> = {
    snow: "❄️",
    stamp: "⭐",
    rudolph: "🦌",
    gift: "🎁",
  };

  const badgeTitleMap: Record<SantaMagicEffectType, string> = {
    snow: "북극 마법 눈꽃",
    stamp: "착한 어린이 약속",
    rudolph: "루돌프 알림",
    gift: "마법 수첩 기록",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {/* 좌측 상단 컴팩트 알림 캡슐 — 산타 얼굴/입 중앙 영역을 전혀 침범하지 않음 */}
      <div className="absolute top-28 left-6 max-w-[235px] px-3 py-2 rounded-2xl bg-[#111827]/90 backdrop-blur-md border border-[#D4AF37]/60 shadow-[0_8px_24px_rgba(0,0,0,0.45)] flex items-center gap-2.5 transition-all duration-300">
        <div className="w-7 h-7 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-sm shrink-0">
          {iconMap[magic.effect] || "✨"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-[#D4AF37] shrink-0" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-[#D4AF37] truncate">
              {badgeTitleMap[magic.effect]}
            </span>
          </div>
          <p className="text-[11px] font-medium text-[#F9F6F0] leading-snug line-clamp-2 mt-0.5">
            {magic.label}
          </p>
        </div>
      </div>

      {/* 눈꽃 효과일 때만 화면 가장자리 위주로 은은한 눈송이 표시 */}
      {magic.effect === "snow" && (
        <div className="absolute inset-0">
          {[8, 18, 82, 91, 12, 87].map((leftPct, i) => (
            <span
              key={i}
              className="absolute text-sm opacity-65 animate-ping"
              style={{
                left: `${leftPct}%`,
                top: `${14 + ((i * 15) % 60)}%`,
                animationDelay: `${i * 220}ms`,
                animationDuration: "2s",
              }}
            >
              {i % 2 === 0 ? "❄️" : "✨"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// 우측 상단 전면 카메라 PIP (부모 리렌더링 시 카메라 스트림이 재시작되어 깜빡이는 현상 완벽 방지)
const ChildFrontCameraPip = React.memo(function ChildFrontCameraPip({
  videoEnabled,
  childName,
  videoRef,
  onPermissionDenied,
}: {
  videoEnabled: boolean;
  childName: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  onPermissionDenied: () => void;
}) {
  const [hasCamera, setHasCamera] = useState(false);
  const onDeniedRef = useRef(onPermissionDenied);

  useEffect(() => {
    onDeniedRef.current = onPermissionDenied;
  }, [onPermissionDenied]);

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
        if (!cancelled) {
          setHasCamera(false);
          onDeniedRef.current();
        }
      });

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEnabled, videoRef]);

  if (!videoEnabled) return null;

  return (
    <div className="relative w-24 h-32 rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-[#111827] shrink-0">
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
});

// LiveKit Room 내부 실시간 아바타 비디오 트랙 & DataChannel 수신 컴포넌트
function LiveKitActiveStage({
  onAvatarReady,
  onRemoteReport,
  onRemoteTranscript,
  onRemoteMagicFx,
  onRemoteEndCall,
  onProvideChatSender,
  micEnabled,
}: {
  onAvatarReady: (hasVideo: boolean) => void;
  onRemoteReport: (payload: Record<string, unknown>) => void;
  onRemoteTranscript: (speaker: "santa" | "child", text: string) => void;
  onRemoteMagicFx: (effect: SantaMagicEffectType, message: string) => void;
  onRemoteEndCall: () => void;
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

  // 백엔드 산타 AI 마법 이펙트('santa-magic-fx' 토픽) 수신
  useDataChannel("santa-magic-fx", (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text) as { effect?: string; message?: string };
      const rawEffect = (parsed.effect || "snow").toLowerCase();
      const mappedEffect: SantaMagicEffectType =
        rawEffect === "stamp" || rawEffect === "rudolph" || rawEffect === "gift"
          ? rawEffect
          : "snow";
      onRemoteMagicFx(mappedEffect, parsed.message || "산타의 마법이 펼쳐집니다! ✨");
    } catch {
      // ignore
    }
  });

  // 백엔드 산타 AI 마무리 인사 완료 후 자동 통화 종료 신호('santa-end-call' 토픽) 수신
  useDataChannel("santa-end-call", () => {
    onRemoteEndCall();
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
  const { note, setReport, appendReportToHistory, setRecordedVideo } = useSantaSession();

  const displayName =
    note.childName && note.childName !== "우리 아이" ? note.childName : "";
  const avatarMode = note.avatarProvider || "anam";
  const modeLabelMap: Record<string, string> = {
    anam: "기존(Anam HD)",
    simli: "대안A(Simli)",
    loop: "대안B(0원 루프)",
    hybrid: "하이브리드",
  };
  const currentModeBadge = modeLabelMap[avatarMode] || "기존(Anam HD)";

  const [connDetails, setConnDetails] = useState<ConnectionDetailsResponse | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const [callPhase, setCallPhase] = useState<"dialing" | "connected" | "ending">("dialing");
  const [hasRemoteAvatarVideo, setHasRemoteAvatarVideo] = useState(false);

  const [ringMuted, setRingMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showPromptSheet, setShowPromptSheet] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const [micPermissionState, setMicPermissionState] = useState<"prompt" | "granted" | "denied">("prompt");
  const [camPermissionWarning, setCamPermissionWarning] = useState(false);

  const [elapsedSec, setElapsedSec] = useState(0);
  const [santaSpeaking, setSantaSpeaking] = useState(false);
  const [santaMotionState, setSantaMotionState] = useState<
    "listening" | "nodding" | "talking" | "laughing"
  >("listening");
  const [childInputText, setChildInputText] = useState("");
  const [detectedGifts, setDetectedGifts] = useState<string[]>(
    note.giftHint && note.giftHint !== "크리스마스 깜짝 선물" ? [note.giftHint] : []
  );
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const [activeMagic, setActiveMagic] = useState<SantaMagicEvent | null>(null);

  const livekitChatSenderRef = useRef<((text: string) => void) | null>(null);
  const stageContainerRef = useRef<HTMLDivElement | null>(null);
  const childPipVideoRef = useRef<HTMLVideoElement | null>(null);
  const talkingLoopVideoRef = useRef<HTMLVideoElement | null>(null);
  const laughingLoopVideoRef = useRef<HTMLVideoElement | null>(null);
  const listeningLoopVideoRef = useRef<HTMLVideoElement | null>(null);
  const noddingLoopVideoRef = useRef<HTMLVideoElement | null>(null);
  const santaStageImgRef = useRef<HTMLImageElement | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const magicTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const farewellPendingRef = useRef(false);
  const endCallFnRef = useRef<() => void>(() => {});

  // 캔버스 렌더링 루프에서 최신 상태를 참조하기 위한 Ref
  const latestStateRef = useRef({
    elapsedSec: 0,
    santaSpeaking: false,
    santaMotionState: "listening" as "listening" | "nodding" | "talking" | "laughing",
    latestSantaMessage: "호호호! 반갑구나!",
    latestChildMessage: "",
    displayName: "",
    activeMagic: null as SantaMagicEvent | null,
    camEnabled: true,
  });

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, "0");
    const s = (sec % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  // 마법 이펙트 실행 함수 (사운드 + 화면 오버레이 + 녹화 캔버스 반영)
  const triggerMagicEffect = useCallback(
    (effect: SantaMagicEffectType, customLabel?: string) => {
      const defaultLabels: Record<SantaMagicEffectType, string> = {
        snow: "북극 마을의 마법 눈꽃이 내려요! ❄️",
        stamp: "착한 어린이 칭찬 도장 쾅! ⭐",
        rudolph: "루돌프가 반짝이는 코로 인사해요! 🦌",
        gift: "북극 마법 수첩에 선물이 기록되었어요! 🎁",
      };
      const eventObj: SantaMagicEvent = {
        id: `${effect}-${Date.now()}`,
        effect,
        label: customLabel || defaultLabels[effect],
      };
      setActiveMagic(eventObj);
      playSantaMagicSound(effect);

      if (magicTimerRef.current) {
        clearTimeout(magicTimerRef.current);
      }
      magicTimerRef.current = setTimeout(() => {
        setActiveMagic(null);
      }, 2400);
    },
    []
  );

  const handleCamPermissionDenied = useCallback(() => {
    setCamEnabled(false);
    setCamPermissionWarning(true);
    setTimeout(() => setCamPermissionWarning(false), 4000);
  }, []);

  const handleProvideChatSender = useCallback(
    (sender: ((text: string) => void) | null) => {
      livekitChatSenderRef.current = sender;
    },
    []
  );

  // 발신 연결 중일 때 부드러운 전화 연결음 재생
  useOutgoingDialTone(callPhase === "dialing", ringMuted);

  // 마이크 권한 사전 확인 및 오디오 스트림 보관(하이라이트 녹화 믹싱용)
  const requestMicPermission = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermissionState("granted");
    } catch {
      setMicPermissionState("denied");
      setMicEnabled(false);
      setShowPromptSheet(true);
    }
  }, []);

  // LiveKit 연결 토큰 발급
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
    setRecordedVideo(null);
    requestMicPermission();
    fetchConnectionToken();

    // 녹화 캔버스에서 첫 프레임부터 실사 산타가 그려지도록 배경 이미지를 사전 로드
    if (typeof window !== "undefined") {
      const preloadImg = new window.Image();
      preloadImg.src = "/images/santa-live-stage.png";
      santaStageImgRef.current = preloadImg;
    }

    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (magicTimerRef.current) clearTimeout(magicTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 통화 연결 시 4종 멀티 모션 루프 비디오(Listening / Nodding / Talking / Laughing) 자동 재생 보장
  useEffect(() => {
    if (callPhase === "connected") {
      listeningLoopVideoRef.current?.play().catch(() => {});
      noddingLoopVideoRef.current?.play().catch(() => {});
      talkingLoopVideoRef.current?.play().catch(() => {});
      laughingLoopVideoRef.current?.play().catch(() => {});
    }
  }, [callPhase]);

  // 4종 모드별 통화 연결 전환 타이밍 제어
  // - loop / hybrid: 약 1.4초 발신 신호음 후 즉시 대안 B(시네마틱 모션 루프 스테이지)로 오픈
  // - anam / simli (단독 모드): 실제 실시간 아바타 비디오 첫 프레임이 도착할 때까지 발신 신호음 화면 유지 (최대 5.8초 안전 타임아웃)
  useEffect(() => {
    if (callPhase !== "dialing" || !connDetails) return;

    const activateConnectedPhase = () => {
      setCallPhase("connected");
      triggerMagicEffect("snow", "산타할아버지와 북극 직통 전화가 연결되었어요! ❄️");
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
    };

    // 단독 아바타 모드(anam/simli)에서 이미 아바타 비디오 트랙이 도착했다면 즉시 오픈
    if ((avatarMode === "anam" || avatarMode === "simli") && hasRemoteAvatarVideo) {
      activateConnectedPhase();
      return;
    }

    const waitMs =
      avatarMode === "loop" || avatarMode === "hybrid" || connDetails.demoMode
        ? 1400
        : 5800;

    const timer = setTimeout(activateConnectedPhase, waitMs);
    return () => clearTimeout(timer);
  }, [
    callPhase,
    connDetails,
    avatarMode,
    hasRemoteAvatarVideo,
    displayName,
    triggerMagicEffect,
  ]);

  // 통화 시간 타이머
  useEffect(() => {
    if (callPhase !== "connected") return;
    const interval = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callPhase]);

  const latestTurn = transcript[transcript.length - 1];
  const latestSantaMessage =
    [...transcript].reverse().find((t) => t.speaker === "santa")?.text ||
    "호호호! 반갑구나! 산타할아버지 목소리 잘 들리니?";
  const latestChildMessage =
    [...transcript].reverse().find((t) => t.speaker === "child")?.text || "";

  useEffect(() => {
    latestStateRef.current = {
      elapsedSec,
      santaSpeaking,
      santaMotionState,
      latestSantaMessage,
      latestChildMessage,
      displayName: displayName || "우리 아이",
      activeMagic,
      camEnabled,
    };
  }, [
    elapsedSec,
    santaSpeaking,
    santaMotionState,
    latestSantaMessage,
    latestChildMessage,
    displayName,
    activeMagic,
    camEnabled,
  ]);

  // ============================================================================
  // 통화 하이라이트 영상(산타 화면 + 아이 PIP + 마법 이펙트 + 자막 + 음성) 자동 녹화
  // ============================================================================
  useEffect(() => {
    if (callPhase !== "connected" || typeof window === "undefined") return;
    if (typeof MediaRecorder === "undefined") return;

    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frameCount = 0;

    // 비디오/이미지가 찌그러지지 않도록(오이 현상 방지) CSS object-fit: cover 와 동일하게 중앙 크롭하여 그리는 헬퍼
    const drawImageCover = (
      source: CanvasImageSource,
      srcW: number,
      srcH: number,
      dstX: number,
      dstY: number,
      dstW: number,
      dstH: number
    ) => {
      if (srcW <= 0 || srcH <= 0) return;
      const srcRatio = srcW / srcH;
      const dstRatio = dstW / dstH;
      let sx = 0;
      let sy = 0;
      let sw = srcW;
      let sh = srcH;

      if (srcRatio > dstRatio) {
        sw = srcH * dstRatio;
        sx = (srcW - sw) / 2;
      } else {
        sh = srcW / dstRatio;
        sy = (srcH - sh) / 2;
      }

      ctx.drawImage(source, sx, sy, sw, sh, dstX, dstY, dstW, dstH);
    };

    // 캔버스 합성 드로잉 루프 (20fps)
    const drawCompositeFrame = () => {
      frameCount += 1;
      const st = latestStateRef.current;

      // 1. 배경 클리어 (#0A0F1D)
      ctx.fillStyle = "#0A0F1D";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 2. 산타할아버지 메인 화면 렌더링 (이모티콘 없이 100% 실사 아바타/모션루프 영상만 합성)
      let drewSantaStage = false;

      // (우선순위 1) 실시간 WebRTC 아바타 비디오 트랙 (Anam / Simli / Hybrid 연결 완료 시)
      if (stageContainerRef.current && avatarMode !== "loop") {
        const videos = stageContainerRef.current.querySelectorAll("video");
        videos.forEach((v) => {
          if (
            !drewSantaStage &&
            v !== childPipVideoRef.current &&
            v !== talkingLoopVideoRef.current &&
            v !== laughingLoopVideoRef.current &&
            v !== listeningLoopVideoRef.current &&
            v !== noddingLoopVideoRef.current &&
            v.readyState >= 2 &&
            v.videoWidth > 0 &&
            v.videoHeight > 0
          ) {
            try {
              drawImageCover(
                v,
                v.videoWidth,
                v.videoHeight,
                0,
                0,
                canvas.width,
                canvas.height
              );
              drewSantaStage = true;
            } catch {
              // ignore
            }
          }
        });
      }

      // (우선순위 2) 4종 멀티 모션 루프 비디오 (대안 B 단독 모드 또는 WebRTC 연결 전 구간)
      if (!drewSantaStage) {
        const stateVidMap = {
          laughing: laughingLoopVideoRef.current,
          talking: talkingLoopVideoRef.current,
          nodding: noddingLoopVideoRef.current,
          listening: listeningLoopVideoRef.current,
        };
        const orderedCandidates = [
          stateVidMap[st.santaMotionState],
          talkingLoopVideoRef.current,
          listeningLoopVideoRef.current,
          noddingLoopVideoRef.current,
          laughingLoopVideoRef.current,
        ];
        const candidateVid =
          orderedCandidates.find(
            (v) => v && v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0
          ) || null;

        if (candidateVid) {
          try {
            drawImageCover(
              candidateVid,
              candidateVid.videoWidth,
              candidateVid.videoHeight,
              0,
              0,
              canvas.width,
              canvas.height
            );
            drewSantaStage = true;
          } catch {
            // ignore
          }
        }
      }

      // (우선순위 3) 비디오 첫 프레임 디코딩 직전 0초 구간의 사전 로드된 실사 산타 이미지
      if (!drewSantaStage) {
        const preloadImg = santaStageImgRef.current;
        if (preloadImg && preloadImg.complete && preloadImg.naturalWidth > 0) {
          try {
            drawImageCover(
              preloadImg,
              preloadImg.naturalWidth,
              preloadImg.naturalHeight,
              0,
              0,
              canvas.width,
              canvas.height
            );
            drewSantaStage = true;
          } catch {
            // ignore
          }
        }
      }

      // 3. 상단 상태 배지 & 타이머
      ctx.fillStyle = "rgba(17, 24, 39, 0.82)";
      ctx.beginPath();
      ctx.roundRect(28, 32, 195, 40, 20);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = "#34D399";
      ctx.beginPath();
      ctx.arc(48, 52, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#F9F6F0";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`산타할아버지 · ${formatTime(st.elapsedSec)}`, 62, 53);

      // 4. 우측 상단 우리 아이 전면 카메라 PIP 합성 (비율 왜곡 없는 중앙 크롭)
      const pipVid = childPipVideoRef.current;
      if (
        st.camEnabled &&
        pipVid &&
        pipVid.readyState >= 2 &&
        pipVid.videoWidth > 0 &&
        pipVid.videoHeight > 0
      ) {
        const pipX = 382;
        const pipY = 32;
        const pipW = 130;
        const pipH = 174;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(pipX, pipY, pipW, pipH, 18);
        ctx.clip();

        // 좌우 반전(거울 모드) + 비율 유지 그리기
        ctx.translate(pipX + pipW, pipY);
        ctx.scale(-1, 1);
        drawImageCover(pipVid, pipVid.videoWidth, pipVid.videoHeight, 0, 0, pipW, pipH);
        ctx.restore();

        ctx.beginPath();
        ctx.roundRect(pipX, pipY, pipW, pipH, 18);
        ctx.strokeStyle = "#D4AF37";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
        ctx.beginPath();
        ctx.roundRect(pipX + 8, pipY + pipH - 28, pipW - 16, 20, 6);
        ctx.fill();

        ctx.fillStyle = "#F9F6F0";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(st.displayName, pipX + pipW / 2, pipY + pipH - 17);
      }

      // 5. 활성화된 마법 이펙트 합성 (산타 얼굴을 가리지 않도록 좌측 상단 소형 배지로만 표시)
      if (st.activeMagic) {
        ctx.fillStyle = "rgba(17, 24, 39, 0.9)";
        ctx.beginPath();
        ctx.roundRect(28, 84, 245, 36, 14);
        ctx.fill();
        ctx.strokeStyle = "rgba(212, 175, 55, 0.65)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        ctx.fillStyle = "#F9F6F0";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(`✨ ${st.activeMagic.label.slice(0, 20)}`, 40, 106);
      }

      // 6. 하단 실시간 자막 박스 합성
      ctx.fillStyle = "rgba(17, 24, 39, 0.88)";
      ctx.beginPath();
      ctx.roundRect(28, 745, 484, 165, 22);
      ctx.fill();
      ctx.strokeStyle = "rgba(212, 175, 55, 0.35)";
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = "#D4AF37";
      ctx.font = "bold 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("🎅 산타할아버지", 48, 775);

      ctx.fillStyle = "#F9F6F0";
      ctx.font = "500 15px sans-serif";
      const msg = st.latestSantaMessage;
      const line1 = msg.slice(0, 28);
      const line2 = msg.slice(28, 56);
      const line3 = msg.slice(56, 84);
      ctx.fillText(line1, 48, 804);
      if (line2) ctx.fillText(line2, 48, 828);
      if (line3) ctx.fillText(line3 + (msg.length > 84 ? "..." : ""), 48, 852);

      if (st.latestChildMessage) {
        ctx.fillStyle = "#D4AF37";
        ctx.font = "500 13px sans-serif";
        ctx.fillText(
          `🧒 ${st.displayName}: ${st.latestChildMessage.slice(0, 30)}`,
          48,
          886
        );
      }
    };

    drawCompositeFrame();
    const drawInterval = setInterval(drawCompositeFrame, 50);

    // 캔버스 비디오 스트림 + 오디오 스트림(마이크 & LiveKit 원격 오디오) 결합
    let audioCtx: AudioContext | null = null;
    let audioScanInterval: ReturnType<typeof setInterval> | null = null;
    const attachedElements = new WeakSet<HTMLAudioElement>();

    try {
      const canvasStream = canvas.captureStream(20);
      const combinedTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        audioCtx = new AudioCtx();
        const dest = audioCtx.createMediaStreamDestination();

        // 무음 오실레이터로 오디오 트랙 클럭 유지
        const silentOsc = audioCtx.createOscillator();
        const silentGain = audioCtx.createGain();
        silentGain.gain.value = 0.0001;
        silentOsc.connect(silentGain);
        silentGain.connect(dest);
        silentOsc.start();

        // 로컬 마이크 스트림 연결 + 아이 발화 에너지 감지용 AnalyserNode
        let micAnalyser: AnalyserNode | null = null;
        if (micStreamRef.current && micStreamRef.current.getAudioTracks().length > 0) {
          try {
            const micSource = audioCtx.createMediaStreamSource(micStreamRef.current);
            micSource.connect(dest);
            micAnalyser = audioCtx.createAnalyser();
            micAnalyser.fftSize = 256;
            micAnalyser.smoothingTimeConstant = 0.5;
            micSource.connect(micAnalyser);
          } catch {
            // ignore
          }
        }

        // LiveKit RoomAudioRenderer가 생성한 원격 <audio> 엘리먼트 스트림 자동 연결 + 음절 단위(60ms) 실시간 파형/박자 동기화
        let remoteAnalyser: AnalyserNode | null = null;
        let lastVoiceActiveAt = 0;
        let lastLaughActiveAt = 0;
        let lastChildVoiceAt = 0;

        const attachRemoteAudioElements = () => {
          const activeAudioCtx = audioCtx;
          if (!activeAudioCtx) return;
          const audioEls = document.querySelectorAll("audio");
          audioEls.forEach((el) => {
            if (attachedElements.has(el)) return;
            const mediaStream = el.srcObject as MediaStream | null;
            if (mediaStream && mediaStream.getAudioTracks().length > 0) {
              try {
                const remoteSource = activeAudioCtx.createMediaStreamSource(mediaStream);
                remoteSource.connect(dest);
                if (!remoteAnalyser) {
                  remoteAnalyser = activeAudioCtx.createAnalyser();
                  remoteAnalyser.fftSize = 256;
                  remoteAnalyser.smoothingTimeConstant = 0.4;
                  remoteSource.connect(remoteAnalyser);
                }
                attachedElements.add(el);
              } catch {
                // ignore
              }
            }
          });

          const now = Date.now();
          let santaEnergy = 0;
          if (remoteAnalyser) {
            const dataArr = new Uint8Array(remoteAnalyser.frequencyBinCount);
            remoteAnalyser.getByteFrequencyData(dataArr);
            let sum = 0;
            for (let i = 0; i < dataArr.length; i += 1) {
              sum += dataArr[i];
            }
            santaEnergy = sum / dataArr.length;
          }

          let childEnergy = 0;
          if (micAnalyser && micEnabled) {
            const micArr = new Uint8Array(micAnalyser.frequencyBinCount);
            micAnalyser.getByteFrequencyData(micArr);
            let micSum = 0;
            for (let i = 0; i < micArr.length; i += 1) {
              micSum += micArr[i];
            }
            childEnergy = micSum / micArr.length;
          }

          if (santaEnergy > 5.5) {
            lastVoiceActiveAt = now;
            setSantaSpeaking(true);

            // 음절 에너지 크기에 비례하여 발화 비디오 재생 속도(0.78x ~ 1.28x)를 실시간 조절해 입/수염 박자감 동기화
            const dynamicRate = Math.min(1.28, Math.max(0.78, 0.76 + (santaEnergy / 38) * 0.48));
            if (talkingLoopVideoRef.current) {
              talkingLoopVideoRef.current.playbackRate = dynamicRate;
            }
            if (laughingLoopVideoRef.current) {
              laughingLoopVideoRef.current.playbackRate = dynamicRate;
            }

            if (santaEnergy > 23) {
              lastLaughActiveAt = now;
              setSantaMotionState("laughing");
            } else if (now - lastLaughActiveAt < 550) {
              setSantaMotionState("laughing");
            } else {
              setSantaMotionState("talking");
            }
          } else if (now - lastVoiceActiveAt > 150) {
            // 문장 사이 쉼표나 말이 멈추면 0.15초 만에 즉시 입을 다물어(listening/nodding) 립싱크 어색함 제거
            setSantaSpeaking(false);
            if (childEnergy > 7.5) {
              lastChildVoiceAt = now;
              setSantaMotionState("nodding");
            } else if (now - lastChildVoiceAt < 850) {
              setSantaMotionState("nodding");
            } else {
              setSantaMotionState("listening");
            }
          }
        };

        attachRemoteAudioElements();
        audioScanInterval = setInterval(attachRemoteAudioElements, 60);

        dest.stream.getAudioTracks().forEach((t) => combinedTracks.push(t));
      }

      const finalStream = new MediaStream(combinedTracks);
      const mimeCandidates = [
        "video/mp4",
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
      ];
      const supportedMime =
        mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m)) || "";

      const recorder = supportedMime
        ? new MediaRecorder(finalStream, { mimeType: supportedMime })
        : new MediaRecorder(finalStream);

      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }

    return () => {
      clearInterval(drawInterval);
      if (audioScanInterval) clearInterval(audioScanInterval);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
      }
    };
  }, [callPhase]);

  // 백엔드 DataChannel 리포트 수신 핸들러
  const handleRemoteReport = useCallback(
    (payload: Record<string, unknown>) => {
      if (Array.isArray(payload.detectedGifts) && payload.detectedGifts.length > 0) {
        setDetectedGifts(payload.detectedGifts as string[]);
        triggerMagicEffect("gift", `산타 수첩에 '${payload.detectedGifts[0]}' 기록! 🎁`);
      }
    },
    [triggerMagicEffect]
  );

  // 백엔드 산타 AI의 실제 음성 대사 & 아이 음성 인식 결과를 실시간 자막에 반영
  const handleRemoteTranscript = useCallback(
    (speaker: "santa" | "child", text: string) => {
      // loop / hybrid 모드에서는 첫 음성 도착 시 즉시 화면 오픈, anam / simli 단독 모드에서는 비디오 트랙 도착 시 오픈
      if (avatarMode === "loop" || avatarMode === "hybrid") {
        setCallPhase((prev) => (prev === "dialing" ? "connected" : prev));
      }
      const currentElapsed = latestStateRef.current.elapsedSec;
      setTranscript((prev) => [
        ...prev,
        {
          id: `${speaker}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          speaker,
          text,
          timestamp: formatTime(currentElapsed),
        },
      ]);

      const farewellKeywords = [
        "안녕히 계세요",
        "안녕히 가세요",
        "안녕히계세요",
        "안녕히가세요",
        "다음에 만나",
        "다음에 또 만나",
        "나중에 만나",
        "또 만나요",
        "끊을게",
        "끊어주",
        "끊어 주",
        "먼저 끊",
        "빠이빠이",
        "바이바이",
        "잘 가요",
        "잘가요",
      ];

      if (speaker === "child") {
        if (farewellKeywords.some((kw) => text.includes(kw))) {
          farewellPendingRef.current = true;
        }
      } else {
        // LiveKit에서 assistant의 conversation_item_added는 발화 재생 완료 시점에 도착하므로
        // 여기서 setSantaSpeaking(true) + 타이머를 걸면 루프 영상이 중간에 튀는 원인이 됩니다.
        // 작별 인사가 완료된 경우 부드럽게 통화를 자동 종료합니다.
        const isClosingSantaLine =
          !text.includes("?") &&
          ((text.includes("메리 크리스마스") &&
            (text.includes("또 만나") ||
              text.includes("안녕") ||
              text.includes("끊어야") ||
              text.includes("썰매 점검"))) ||
            text.includes("전화를 끊어야") ||
            text.includes("안녕히 계세요"));

        if (farewellPendingRef.current || isClosingSantaLine) {
          farewellPendingRef.current = false;
          setTimeout(() => {
            endCallFnRef.current();
          }, 1500);
        }
      }
    },
    [avatarMode]
  );

  const handleRemoteEndCall = useCallback(() => {
    endCallFnRef.current();
  }, []);

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

    // 데모/오프라인 폴백 응답 + 마법 이펙트 연동
    let santaReply = "";
    if (text.includes("진짜") || text.includes("가짜")) {
      santaReply =
        "호호호! 방금 루돌프 코가 반짝이는 바람에 북극 전파가 살짝 흔들렸나 보구나! 진짜 산타할아버지란다!";
      triggerMagicEffect("rudolph", "루돌프가 반짝이는 코로 진짜라고 알려줘요! 🦌");
    } else if (text.includes("선물") || text.includes("받고 싶")) {
      santaReply =
        "허허허, 그렇구나! 산타할아버지가 마법 수첩에 꼭 적어두었단다. 크리스마스이브를 기대하렴!";
      triggerMagicEffect("gift", "마법 수첩에 소원 선물이 기록되었어요! 🎁");
    } else {
      santaReply = `호호호! 목소리가 아주 씩씩해서 듣기 좋구나! 산타할아버지와 '${note.mission}' 약속도 꼭 지켜주렴!`;
      triggerMagicEffect("stamp", "착한 어린이 약속 도장 쾅! ⭐");
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

  // 통화 종료 -> 녹화 영상 Blob 생성 및 리포트 저장 후 /report 화면으로 이동
  const handleEndCall = () => {
    if (callPhase === "ending") return;
    setCallPhase("ending");

    const finalChildName = displayName || "우리 아이";
    const finalGifts =
      detectedGifts.length > 0
        ? detectedGifts
        : [note.giftHint || "크리스마스 깜짝 선물"];

    const finalReport = {
      childName: finalChildName,
      callDurationSec: Math.max(elapsedSec, 15),
      detectedGifts: finalGifts,
      conversationSummary: `${finalChildName}와(과) 따뜻한 인사를 나누며 '${note.praise}'에 대해 칭찬해 주었고, 크리스마스 소원(${finalGifts.join(", ")})에 대해 즐겁게 대화했습니다.`,
      missionPromise: `'${note.mission}' 약속을 산타할아버지와 손가락 걸고 지키기로 다짐했습니다.`,
      santaComment: `호호호! ${finalChildName}의 반짝이는 목소리를 들으니 북극 마을까지 따뜻해졌답니다. 메리 크리스마스!`,
      transcript,
    };

    setReport(finalReport);
    appendReportToHistory(finalReport);

    const finalizeAndNavigate = () => {
      if (recordedChunksRef.current.length > 0) {
        const mimeType = mediaRecorderRef.current?.mimeType || "video/webm";
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setRecordedVideo(url, ext);
      }
      router.push("/report");
    };

    const recorder = mediaRecorderRef.current;
    if ( recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        finalizeAndNavigate();
      };
      try {
        recorder.stop();
      } catch {
        finalizeAndNavigate();
      }
    } else {
      setTimeout(finalizeAndNavigate, 350);
    }
  };
  endCallFnRef.current = handleEndCall;

  const quickChips = [
    displayName ? `안녕 산타할아버지! 저 ${displayName}예요!` : "안녕하세요 산타할아버지!",
    "크리스마스 선물 받고 싶어요!",
    "올해 착한 일 많이 했어요!",
    "산타할아버지 진짜 있어요?",
  ];

  const magicButtons: Array<{ effect: SantaMagicEffectType; label: string; icon: string }> = [
    { effect: "snow", label: "마법 눈꽃", icon: "❄️" },
    { effect: "stamp", label: "칭찬 도장", icon: "⭐" },
    { effect: "rudolph", label: "루돌프 코", icon: "🦌" },
    { effect: "gift", label: "선물 수첩", icon: "🎁" },
  ];

  return (
    <div
      ref={stageContainerRef}
      className={`relative flex-1 w-full h-full bg-[#0A0F1D] text-[#F9F6F0] overflow-hidden flex flex-col justify-between select-none transition-opacity duration-500 ${
        callPhase === "ending" ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* LiveKit WebRTC 세션 */}
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
            onRemoteMagicFx={triggerMagicEffect}
            onRemoteEndCall={handleRemoteEndCall}
            onProvideChatSender={handleProvideChatSender}
            micEnabled={micEnabled && micPermissionState !== "denied"}
          />
        </LiveKitRoom>
      )}

      {/* 실시간 마법 이펙트 오버레이 (눈꽃 파티클, 착한 어린이 도장, 루돌프 코, 선물 수첩) */}
      <SantaMagicStageOverlay magic={activeMagic} />

      {/* ============================================================
          실시간 음성 파형 반응형 4종 멀티 모션 산타 스테이지 ($0/분, 무제한 통화 지원)
          1) listening: 평상시 미소 지으며 눈 깜빡임 (/videos/santa-listening.mp4)
          2) nodding: 아이가 말할 때 고개를 끄덕이며 맞장구 (/videos/santa-nodding.mp4)
          3) talking: 일반 대화 발화 + 음절 에너지 비례 속도 제어 (/videos/santa-talking.mp4)
          4) laughing: "호호호!" 큰 웃음 및 강조 발화 (/videos/santa-laughing.mp4)
      ============================================================ */}
      <div
        className={`pointer-events-none absolute inset-0 overflow-hidden transition-opacity duration-500 ${
          callPhase === "connected" && (avatarMode === "loop" || !hasRemoteAvatarVideo)
            ? "opacity-100 z-10"
            : "opacity-0 z-0"
        }`}
      >
        <video
          ref={listeningLoopVideoRef}
          src="/videos/santa-listening.mp4"
          poster="/images/santa-live-stage.png"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ease-out ${
            santaMotionState === "listening" ? "opacity-100" : "opacity-0"
          }`}
        />
        <video
          ref={noddingLoopVideoRef}
          src="/videos/santa-nodding.mp4"
          poster="/images/santa-live-stage.png"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ease-out ${
            santaMotionState === "nodding" ? "opacity-100" : "opacity-0"
          }`}
        />
        <video
          ref={talkingLoopVideoRef}
          src="/videos/santa-talking.mp4"
          poster="/images/santa-live-stage.png"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ease-out ${
            santaMotionState === "talking" ? "opacity-100" : "opacity-0"
          }`}
        />
        <video
          ref={laughingLoopVideoRef}
          src="/videos/santa-laughing.mp4"
          poster="/images/santa-live-stage.png"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ease-out ${
            santaMotionState === "laughing" ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* 상단/하단 은은한 비네팅 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#0A0F1D]/75 to-transparent z-10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-[#0A0F1D]/95 via-[#0A0F1D]/60 to-transparent z-10" />

      {/* ============================================================
          발신 대기 오버레이 (callPhase === "dialing" 일 때만 표시)
          통화가 연결(connected)되면 모든 모드(대안 B 포함)에서 즉시 사라져 산타 얼굴을 가리지 않음
      ============================================================ */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center px-6 transition-opacity duration-500 ${
          callPhase === "dialing"
            ? "opacity-100 z-10"
            : "opacity-0 pointer-events-none z-0"
        }`}
      >
        <div className="pointer-events-none absolute w-80 h-80 rounded-full bg-[#9E1B20]/18 blur-[95px]" />

        <div className="relative flex flex-col items-center text-center -mt-12">
          <p className="text-xs font-medium tracking-widest uppercase text-[#D4AF37] mb-2">
            North Pole Connecting
          </p>
          <h1 className="text-2xl font-bold text-[#F9F6F0] tracking-tight drop-shadow-md">
            산타할아버지
          </h1>
          <p className="text-sm text-[#F9F6F0]/75 mt-1 font-normal">
            {avatarMode === "anam" || avatarMode === "simli"
              ? `${currentModeBadge} 실시간 영상 연결 중...`
              : "북극 산타 마을로 연결 중..."}
          </p>

          <div className="relative flex items-center justify-center mt-10 mb-6">
            <div
              className="absolute w-56 h-56 rounded-full border border-[#D4AF37]/20 scale-110 opacity-100 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
            <div className="absolute w-44 h-44 rounded-full border border-[#D4AF37]/35" />

            <div className="relative w-36 h-36 rounded-full bg-[#111827] border-2 border-[#D4AF37]/75 shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col items-center justify-center">
              <img
                src="/images/santa-portal-portrait.png"
                alt="산타할아버지"
                className="w-full h-full object-cover"
              />
            </div>
          </div>

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
        </div>
      </div>

      {/* ============================================================
          상단 HUD: 통화 상태 배지, 녹화(REC) 표시 & 전면 카메라 PIP
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
              {callPhase === "connected" && isRecording && (
                <span className="inline-flex items-center gap-1 pl-1.5 ml-1 border-l border-white/15 text-[10px] font-semibold text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  REC
                </span>
              )}
              <span className="pl-1.5 ml-1 border-l border-white/15 text-[10px] font-semibold text-[#D4AF37]">
                {currentModeBadge}
              </span>
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

          {/* 우측 상단 우리 아이 전면 카메라 PIP */}
          <ChildFrontCameraPip
            videoEnabled={camEnabled}
            childName={displayName || "나"}
            videoRef={childPipVideoRef}
            onPermissionDenied={handleCamPermissionDenied}
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
          하단 영역: 마법 연출 칩, 실시간 자막, 대화 칩 & 통화 컨트롤 독
      ============================================================ */}
      <footer className="relative z-20 mt-auto px-6 pb-8 pt-3 space-y-3">
        {/* 원터치 실시간 마법 이펙트 바 */}
        {callPhase === "connected" && (
          <div className="flex items-center justify-between gap-1.5 overflow-x-auto pb-0.5">
            {magicButtons.map((btn) => (
              <button
                key={btn.effect}
                type="button"
                onClick={() => triggerMagicEffect(btn.effect)}
                className="flex-1 py-1.5 px-2.5 rounded-full bg-[#111827]/85 hover:bg-[#111827] border border-[#D4AF37]/35 text-[11px] font-medium text-[#F9F6F0]/90 flex items-center justify-center gap-1 shrink-0 transition active:scale-95"
              >
                <span>{btn.icon}</span>
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        )}

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

        {/* 선택형 대화 칩 & 텍스트 입력창 */}
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
