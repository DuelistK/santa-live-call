"use client";
// 레거시 /setup 경로 접근 시 간소화된 메인 홈 화면(/)으로 즉시 이동시키는 리다이렉트 페이지

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return <div className="flex-1 bg-[#0A0F1D]" />;
}
