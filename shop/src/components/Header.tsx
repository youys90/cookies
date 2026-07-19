"use client";
// 셀렉트샵 패턴 헤더 (분석 기반 자체 구현)
// 구조: 상단 슬림바(루프) → 좌측 로고 / 중앙·우측 메뉴 / 우측 검색·SHIP TO·로그인·카트
import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Header() {
  const { totalItems } = useCart();
  const { t, language } = useLanguage();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [shipOpen, setShipOpen] = useState(false);
  const [ship, setShip] = useState<"JP" | "KR" | "US">("JP");

  // 슬림바 메시지 (반복용 - 한 셋트를 2벌 렌더해서 무한 루프)
  const promoMsgs = language === "ja"
    ? ["2026 S/S NEW RELEASE", "8,000円以上のご注文で送料無料", "全国送料無料・関税込み", "新規会員10%OFFクーポン"]
    : ["2026 S/S NEW RELEASE", "8만원 이상 구매 시 무료배송", "전국 무료배송・관세포함", "신규 회원 10% OFF 쿠폰"];

  // 메뉴 정의 + active 매처 (현재 URL/쿼리 기준) - 4개로 단순화
  // 리뷰는 푸터 CUSTOMER 영역에서 노출 (/reviews 라우트 자체는 유지)
  const cat = sp?.get("cat") || "";
  const sort = sp?.get("sort") || "";
  const onMain = pathname === "/";
  const mainNav = [
    { label: "NEW",   href: "/?sort=new",   active: onMain && sort === "new" },
    { label: "SHOP",  href: "/",            active: onMain && !cat && !sort },
    { label: "BRAND", href: "/about",       active: pathname === "/about" },
    { label: "SALE",  href: "/?cat=sale",   active: onMain && cat === "sale" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* ─── 상단 슬림바 (텍스트 무한 루프) ─── */}
      <div className="bg-[var(--color-text)] text-white text-[11px] tracking-widest h-8 flex items-center overflow-hidden">
        <div className="marquee-track">
          {Array.from({ length: 2 }).flatMap((_, dup) =>
            promoMsgs.map((m, i) => (
              <span key={`${dup}-${i}`} className="opacity-90">{m}</span>
            ))
          )}
        </div>
      </div>

      {/* ─── 메인 헤더 ─── */}
      <div className="border-b border-[var(--color-line)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-16 lg:h-[72px] grid grid-cols-[1fr_auto_1fr] items-center gap-6">
          {/* 좌: 로고 + 모바일 햄버거 */}
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileOpen(v => !v)} className="lg:hidden p-1.5 -ml-1.5" aria-label="menu">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-baseline gap-2">
              <span className="font-serif text-2xl lg:text-[28px] tracking-[0.05em] text-[var(--color-text)] leading-none">mignon</span>
              <span className="hidden sm:inline font-serif italic text-[10px] text-[var(--color-text-mute)] leading-none">little happiness</span>
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

          {/* 우: 검색 / SHIP TO / 로그인·회원·마이 / 카트 */}
          <div className="flex items-center gap-3 lg:gap-4 justify-end text-[12px] text-[var(--color-text)]">
            <button aria-label="search" className="p-1.5 hover:text-[var(--color-point)]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" />
              </svg>
            </button>

            {/* SHIP TO */}
            <div className="hidden md:block relative">
              <button
                onClick={() => setShipOpen(v => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 border border-[var(--color-line)] rounded-sm tracking-widest hover:border-[var(--color-text)] transition"
                aria-label="ship to"
              >
                <span className="text-[10px] text-[var(--color-text-soft)]">SHIP TO</span>
                <span className="text-[11px]">{ship === "JP" ? "🇯🇵 JP" : ship === "KR" ? "🇰🇷 KR" : "🇺🇸 US"}</span>
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5l3 3 3-3" /></svg>
              </button>
              {shipOpen && (
                <ul className="absolute right-0 top-[110%] bg-white border border-[var(--color-line)] py-1 min-w-[140px] shadow-sm z-50">
                  {(["JP", "KR", "US"] as const).map(s => (
                    <li key={s}>
                      <button onClick={() => { setShip(s); setShipOpen(false); }} className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-[var(--color-bg-soft)]">
                        {s === "JP" ? "🇯🇵 Japan" : s === "KR" ? "🇰🇷 South Korea" : "🇺🇸 United States"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="hidden md:flex items-center gap-2 text-[var(--color-text-soft)]">
              <Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "LOGIN" : "LOGIN"}</Link>
              <span>·</span>
              <Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "JOIN" : "JOIN"}</Link>
              <span>·</span>
              <Link href="#" className="hover:text-[var(--color-text)]">{language === "ja" ? "MY" : "MY"}</Link>
            </div>

            <Link href="/cart" className="relative p-1.5 hover:text-[var(--color-point)]" aria-label={t("nav.cart")}>
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
            <div className="pt-3 mt-2 border-t border-[var(--color-line-soft)] flex gap-3 text-[12px] text-[var(--color-text-soft)]">
              <Link href="#">LOGIN</Link><span>·</span>
              <Link href="#">JOIN</Link><span>·</span>
              <Link href="#">MY PAGE</Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
