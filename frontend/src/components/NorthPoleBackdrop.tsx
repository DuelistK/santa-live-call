"use client";
// 북극 밤하늘 오로라·눈송이 파티클 배경 및 황금 스노우글로브 산타 포털 공용 그래픽 컴포넌트

import React from "react";

// SSR/CSR Hydration 불일치가 발생하지 않는 결정론적 눈송이/별빛 파티클 좌표
const SNOW_PARTICLES = [
  { left: "7%", size: 3, duration: "13s", delay: "0s", opacity: 0.55 },
  { left: "16%", size: 2, duration: "16s", delay: "2.5s", opacity: 0.4 },
  { left: "24%", size: 3.5, duration: "11s", delay: "1.2s", opacity: 0.65 },
  { left: "33%", size: 2, duration: "15s", delay: "4.1s", opacity: 0.45 },
  { left: "42%", size: 3, duration: "14s", delay: "0.7s", opacity: 0.5 },
  { left: "53%", size: 2.5, duration: "17s", delay: "3.3s", opacity: 0.4 },
  { left: "64%", size: 3.5, duration: "12s", delay: "1.9s", opacity: 0.6 },
  { left: "73%", size: 2, duration: "15.5s", delay: "5.2s", opacity: 0.45 },
  { left: "82%", size: 3, duration: "13.5s", delay: "2.1s", opacity: 0.55 },
  { left: "91%", size: 2.5, duration: "16.5s", delay: "0.4s", opacity: 0.5 },
  { left: "12%", size: 2, duration: "18s", delay: "6.5s", opacity: 0.35 },
  { left: "58%", size: 2, duration: "14.5s", delay: "7.2s", opacity: 0.4 },
  { left: "78%", size: 2.5, duration: "12.8s", delay: "4.8s", opacity: 0.5 },
  { left: "29%", size: 2, duration: "16.2s", delay: "8.1s", opacity: 0.35 },
];

export function NorthPoleBackdrop({
  intensity = "normal",
}: {
  intensity?: "normal" | "vivid";
}) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden z-0"
    >
      {/* 깊은 북극 밤하늘 베이스 그라데이션 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#091328] via-[#080E1E] to-[#060A15]" />

      {/* 북극 오로라 커튼 (에메랄드 틸 & 샴페인 골드 & 크림슨 웜 글로우) */}
      <div
        className={`absolute -top-28 -left-16 w-80 h-72 rounded-full blur-[90px] animate-aurora-breathe ${
          intensity === "vivid" ? "bg-emerald-400/22" : "bg-emerald-400/14"
        }`}
      />
      <div
        className={`absolute -top-24 right-[-60px] w-72 h-72 rounded-full blur-[95px] animate-aurora-breathe ${
          intensity === "vivid" ? "bg-teal-300/20" : "bg-[#E5C158]/12"
        }`}
        style={{ animationDelay: "2.2s" }}
      />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full bg-[#B81D24]/14 blur-[110px]" />
      <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-64 rounded-full bg-[#B81D24]/18 blur-[100px]" />

      {/* 은은하게 내리는 북극 눈송이 파티클 */}
      {SNOW_PARTICLES.map((flake, idx) => (
        <span
          key={idx}
          className="absolute top-0 rounded-full bg-white animate-snow-drift"
          style={{
            left: flake.left,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDuration: flake.duration,
            animationDelay: flake.delay,
            boxShadow: "0 0 6px rgba(255, 255, 255, 0.7)",
          }}
        />
      ))}
    </div>
  );
}

/**
 * 홈 화면 및 발신 연결 화면에서 공유하는 황금 스노우글로브 산타 포털 프레임
 */
export function SantaSnowglobePortal({
  mode = "home",
  activePulse = false,
  size = "lg",
}: {
  mode?: "home" | "dialing";
  activePulse?: boolean;
  size?: "md" | "lg";
}) {
  const frameDim = size === "lg" ? "w-56 h-56" : "w-48 h-48";
  const outerRingDim = size === "lg" ? "w-64 h-64" : "w-56 h-56";

  return (
    <div className="relative flex items-center justify-center my-2">
      {/* 배경 황금 후광 */}
      <div className="pointer-events-none absolute w-64 h-64 rounded-full bg-[#E5C158]/16 blur-[48px]" />

      {/* 발신 연결 시 회전하는 황금 천구 궤도 링 */}
      {mode === "dialing" ? (
        <>
          <div
            className="pointer-events-none absolute w-[268px] h-[228px] rounded-[50%] border border-[#E5C158]/40 animate-orbit-slow"
            style={{ boxShadow: "0 0 18px rgba(229,193,88,0.16)" }}
          />
          <div
            className="pointer-events-none absolute w-[228px] h-[268px] rounded-[50%] border border-[#F3DC99]/30 animate-orbit-reverse"
          />
          {activePulse && (
            <div
              className="pointer-events-none absolute w-64 h-64 rounded-full border border-[#E5C158]/35 animate-ping"
              style={{ animationDuration: "2.4s" }}
            />
          )}
        </>
      ) : (
        <>
          <div
            className={`pointer-events-none absolute ${outerRingDim} rounded-full border border-[#E5C158]/25 animate-pulse-slow`}
          />
          <div className="pointer-events-none absolute w-[242px] h-[242px] rounded-full border border-dashed border-[#F3DC99]/20 animate-orbit-slow" />
        </>
      )}

      {/* 좌우 황금 사운드웨이브 장식 바 */}
      <div className="pointer-events-none absolute -left-8 flex items-center gap-1 opacity-75">
        <span className="w-[2px] h-2.5 rounded-full bg-[#E5C158]/40" />
        <span className="w-[2px] h-5 rounded-full bg-[#E5C158]/65" />
        <span className="w-[2px] h-8 rounded-full bg-[#F3DC99]/85" />
        <span className="w-[2px] h-4 rounded-full bg-[#E5C158]/60" />
      </div>
      <div className="pointer-events-none absolute -right-8 flex items-center gap-1 opacity-75">
        <span className="w-[2px] h-4 rounded-full bg-[#E5C158]/60" />
        <span className="w-[2px] h-8 rounded-full bg-[#F3DC99]/85" />
        <span className="w-[2px] h-5 rounded-full bg-[#E5C158]/65" />
        <span className="w-[2px] h-2.5 rounded-full bg-[#E5C158]/40" />
      </div>

      {/* 메인 샴페인 골드 스노우글로브 포털 액자 */}
      <div
        className={`relative ${frameDim} rounded-full p-[5px] bg-gradient-to-b from-[#FFF3C4] via-[#D4AF37] to-[#8C691C] shadow-[0_22px_55px_rgba(0,0,0,0.72),0_0_32px_rgba(229,193,88,0.28)]`}
      >
        <div className="relative w-full h-full rounded-full overflow-hidden bg-[#12192B] ring-2 ring-[#080E1E]/60">
          <img
            src="/images/santa-portal-portrait.png?v=2"
            alt="북극 공방의 산타할아버지"
            className="w-full h-full object-cover scale-[1.03] select-none"
            draggable={false}
          />
          {/* 스노우글로브 유리 하이라이트 반사광 */}
          <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-black/25 via-transparent to-white/15" />
        </div>

        {/* 실시간 온라인 에메랄드 상태 배지 (홈 모드) */}
        {mode === "home" && (
          <span
            title="북극 공방 실시간 대기 중"
            className="absolute bottom-3 right-3 w-4 h-4 rounded-full bg-emerald-400 ring-4 ring-[#080E1E] shadow-[0_0_12px_rgba(52,211,153,0.9)]"
          />
        )}
      </div>
    </div>
  );
}
