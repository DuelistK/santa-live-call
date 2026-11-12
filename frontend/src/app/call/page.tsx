"use client";

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
  Sparkles,
  Volume2,
  VolumeX,
  Gift,
  MessageSquareHeart,
  Radio,
} from "lucide-react";
import { useSantaSession } from "@/context/SantaSessionContext";
import { ChatTurn, ConnectionDetailsResponse } from "@/types/santa";

// Web Audio API 기반 크리스마스 차임/벨소리 합성기 (외부 오디오 파일 의존성 없음)
function useNorthPoleRingtone(active: boolean, muted: boolean) {
  useEffect(() => {
    if (!active || muted || typeof window === "undefined") return;

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    let ctx: AudioContext | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const playBellPattern = () => {
      try {
        if (!ctx) ctx = new AudioCtx();
        if (ctx.state === "suspended") ctx.resume();

        // Jingle chime notes (E5 - E5 - E5 - G5 - C5 - D5 - E5)
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
        // Autoplay policy block is safely ignored until user interaction
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

// 아이의 전면 카메라 PIP 컴포넌트
function ChildFrontCameraPip({ videoEnabled }: { videoEnabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (!videoEnabled) {
      setHasCamera(false);
      return;
    }

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((mediaStream) => {
        stream = mediaStream;
        setHasCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      })
      .catch(() => {
        setHasCamera(false);
      });

    return () => {
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [videoEnabled]);

  return (
    <div className="relative w-24 h-32 rounded-2xl overflow-hidden border-2 border-amber-400/80 shadow-xl bg-slate-900/95">
      {videoEnabled && hasCamera ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 to-slate-950 p-2 text-center">
          <div className="w-9 h-9 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-lg mb-1">
            🧒
          </div>
          <span className="text-[10px] text-slate-300 font-medium leading-tight">
            전면 카메라 PIP
          </span>
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm">
        <span className="text-[9px] font-semibold text-white truncate">우리 아이</span>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
    </div>
  );
}

// LiveKit Room 내부 실시간 아바타 비디오 트랙 & DataChannel 수신 컴포넌트
function LiveKitActiveStage({
  onAvatarReady,
  onRemoteReport,
  micEnabled,
  camEnabled,
}: {
  onAvatarReady: (hasVideo: boolean) => void;
  onRemoteReport: (payload: Record<string, unknown>) => void;
  micEnabled: boolean;
  camEnabled: boolean;
}) {
  const tracks = useTracks([Track.Source.Camera]);
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    localParticipant.setMicrophoneEnabled(micEnabled).catch(() => {});
  }, [localParticipant, micEnabled]);

  useEffect(() => {
    localParticipant.setCameraEnabled(camEnabled).catch(() => {});
  }, [localParticipant, camEnabled]);

  const remoteAvatarTrack = tracks.find(
    (t) => !t.participant.isLocal && t.source === Track.Source.Camera
  );

  useEffect(() => {
    onAvatarReady(Boolean(remoteAvatarTrack));
  }, [remoteAvatarTrack, onAvatarReady]);

  useDataChannel("santa-report", (msg) => {
    try {
      const text = new TextDecoder().decode(msg.payload);
      const parsed = JSON.parse(text);
      onRemoteReport(parsed);
    } catch {
      // ignore malformed packet
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
  const [callPhase, setCallPhase] = useState<"dialing" | "connected">("dialing");
  const [hasRemoteAvatarVideo, setHasRemoteAvatarVideo] = useState(false);
  const [ringMuted, setRingMuted] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [santaSpeaking, setSantaSpeaking] = useState(true);
  const [childInputText, setChildInputText] = useState("");
  const [detectedGifts, setDetectedGifts] = useState<string[]>(
    note.giftHint ? [note.giftHint] : ["레고 시티 소방차 세트"]
  );
  const [transcript, setTranscript] = useState<ChatTurn[]>([]);

  // 벨소리는 발신 대기(dialing) 상태일 때만 재생
  useNorthPoleRingtone(callPhase === "dialing", ringMuted);

  // 1. LiveKit 토큰 및 메타데이터 발급 요청
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

  // 2. 발신 대기 애니메이션 후 크로스페이드(Cross-fade) 전환 및 산타 첫인사
  useEffect(() => {
    const timer = setTimeout(() => {
      setCallPhase("connected");
      const firstGreeting: ChatTurn = {
        id: `santa-${Date.now()}`,
        speaker: "santa",
        text: `호호호! 우리 ${note.childName} 어린이, 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다! 올해 '${note.praise}' 한 모습을 마법 수첩에서 다 보았단다!`,
        timestamp: "00:02",
      };
      setTranscript([firstGreeting]);
    }, 2800);

    return () => clearTimeout(timer);
  }, [note.childName, note.praise]);

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

  // 아이 발화 시뮬레이션 / 빠른 대화 테스트 (동심 수호 및 선물 추출 검증용)
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

    // 산타의 동심 수호 & 1~2문장 짧은 응답 생성
    let santaReply = "";
    if (text.includes("진짜") || text.includes("가짜") || text.includes("거짓말")) {
      santaReply = `호호호! 방금 루돌프 코가 반짝이는 바람에 북극 카메라가 살짝 흔들렸나 보구나! 옆에서 요정 친구들이 ${note.childName}에게 줄 선물을 포장하고 있는 진짜 산타할아버지란다!`;
    } else if (text.includes("선물") || text.includes("레고") || text.includes("로봇") || text.includes("인형") || text.includes("갖고 싶")) {
      const cleanedKeyword = text
        .replace(/할아버지|산타|저|선물로|받고 싶어요|사주세요|주세요|!/g, "")
        .trim();
      if (cleanedKeyword.length >= 2) {
        setDetectedGifts((prev) =>
          Array.from(new Set([cleanedKeyword, ...prev]))
        );
      }
      santaReply = `호호호! 그렇구나! 우리 ${note.childName}이가 '${note.mission}' 약속을 손가락 걸고 잘 지키면 크리스마스이브에 산타할아버지가 꼭 챙겨주마!`;
    } else {
      santaReply = `허허허, 목소리가 참 씩씩하구나! 우리 ${note.childName}이가 '${note.mission}' 약속도 잘 지킬 수 있겠지? 호호호!`;
    }

    const santaTurn: ChatTurn = {
      id: `santa-${Date.now() + 1}`,
      speaker: "santa",
      text: santaReply,
      timestamp: formatTime(elapsedSec + 2),
    };

    setTranscript((prev) => [...prev, childTurn, santaTurn]);
    setChildInputText("");
    setSantaSpeaking(true);
    setTimeout(() => setSantaSpeaking(false), 3200);
  };

  // 통화 종료 -> 리포트 저장 후 /report 화면으로 이동
  const handleEndCall = () => {
    setReport({
      childName: note.childName,
      callDurationSec: Math.max(elapsedSec, 42),
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

  const latestSantaMessage =
    [...transcript].reverse().find((t) => t.speaker === "santa")?.text ||
    `호호호! 우리 ${note.childName} 어린이, 반갑구나!`;

  return (
    <div className="relative flex-1 w-full h-full bg-[#070B19] overflow-hidden flex flex-col justify-between select-none">
      {/* LiveKit Cloud 연결 세션 (실제 키 설정 시 WebRTC 연결 구동) */}
      {connDetails && !connDetails.demoMode && (
        <LiveKitRoom
          serverUrl={connDetails.serverUrl}
          token={connDetails.participantToken}
          connect={true}
          audio={micEnabled}
          video={camEnabled}
          className="absolute inset-0 z-0"
        >
          <RoomAudioRenderer />
          <LiveKitActiveStage
            onAvatarReady={setHasRemoteAvatarVideo}
            onRemoteReport={handleRemoteReport}
            micEnabled={micEnabled}
            camEnabled={camEnabled}
          />
        </LiveKitRoom>
      )}

      {/* ============================================================
          레이어 1: 실시간 AI 산타 영상 스트림 (Cross-fade In)
      ============================================================ */}
      <div
        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
          callPhase === "connected" ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        {/* 원격 LiveKit 아바타 비디오가 없을 때 보여줄 인터랙티브 산타 아바타 캔버스 */}
        {!hasRemoteAvatarVideo && (
          <div className="relative w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#1B1534] via-[#121D38] to-[#080D1A] overflow-hidden">
            {/* 북극 오로라 & 눈송이 배경 효과 */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-emerald-500/15 blur-3xl animate-pulse" />
            <div className="absolute top-1/4 -left-16 w-72 h-72 rounded-full bg-red-600/20 blur-3xl" />

            {/* 산타 작업실 배경 장식 */}
            <div className="relative flex flex-col items-center mt-[-40px]">
              {/* 아바타 립싱크 파동 링 */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`absolute w-56 h-56 rounded-full border-2 border-amber-400/40 transition-transform duration-500 ${
                    santaSpeaking ? "scale-110 animate-ping opacity-30" : "scale-100 opacity-10"
                  }`}
                />
                <div
                  className={`absolute w-48 h-48 rounded-full bg-gradient-to-tr from-red-600/40 to-amber-400/30 blur-md transition-all duration-300 ${
                    santaSpeaking ? "scale-105" : "scale-95"
                  }`}
                />

                {/* 산타할아버지 메인 초상 아바타 */}
                <div className="relative w-44 h-44 rounded-full bg-gradient-to-b from-red-700 via-red-800 to-slate-900 border-4 border-amber-400/90 shadow-[0_0_50px_rgba(245,197,66,0.35)] flex flex-col items-center justify-center overflow-hidden">
                  <div className="text-7xl transform transition-transform duration-300 animate-float">
                    🎅
                  </div>
                  {/* 실시간 립싱크 이퀄라이저 바 */}
                  <div className="mt-2 flex items-end gap-1 h-4">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <span
                        key={bar}
                        className={`w-1 rounded-full bg-amber-300 transition-all duration-200 ${
                          santaSpeaking ? "animate-bounce h-3.5" : "h-1.5 opacity-50"
                        }`}
                        style={{ animationDelay: `${bar * 120}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/15 backdrop-blur-md">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span className="text-xs font-semibold text-white">
                  북극 산타할아버지 (
                  {note.avatarProvider === "heygen"
                    ? "HeyGen LiveAvatar"
                    : note.avatarProvider === "lemonslice"
                    ? "LemonSlice Lip-Sync"
                    : "Anam Persona Avatar"}
                  )
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================
          레이어 2: 통화 발신/대기 화면 (Cross-fade Out)
      ============================================================ */}
      <div
        className={`absolute inset-0 flex flex-col items-center justify-between py-12 px-6 bg-gradient-to-b from-[#162447] via-[#0F172A] to-[#070B19] transition-opacity duration-1000 ease-in-out ${
          callPhase === "dialing" ? "opacity-100 z-30" : "opacity-0 z-0 pointer-events-none"
        }`}
      >
        <div className="text-center space-y-1.5 mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/15 text-amber-300 border border-amber-400/30">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            북극 산타 마을 위성 연결 중...
          </span>
          <h2 className="text-2xl font-extrabold text-white tracking-tight pt-2">
            산타할아버지에게 걸고 있어요
          </h2>
          <p className="text-xs text-slate-300">
            루돌프가 마법 수첩에서 <strong className="text-amber-300">{note.childName}</strong> 어린이 이름을 찾고 있어요!
          </p>
        </div>

        {/* 중앙 벨소리 파동 애니메이션 */}
        <div className="relative flex items-center justify-center my-auto">
          <div className="absolute w-52 h-52 rounded-full bg-red-500/15 animate-ping" />
          <div className="absolute w-40 h-40 rounded-full bg-amber-400/20 animate-pulse" />
          <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-red-600 to-red-800 border-4 border-amber-300 shadow-2xl flex items-center justify-center text-6xl">
            🛷
          </div>
        </div>

        <div className="w-full space-y-3 text-center">
          <button
            type="button"
            onClick={() => setRingMuted((m) => !m)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/15 text-xs text-slate-200 border border-white/15 transition"
          >
            {ringMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-300" />}
            <span>{ringMuted ? "벨소리 켜기" : "크리스마스 벨소리 울리는 중"}</span>
          </button>
        </div>
      </div>

      {/* ============================================================
          레이어 3: 실시간 통화 상단 HUD & 우측 상단 아이 전면 카메라 PIP
      ============================================================ */}
      <div className="relative z-20 flex items-start justify-between p-4 pt-5">
        {/* 좌측 상단: 통화 상태 & 추출된 선물 뱃지 */}
        <div className="space-y-2 max-w-[62%]">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/15">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-white">LIVE</span>
            <span className="text-xs font-mono text-amber-300">
              {formatTime(elapsedSec)}
            </span>
          </div>

          {detectedGifts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/80 backdrop-blur-md border border-emerald-400/30">
              <Gift className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="text-[11px] text-emerald-200 font-medium truncate">
                포착된 선물: <strong className="text-white">{detectedGifts[0]}</strong>
              </span>
            </div>
          )}
        </div>

        {/* 우측 상단: 아이 전면 카메라 PIP */}
        <ChildFrontCameraPip videoEnabled={camEnabled} />
      </div>

      {/* ============================================================
          레이어 4: 하단 실시간 자막, 대화 테스트 칩 & 통화 컨트롤 바
      ============================================================ */}
      <div className="relative z-20 mt-auto px-4 pb-5 pt-2 space-y-3 bg-gradient-to-t from-black/90 via-black/65 to-transparent">
        {/* 산타할아버지 실시간 음성 자막 버블 */}
        <div className="p-3.5 rounded-2xl bg-slate-900/85 backdrop-blur-md border border-amber-400/35 shadow-lg">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
              🎅 산타할아버지의 말
            </span>
            <span className="text-[10px] text-slate-400">1~2문장 눈높이 대화</span>
          </div>
          <p className="text-xs sm:text-sm text-white leading-relaxed font-medium">
            &ldquo;{latestSantaMessage}&rdquo;
          </p>
        </div>

        {/* 아이 발화 빠른 테스트 버튼 (동심 보호 & 선물 추출 즉시 확인용) */}
        <div className="space-y-1.5">
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
              🤔 &ldquo;산타 진짜 있어요?&rdquo; (동심 보호 테스트)
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
              placeholder="아이가 말할 내용을 입력해 테스트해 보세요..."
              className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1 shrink-0 transition"
            >
              <MessageSquareHeart className="w-3.5 h-3.5" />
              말하기
            </button>
          </form>
        </div>

        {/* 하단 통화 제어 버튼 (마이크, 카메라, 통화 종료) */}
        <div className="flex items-center justify-center gap-5 pt-1">
          <button
            type="button"
            onClick={() => setMicEnabled((v) => !v)}
            aria-label="마이크 토글"
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition ${
              micEnabled
                ? "bg-white/15 border-white/25 text-white hover:bg-white/25"
                : "bg-rose-600/80 border-rose-400 text-white"
            }`}
          >
            {micEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={handleEndCall}
            aria-label="통화 종료 및 리포트 보기"
            className="px-6 h-14 rounded-full bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-xl shadow-red-950/80 border border-red-400/50 flex items-center gap-2 transition transform active:scale-95"
          >
            <PhoneOff className="w-5 h-5" />
            <span>통화 종료</span>
          </button>

          <button
            type="button"
            onClick={() => setCamEnabled((v) => !v)}
            aria-label="카메라 토글"
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition ${
              camEnabled
                ? "bg-white/15 border-white/25 text-white hover:bg-white/25"
                : "bg-rose-600/80 border-rose-400 text-white"
            }`}
          >
            {camEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
