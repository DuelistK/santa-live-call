// 모바일 뷰포트(9:16)에 최적화된 Apple 스타일 앱 컨테이너 레이아웃
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SantaSessionProvider } from "@/context/SantaSessionContext";

export const metadata: Metadata = {
  title: "산타와 통화하기 | Santa Live Call",
  description: "북극 산타할아버지와 실시간으로 연결되는 AI 음성·영상 통화",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0A0F1D",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-[#D4AF37] selection:text-[#0A0F1D]">
        <SantaSessionProvider>
          <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-[#060911] sm:py-5">
            <main className="relative w-full max-w-[420px] min-h-dvh sm:min-h-[844px] sm:max-h-[896px] bg-[#0A0F1D] sm:rounded-[44px] sm:border border-white/[0.08] shadow-[0_32px_90px_rgba(0,0,0,0.85)] overflow-hidden flex flex-col">
              {children}
            </main>
          </div>
        </SantaSessionProvider>
      </body>
    </html>
  );
}
