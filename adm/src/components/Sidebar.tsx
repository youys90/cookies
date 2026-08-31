"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useAdmLanguage } from "@/contexts/LanguageContext";
import ProfileModal from "./ProfileModal";
import FlagIcon from "./FlagIcon";

const menuItems = [
  { name: "대시보드", href: "/", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { name: "상품 관리", href: "/products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
  { name: "카테고리 관리", href: "/categories", icon: "M4 6h16M4 12h16M4 18h7" },
  { name: "주문 관리", href: "/orders", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { name: "리뷰 관리", href: "/reviews", icon: "M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" },
  { name: "LINE 알림", href: "/settings", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
  { name: "스케쥴러", href: "/scheduler", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  { name: "화면 꾸미기", href: "/customize", icon: "M4 5a2 2 0 012-2h12a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm2 3h12M6 12h12M6 16h8" },
  { name: "임시저장", href: "/drafts", icon: "M4 7v11a2 2 0 002 2h12a2 2 0 002-2V9.414a2 2 0 00-.586-1.414l-4.414-4.414A2 2 0 0013.586 3H6a2 2 0 00-2 2v2z M8 12h8M8 16h5" },
];

const adminOnlyMenuItems = [
  { name: "계정관리", href: "/account", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" },
];

interface SidebarProps {
  /** Mobile drawer 열림 여부 · PC(lg 이상)에선 무시됨 */
  mobileOpen?: boolean;
  /** Mobile drawer 닫기 핸들러 (backdrop 클릭 · 메뉴 선택 · 로그아웃 시 호출) */
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen = false, onCloseMobile }: SidebarProps = {}) {
  const pathname = usePathname();
  const { username, isAdmin, logout } = useAuth();
  const { language, setLanguage } = useAdmLanguage();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const allMenuItems = isAdmin ? [...menuItems, ...adminOnlyMenuItems] : menuItems;
  const closeMobile = () => onCloseMobile?.();

  return (
    <>
      {/* Mobile Backdrop · drawer 열림 시만 렌더 · lg 이상에선 숨김 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside
        id="adm-mobile-sidebar"
        className={`w-64 bg-gray-900 fixed left-0 top-0 h-screen max-h-screen overflow-y-auto z-50 lg:z-30 transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        {/* Logo — CREAM 브랜드 강조 */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-[26px] tracking-[0.05em] text-[var(--color-brand)] leading-none">
              CREAM
            </span>
            <span className="text-[10px] tracking-[0.25em] text-gray-500">ADMIN</span>
          </div>
        </div>

        {/* User - 상단 (클릭 시 내 정보 수정) */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center justify-between">
            <button
              onClick={() => { closeMobile(); setShowProfileModal(true); }}
              className="flex items-center hover:opacity-80 transition-opacity"
            >
              <div className="w-9 h-9 bg-gray-700 rounded-full flex items-center justify-center">
                <span className="text-xs text-white font-medium">
                  {username?.slice(0, 2).toUpperCase() || "AD"}
                </span>
              </div>
              <div className="ml-3 text-left">
                <p className="text-sm text-white font-medium">{username || "관리자"}</p>
                <p className="text-xs text-gray-500">{isAdmin ? "최고관리자" : "관리자"}</p>
              </div>
            </button>
            <button
              onClick={() => { closeMobile(); logout(); }}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="로그아웃"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>

          {/* 언어 스위처 · 브랜드 컬러 활성 · 심플 · 명확 */}
          <div className="mt-4" role="group" aria-label="언어 전환">
            <div className="text-[9px] font-semibold tracking-[0.25em] text-gray-500 uppercase mb-2">Language</div>
            <div className="flex items-stretch bg-gray-800/60 rounded-full p-1 border border-gray-700/50">
              <button
                type="button"
                onClick={() => setLanguage("ko")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all duration-200 ${
                  language === "ko"
                    ? "bg-[var(--color-brand)] text-white shadow-md font-semibold"
                    : "text-gray-400 hover:text-white"
                }`}
                aria-pressed={language === "ko"}
                aria-label="한국어로 전환"
              >
                <FlagIcon code="KR" className="w-5 h-3.5 rounded-sm ring-1 ring-white/25 shadow-sm" />
                <span className="text-[11px] tracking-wider">한국어</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage("ja")}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-full transition-all duration-200 ${
                  language === "ja"
                    ? "bg-[var(--color-brand)] text-white shadow-md font-semibold"
                    : "text-gray-400 hover:text-white"
                }`}
                aria-pressed={language === "ja"}
                aria-label="日本語に切替"
              >
                <FlagIcon code="JP" className="w-5 h-3.5 rounded-sm ring-1 ring-white/25 shadow-sm" />
                <span className="text-[11px] tracking-wider">日本語</span>
              </button>
            </div>
          </div>
        </div>

        {/* Menu */}
        <nav className="mt-4 px-3 pb-8">
          {allMenuItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={closeMobile}
                className={`flex items-center px-4 py-3 mb-1 rounded-lg transition-colors ${
                  isActive
                    ? "bg-gray-800 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
              >
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                <span className="text-sm">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />
    </>
  );
}
