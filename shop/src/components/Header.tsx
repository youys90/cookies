"use client";
// 셀렉트샵 패턴 헤더 (분석 기반 자체 구현)
// 구조: 상단 슬림바(루프) → 좌측 로고 / 중앙 메뉴 / 우측 카트만 노출 (LOGIN/JOIN/MY/SEARCH/SHIP TO 제거됨 - 2026-08 리디자인)
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShopUi } from "@/contexts/ShopUiContext";
import { renderInlineFormat } from "@/lib/inlineFormat";

export default function Header() {
  const { totalItems } = useCart();
  const { t, language } = useLanguage();
  const { isInnerFrame, previewPage, previewSection, config: shopUi } = useShopUi();
  // 스포트라이트 · 현재 선택된 섹션만 밝음 · 나머지는 어둡게 (내가 만지지 않는 곳도 인지)
  const spotlightClass = (sec: "promoBar" | "header") => {
    if (!isInnerFrame || !previewSection) return "";
    return previewSection === sec ? "relative z-30 outline outline-4 outline-[var(--color-brand)] outline-offset-[-4px]" : "opacity-30";
  };
  const pathname = usePathname();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  // 관리자 미리보기 iframe · 「메인 상단」 편집 중이면 헤더 노출 (편집 대상)
  // 나머지 편집 대상 (상품 목록/상품 상세) 에서는 · 헤더 숨김 (상단 스크롤 최소화)
  if (isInnerFrame && previewPage !== "mainTop") return null;

  // 슬림바 메시지 · 한/일 이중 언어 · language에 따라 선택 · 편집은 관리자에서 한국어로 · 저장 시 일본어 자동 번역
  const configuredMsgs = (shopUi.mainTop?.promoBarMessages || [])
    .map((m) => (language === "ja" ? (m.ja || m.ko) : (m.ko || m.ja)))
    .filter((s) => s && s.trim().length > 0);
  const promoMsgs = configuredMsgs.length > 0
    ? configuredMsgs
    : language === "ja"
      ? ["2026 S/S NEW RELEASE", "2万円以上ご購入で送料無料", "2万円以上ご購入で通関保証無料"]
      : ["2026 S/S 신제품 출시", "2만엔 이상 구매 시 배송비 무료", "2만엔 이상 구매 시 통관보장 무료"];
  const promoBarEnabled = shopUi.mainTop?.promoBarEnabled !== false;

  // 메뉴 정의 + active 매처 (현재 URL/쿼리 기준) - 3개 메뉴 (SHOP/REVIEW/BRAND)
  // 리뷰 진입점: 헤더 REVIEW 메뉴 (2026-08 판석이형 피드백 반영)
  // 영문 브랜드 표기 정책: mainNav label은 브랜드 컨셉상 영문 고정 (i18n 미적용)
  const cat = sp?.get("cat") || "";
  const sort = sp?.get("sort") || "";
  const onMain = pathname === "/";
  const mainNav = [
    { label: "SHOP",   href: "/",         active: onMain },
    { label: "REVIEW", href: "/reviews",  active: pathname === "/reviews" },
    { label: "BRAND",  href: "/about",    active: pathname === "/about" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* ─── 상단 슬림바 (텍스트 무한 루프) · 사장님 설정에 따라 표시/숨김 ─── */}
      {promoBarEnabled && (
        <div data-section="promoBar" className={`bg-[var(--color-text)] text-white text-[11px] tracking-widest h-8 flex items-center overflow-hidden transition ${spotlightClass("promoBar")} ${isInnerFrame ? "cursor-pointer" : ""}`}>
          <div className="marquee-track">
            {Array.from({ length: 2 }).flatMap((_, dup) =>
              promoMsgs.map((m, i) => (
                <span key={`${dup}-${i}`} className="opacity-90">{m}</span>
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── 메인 헤더 ─── */}
      <div data-section="header" className={`border-b border-[var(--color-line)] transition ${spotlightClass("header")} ${isInnerFrame ? "cursor-pointer" : ""}`}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-16 lg:h-[72px] grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          {/* 좌: 로고 + 모바일 햄버거 */}
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(v => !v)} className="lg:hidden p-1.5 -ml-1.5" aria-label="menu">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-2xl lg:text-[28px] tracking-[0.05em] text-[var(--color-text)] leading-none">
                {renderInlineFormat(shopUi.mainTop.logo.brand || "CREAM")}
              </span>
              <span className="hidden sm:inline font-serif italic text-[10px] text-[var(--color-text-mute)] leading-none">
                {renderInlineFormat(language === "ja" ? (shopUi.mainTop.logo.tagline.ja || shopUi.mainTop.logo.tagline.ko) : (shopUi.mainTop.logo.tagline.ko || shopUi.mainTop.logo.tagline.ja))}
              </span>
            </Link>
          </div>

          {/* 중: 메인 메뉴 (PC) */}
          <nav className="hidden lg:flex items-center gap-8 text-[13px] tracking-[0.15em] text-[var(--color-text)]">
            {mainNav.map(n => (
              <Link
                key={n.label}
                href={n.href}
                className={`relative pb-1 transition ${
                  n.active
                    ? "text-[var(--color-text)] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-[var(--color-text)]"
                    : "text-[var(--color-text)] hover:text-[var(--color-point)]"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>

          {/* 우: 카트 */}
          <div className="flex items-center gap-3 lg:gap-4 justify-end text-[12px] text-[var(--color-text)]">
            <Link href="/cart" className="relative p-1.5 hover:text-[var(--color-point)]" aria-label={`${t("nav.cart")} (${totalItems})`}>
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 7h12l-1 13a2 2 0 01-2 2H9a2 2 0 01-2-2L6 7z" />
                <path d="M9 7V5a3 3 0 016 0v2" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 bg-[var(--color-text)] text-white text-[10px] min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center">
                {totalItems}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ─── 모바일 드로어 ─── */}
      {mobileOpen && (
        <div className="lg:hidden border-b border-[var(--color-line)] bg-white">
          <nav className="px-4 py-4 flex flex-col gap-3 text-sm">
            {mainNav.map(n => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setMobileOpen(false)}
                className={`py-1 tracking-[0.15em] ${n.active ? "font-medium text-[var(--color-text)]" : "text-[var(--color-text)]"}`}
              >
                {n.label}{n.active && <span className="ml-2 text-[var(--color-point)]">·</span>}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
