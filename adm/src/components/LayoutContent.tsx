"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import Sidebar from "./Sidebar";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, isLoggedIn } = useAuth();

  // Mobile drawer 상태
  const [mobileOpen, setMobileOpen] = useState(false);

  // Route 변경 시 · drawer 자동 닫힘 (모바일 UX)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // ESC 로 닫기 + body scroll lock
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

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

  // 로그인된 상태: Mobile header (< lg) + Sidebar (PC 항상 · 모바일 drawer) + 메인 콘텐츠
  return (
    <>
      {/* Mobile Top Bar · lg 이상에선 숨김 */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-gray-900 text-white flex items-center px-3 shadow-md">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="w-11 h-11 -ml-1 flex items-center justify-center rounded-md hover:bg-white/10 active:bg-white/20 transition"
          aria-label="메뉴 열기"
          aria-expanded={mobileOpen}
          aria-controls="adm-mobile-sidebar"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <div className="ml-1 flex items-baseline gap-2 select-none">
          <span className="font-serif text-[20px] tracking-[0.05em] text-[var(--color-brand)] leading-none">CREAM</span>
          <span className="text-[9px] tracking-[0.25em] text-gray-400">ADMIN</span>
        </div>
      </header>

      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />

      {/* Main · Mobile: 상단 header 만큼 padding · PC: 기존 · 최소 diff */}
      <main className="lg:ml-64 min-h-screen px-4 sm:px-6 lg:px-8 pt-[72px] lg:pt-8 pb-4 sm:pb-6 lg:pb-8">{children}</main>
    </>
  );
}
