"use client";
// /setup 경로로 직접 진입 시 메인 홈 화면의 '부모님 비밀 산타 수첩' 시트를 즉시 열어주는 리다이렉트 페이지

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SetupRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/?setup=1");
  }, [router]);

  return <div className="flex-1 bg-[#080E1E]" />;
}
