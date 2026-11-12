import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SantaSessionProvider } from "@/context/SantaSessionContext";

export const metadata: Metadata = {
  title: "산타할아버지 실시간 영상통화 | Santa Live Call",
  description:
    "북극 산타 마을과 연결되는 실시간 AI 산타할아버지 영상 통화 & 부모님용 비밀 산타 노트 MVP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0B132B",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="antialiased selection:bg-santa-gold selection:text-slate-950">
        <SantaSessionProvider>
          {/* 모바일 9:16 WebView 친화적 중앙 컨테이너 */}
          <div className="min-h-dvh w-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-950 via-[#0B132B] to-slate-950 sm:py-4">
            <main className="relative w-full max-w-[430px] min-h-dvh sm:min-h-[844px] sm:max-h-[900px] bg-[#0F172A] sm:rounded-[38px] sm:border-[6px] sm:border-slate-800/90 shadow-[0_25px_70px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col">
              {children}
            </main>
          </div>
        </SantaSessionProvider>
      </body>
    </html>
  );
}
