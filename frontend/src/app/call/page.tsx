"use client";
// 산타할아버지 수신 전화 화면 및 실시간 AI 아바타 영상 통화 + 전면 카메라 PIP 화면

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
  PhoneCall,
  Sparkles,
  Volume2,
  VolumeX,
  Gift,
  MessageSquareHeart,
  Radio,
  Keyboard,
  ChevronDown,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { ChatTurn, ConnectionDetailsResponse } from "@/types/santa";

// Web Audio API 기반 크리스마스 차임/벨소리 합성기
function useNorthPoleRingtone(active: boolean, muted: boolean) {
  useEffect(() => {
    if (!active || muted || typeof window === "undefined") return;

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const playBellPattern = () => {
      try {
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === "suspended") ctx.resume();

        const notes = [659.25, 659.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);

          gain.gain.setValueAtTime(0.001, ctx.currentTime + idx * 0.22);
          gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + idx * 0.22 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + idx * 0.22 + 0.2);

          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + idx * 0.22);
          osc.stop(ctx.currentTime + idx * 0.22 + 0.21);
        });
      } catch {
        // ignore autoplay policy block before user gesture
      }
    };

    playBellPattern();
    timer = setInterval(playBellPattern, 1800);

    return () => {
      if (timer) clearInterval(timer);
      if (ctx) {
        ctx.close().catch(() => {});
      }
    };
  }, [active, muted]);
}

// 우측 상단 우리 아이 전면 카메라 PIP 컴포넌트 (<video> 태그는 항상 마운트하여 스트림 누락 방지)
function ChildFrontCameraPip({
  videoEnabled,
  childName,
}: {
  videoEnabled: boolean;
  childName: string;
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
      });

    return () => {
      cancelled = true;
      activeStream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEnabled]);

  return (
    <div className="relative w-24 h-32 rounded-2xl overflow-hidden border-2 border-amber-400/90 shadow-2xl bg-slate-900/95 shrink-0">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-300 ${
          videoEnabled && hasCamera ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />
      {(!videoEnabled || !hasCamera) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950 p-2 text-center">
          <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-lg mb-1">
            🧒
          </div>
          <span className="text-[10px] text-slate-300 font-medium leading-tight">
            {videoEnabled ? "카메라 연결중" : "카메라 꺼짐"}
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-1.5 py-0.5 rounded-md bg-black/65 backdrop-blur-sm">
        <span className="text-[9px] font-bold text-white truncate">{childName || "우리 아이"}</span>
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            videoEnabled && hasCamera ? "bg-emerald-400 animate-pulse" : "bg-slate-400"
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

  const [connDetails, setConnDetails] = useState<ConnectionDetailsResponse | null>(null);
  // incoming: 산타에게서 걸려오는 수신 화면 -> connected: 아이가 '통화 받기'를 누른 후 실제 WebRTC 연결
  const [callPhase, setCallPhase] = useState<"incoming" | "connected">("incoming");
  const [hasRemoteAvatarVideo, setHasRemoteAvatarVideo] = useState(false);
  const [ringMuted, setRingMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [showKeyboardBar, setShowKeyboardBar] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [santaSpeaking, setSantaSpeaking] = useState(true);
  const [childInputText, setChildInputText] = useState("");
  const [detectedGifts, setDetectedGifts] = useState<string[]>(
    note.giftHint ? [note.giftHint] : ["레고 시티 소방차 세트"]
  );
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);
  const livekitChatSenderRef = useRef<((text: string) => void) | null>(null);

  const handleProvideChatSender = useCallback(
    (sender: ((text: string) => void) | null) => {
      livekitChatSenderRef.current = sender;
    },
    []
  );

  // 벨소리는 수신 대기(incoming) 상태일 때 재생
  useNorthPoleRingtone(callPhase === "incoming", ringMuted);

  // 1. LiveKit 토큰 미리 발급 (아이가 '통화 받기'를 누르자마자 0.1초 만에 연결되도록 사전 준비)
  useEffect(() => {
    let cancelled = false;
    async function initConnection() {
      try {
        const res = await fetch("/api/connection-details", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(note),
        });
        const data = (await res.json()) as ConnectionDetailsResponse;
        if (!cancelled) {
          setConnDetails(data);
        }
      } catch (err) {
        console.error("Failed to fetch connection details:", err);
      }
    }
    initConnection();
    return () => {
      cancelled = true;
    };
  }, [note]);

  // 2. 아이가 [통화 받기] 버튼을 눌렀을 때 실행
  const handleAcceptIncomingCall = () => {
    setCallPhase("connected");
    setTranscript([
      {
        id: `santa-init-${Date.now()}`,
        speaker: "santa",
        text: `호호호! 우리 ${note.childName} 어린이 안녕? 북극 산타 마을에서 산타할아버지가 전화했단다! 잠시만 기다려 주렴!`,
        timestamp: "00:01",
      },
    ]);
  };

  // 3. 통화 타이머
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
        setTimeout(() => setSantaSpeaking(false), 3500);
      }
    },
    [elapsedSec]
  );

  // 키보드 텍스트로 말하기 (조용한 환경 또는 빠른 테스트용)
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

    // 실제 LiveKit Room이 연결된 경우 백엔드 산타 에이전트에게 전송하여 실제 음성/아바타 대답을 유도
    if (livekitChatSenderRef.current && connDetails && !connDetails.demoMode) {
      livekitChatSenderRef.current(text);
      return;
    }

    // 데모 모드일 때만 로컬 폴백 응답 생성
    let santaReply = "";
    if (text.includes("진짜") || text.includes("가짜")) {
      santaReply = `호호호! 방금 루돌프 코가 반짝이는 바람에 북극 카메라가 살짝 흔들렸나 보구나! 진짜 산타할아버지란다!`;
    } else {
      santaReply = `호호호! 그렇구나! 우리 ${note.childName}이가 '${note.mission}' 약속을 잘 지키면 크리스마스에 꼭 선물을 챙겨주마!`;
    }

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

  // 통화 종료 -> 리포트 저장 후 /report 화면으로 이동
  const handleEndCall = () => {
    setReport({
      childName: note.childName,
      callDurationSec: Math.max(elapsedSec, 45),
      detectedGifts:
        detectedGifts.length > 0
          ? detectedGifts
          : [note.giftHint || "레고 시티 소방차 세트"],
      conversationSummary: `${note.childName} 어린이에게 '${note.praise}'에 대해 따뜻하게 칭찬해 주었고, 아이가 크리스마스에 받고 싶은 선물(${detectedGifts.join(", ")})을 이야기하며 밝게 웃었습니다.`,
      missionPromise: `'${note.mission}' 약속을 산타할아버지와 손가락 걸고 꼭 지키기로 다짐했습니다!`,
      santaComment: `호호호! 우리 ${note.childName} 어린이가 산타할아버지 목소리를 듣고 눈이 반짝반짝 빛났답니다. 행복한 크리스마스 보내세요!`,
      transcript,
    });
    router.push("/report");
  };

  const latestTurn = transcript[transcript.length - 1];
  const latestSantaMessage =
    [...transcript].reverse().find((t) => t.speaker === "santa")?.text ||
    `호호호! 우리 ${note.childName} 어린이, 반갑구나!`;

  return (
    <div className="relative flex-1 w-full h-full bg-[#070B19] overflow-hidden flex flex-col justify-between select-none">
      {/* LiveKit Cloud 연결 세션: 아이가 [통화 받기]를 누른 순간(callPhase === 'connected') 연결 시작! */}
      {callPhase === "connected" && connDetails && !connDetails.demoMode && (
        <LiveKitRoom
          serverUrl={connDetails.serverUrl}
          token={connDetails.participantToken}
          connect={true}
          audio={micEnabled}
          video={false}
          className="absolute inset-0 z-10 pointer-events-none"
        >
          <RoomAudioRenderer />
          <LiveKitActiveStage
            onAvatarReady={setHasRemoteAvatarVideo}
            onRemoteReport={handleRemoteReport}
            onRemoteTranscript={handleRemoteTranscript}
            onProvideChatSender={handleProvideChatSender}
            micEnabled={micEnabled}
          />
        </LiveKitRoom>
      )}

      {/* ============================================================
          레이어 1: 실시간 AI 산타 영상 스트림 및 아바타 준비 중 화면 (Cross-fade In)
      ============================================================ */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ease-in-out pointer-events-none ${
          callPhase === "connected" ? "opacity-100 z-10" : "opacity-0 z-0"
        }`}
      >
        {!hasRemoteAvatarVideo && (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1B1534] via-[#121D38] to-[#080D1A] overflow-hidden">
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" />
            <div className="absolute top-1/4 -left-16 w-72 h-72 rounded-full bg-red-600/20 blur-3xl" />

            <div className="relative flex flex-col items-center mt-[-40px]">
              <div className="relative flex items-center justify-center">
                <div
                  className={`absolute w-56 h-56 rounded-full border-2 border-amber-400/40 transition-transform duration-500 ${
                    santaSpeaking ? "scale-110 animate-ping opacity-30" : "scale-100 opacity-10"
                  }`}
                />
                <div className="relative w-44 h-44 rounded-full bg-gradient-to-b from-red-700 via-red-800 to-slate-900 border-4 border-amber-400/90 shadow-[0_0_50px_rgba(245,197,66,0.35)] flex flex-col items-center justify-center overflow-hidden">
                  <div className="text-7xl animate-float">🎅</div>
                  <div className="mt-2 flex items-end gap-1 h-4">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <span
                        key={bar}
                        className="w-1 rounded-full bg-amber-300 animate-bounce h-3.5"
                        style={{ animationDelay: `${bar * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 border border-amber-400/30 backdrop-blur-md">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-amber-200">
                  북극 카메라 렌즈 닦는 중... (곧 산타 얼굴이 나타나요!)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          레이어 2: 산타할아버지에게서 걸려오는 수신 전화 화면 (Incoming Call)
      ============================================================ */}
      {callPhase === "incoming" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-between py-10 px-6 bg-gradient-to-b from-[#1A102E] via-[#0F172A] to-[#060A14]">
          <div className="text-center space-y-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              북극 산타 마을 직통 영상통화
            </span>
            <h1 className="text-2xl font-extrabold text-white tracking-tight pt-1">
              산타할아버지에게서
              <br />
              <span className="text-amber-300">영상통화</span>가 걸려왔어요!
            </h1>
            <p className="text-xs text-slate-300">
              착한 어린이 <strong className="text-white">{note.childName}</strong>({note.childAge}세)를 찾고 계세요!
            </p>
          </div>

          {/* 중앙 산타 수신 파동 애니메이션 */}
          <div className="relative flex items-center justify-center my-auto">
            <div className="absolute w-60 h-60 rounded-full bg-emerald-500/15 animate-ping" />
            <div className="absolute w-48 h-48 rounded-full bg-amber-400/20 animate-pulse" />
            <div className="relative w-36 h-36 rounded-full bg-gradient-to-br from-red-600 via-red-700 to-red-900 border-4 border-amber-300 shadow-[0_0_60px_rgba(245,197,66,0.45)] flex flex-col items-center justify-center">
              <span className="text-7xl animate-bounce">🎅</span>
            </div>
          </div>

          {/* 수신 화면 하단: 벨소리 토글 + 거절/통화 받기 버튼 */}
          <div className="w-full space-y-5 text-center pb-2">
            <button
              type="button"
              onClick={() => setRingMuted((m) => !m)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/15 text-[11px] text-slate-200 border border-white/15 transition"
            >
              {ringMuted ? (
                <VolumeX className="w-3.5 h-3.5 text-rose-400" />
              ) : (
                <Volume2 className="w-3.5 h-3.5 text-amber-300" />
              )}
              <span>{ringMuted ? "벨소리 켜기" : "크리스마스 벨소리 울리는 중"}</span>
            </button>

            <div className="flex items-center justify-around px-4">
              <button
                type="button"
                onClick={() => router.push("/setup")}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-16 h-16 rounded-full bg-rose-600/90 group-hover:bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-950 border border-rose-400/50 transition transform active:scale-95">
                  <PhoneOff className="w-7 h-7" />
                </div>
                <span className="text-xs font-bold text-slate-300">나중에 받기</span>
              </button>

              <button
                type="button"
                onClick={handleAcceptIncomingCall}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 group-hover:from-emerald-400 group-hover:to-teal-300 text-slate-950 flex items-center justify-center shadow-[0_0_35px_rgba(16,185,129,0.7)] border-2 border-white animate-bounce transition transform active:scale-95">
                  <PhoneCall className="w-9 h-9 fill-slate-950" />
                </div>
                <span className="text-sm font-extrabold text-emerald-300">
                  📞 통화 받기 (터치!)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          레이어 3: 실시간 통화 상단 HUD & 우측 상단 우리 아이 전면 카메라 PIP
      ============================================================ */}
      {callPhase === "connected" && (
        <div className="relative z-20 flex items-start justify-between p-4 pt-5">
          <div className="space-y-2 max-w-[62%]">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/65 backdrop-blur-md border border-white/15">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs font-bold text-white">북극 LIVE</span>
              <span className="text-xs font-mono text-amber-300">
                {formatTime(elapsedSec)}
              </span>
            </div>

            {detectedGifts.length > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/80 backdrop-blur-md border border-emerald-400/30">
                <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="text-[11px] text-emerald-200 font-medium truncate">
                  포착된 선물: <strong className="text-white">{detectedGifts[0]}</strong>
                </span>
              </div>
            )}
          </div>

          {/* 우측 상단: 우리 아이 전면 카메라 PIP */}
          <ChildFrontCameraPip videoEnabled={camEnabled} childName={note.childName} />
        </div>
      )}

      {/* ============================================================
          레이어 4: 하단 실시간 자막, 접이식 키보드 입력 & 통화 컨트롤 바
      ============================================================ */}
      {callPhase === "connected" && (
        <div className="relative z-20 mt-auto px-4 pb-5 pt-2 space-y-2.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent">
          {/* 산타할아버지 & 아이 실시간 음성 자막 카드 */}
          <div className="p-3.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-amber-400/35 shadow-lg space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                🎅 산타할아버지 실시간 자막
              </span>
              <button
                type="button"
                onClick={() => setShowKeyboardBar((v) => !v)}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20 text-[10px] text-slate-200 transition"
              >
                {showKeyboardBar ? (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    <span>키보드 닫기</span>
                  </>
                ) : (
                  <>
                    <Keyboard className="w-3 h-3 text-amber-300" />
                    <span>글자로 말하기</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs sm:text-sm text-white leading-relaxed font-medium">
              &ldquo;{latestSantaMessage}&rdquo;
            </p>

            {latestTurn?.speaker === "child" && (
              <div className="pt-1 border-t border-white/10 text-[11px] text-sky-300 truncate">
                🧒 {note.childName}: &ldquo;{latestTurn.text}&rdquo;
              </div>
            )}
          </div>

          {/* 조용한 환경 또는 테스트용 접이식 키보드 입력 바 */}
          {showKeyboardBar && (
            <div className="space-y-1.5 pt-0.5">
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() =>
                    handleSendChildUtterance(
                      `할아버지! 저 크리스마스 선물로 ${note.giftHint || "레고 소방차"} 받고 싶어요!`
                    )
                  }
                  className="text-[11px] px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 border border-amber-400/40 shrink-0 transition"
                >
                  🎁 &ldquo;{note.giftHint || "레고 소방차"} 받고 싶어요!&rdquo;
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleSendChildUtterance("산타할아버지 진짜 있어요? 가짜 아니에요?")
                  }
                  className="text-[11px] px-2.5 py-1 rounded-full bg-sky-400/20 hover:bg-sky-400/30 text-sky-200 border border-sky-400/40 shrink-0 transition"
                >
                  🤔 &ldquo;산타 진짜 있어요?&rdquo;
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChildUtterance();
                }}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={childInputText}
                  onChange={(e) => setChildInputText(e.target.value)}
                  placeholder="산타할아버지에게 보낼 말을 입력하세요..."
                  className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 transition"
                >
                  <MessageSquareHeart className="w-3.5 h-3.5" />
                  전송
                </button>
              </form>
            </div>
          )}

          {/* 하단 통화 제어 버튼 (마이크, 통화 종료, 카메라) */}
          <div className="flex items-center justify-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => setMicEnabled((v) => !v)}
              aria-label="마이크 토글"
              className={`px-3.5 h-12 rounded-full flex items-center justify-center gap-1.5 border text-xs font-bold transition ${
                micEnabled
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 hover:bg-emerald-500/35"
                  : "bg-rose-600/80 border-rose-400 text-white"
              }`}
            >
              {micEnabled ? (
                <>
                  <Mic className="w-4 h-4 text-emerald-300" />
                  <span>마이크 켜짐</span>
                </>
              ) : (
                <>
                  <MicOff className="w-4 h-4" />
                  <span>음소거됨</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleEndCall}
              aria-label="통화 종료 및 리포트 보기"
              className="px-5 h-14 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-950/80 border border-red-400/50 flex items-center gap-2 transition transform active:scale-95"
            >
              <PhoneOff className="w-5 h-5" />
              <span>통화 종료</span>
            </button>

            <button
              type="button"
              onClick={() => setCamEnabled((v) => !v)}
              aria-label="카메라 토글"
              className={`px-3.5 h-12 rounded-full flex items-center justify-center gap-1.5 border text-xs font-bold transition ${
                camEnabled
                  ? "bg-emerald-500/25 border-emerald-400 text-emerald-200 hover:bg-emerald-500/35"
                  : "bg-rose-600/80 border-rose-400 text-white"
              }`}
            >
              {camEnabled ? (
                <>
                  <Video className="w-4 h-4 text-emerald-300" />
                  <span>카메라 켜짐</span>
                </>
              ) : (
                <>
                  <VideoOff className="w-4 h-4" />
                  <span>카메라 꺼짐</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
