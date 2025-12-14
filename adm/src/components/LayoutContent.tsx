"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, isLoggedIn } = useAuth();

  // 로딩 중일 때 빈 화면
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  // 로그인 페이지는 Sidebar 없이 표시
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 로그인 안 된 상태면 빈 화면 (AuthContext에서 리다이렉트 처리)
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  // 로그인된 상태: Sidebar + 메인 콘텐츠
  return (
    <>
      <Sidebar />
      <main className="ml-64 min-h-screen p-8">{children}</main>
    </>
  );
}
