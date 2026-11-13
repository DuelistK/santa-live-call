// 모바일 뷰포트(9:16)에 최적화된 North Pole Magic Portal 앱 컨테이너 레이아웃
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SantaSessionProvider } from "@/context/SantaSessionContext";

export const metadata: Metadata = {
  title: "산타와 영상통화 | Santa Live Call",
  description: "북극 산타할아버지와 실시간으로 연결되는 AI 음성·영상 통화",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#080E1E",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-[#E5C158] selection:text-[#080E1E]">
        <SantaSessionProvider>
          <div className="relative min-h-dvh w-full flex flex-col items-center justify-center bg-[#040711] sm:py-5 overflow-hidden">
            {/* 데스크톱/태블릿 뷰에서 스마트폰 프레임 바깥을 감싸는 은은한 오로라 스튜디오 조명 */}
            <div
              aria-hidden="true"
              className="pointer-events-none hidden sm:block absolute -top-32 left-1/3 w-[480px] h-[480px] rounded-full bg-emerald-500/10 blur-[140px]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none hidden sm:block absolute -bottom-32 right-1/3 w-[480px] h-[480px] rounded-full bg-[#B81D24]/12 blur-[140px]"
            />

            <main className="relative z-10 w-full max-w-[420px] min-h-dvh sm:min-h-[852px] sm:max-h-[900px] bg-[#080E1E] sm:rounded-[46px] sm:border-[1.5px] border-white/[0.13] shadow-[0_36px_100px_rgba(0,0,0,0.9),0_0_0_1px_rgba(229,193,88,0.08)] overflow-hidden flex flex-col">
              {children}
            </main>
          </div>
        </SantaSessionProvider>
      </body>
    </html>
  );
}
