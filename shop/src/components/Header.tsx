"use client";
// 셀렉트샵 패턴 헤더 (분석 기반 자체 구현)
// 구조: 상단 슬림바(루프) → 좌측 로고 / 중앙 메뉴 / 우측 카트만 노출 (LOGIN/JOIN/MY/SEARCH/SHIP TO 제거됨 - 2026-08 리디자인)
// P-01 (2026-09-23) · 햄버거 완전 제거 · 모바일도 가로 nav 상시 노출 (sub-row) · 4개 메뉴 (SHOP · 실사진 · REVIEW · BRAND)
//   - 실사진 메뉴: 페이지 아직 미완 · href="#" + preventDefault + alert (한/일)
//   - 실사진 label만 이중언어 · SHOP/REVIEW/BRAND는 브랜드 컨셉상 영문 고정 유지
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShopUi } from "@/contexts/ShopUiContext";
import { renderInlineFormat } from "@/lib/inlineFormat";

export default function Header() {
  const { totalItems } = useCart();
  const { t, language } = useLanguage();
  const { isInnerFrame, previewPage, previewSection, config: shopUi } = useShopUi();

  // 관리자 미리보기 iframe · 스포트라이트 대상 세부 영역 강조 · 나머지 dim
  // - promoBar / header 두 섹션에 대해서만 · isInnerFrame + previewSection 있을 때만 적용
  const spotlight = (section: "promoBar" | "header") => {
    if (!isInnerFrame || !previewSection) return "";
    return previewSection === section ? "shop-section-selected" : "shop-section-dimmed";
  };
  const pathname = usePathname();

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

  // 메뉴 정의 + active 매처 (현재 URL/쿼리 기준) - 4개 메뉴 (SHOP · 실사진 · REVIEW · BRAND)
  // - 실사진 (P-01): 페이지 아직 없음 · href="#" · preventDefault + alert 「준비중」 안내
  //   · 사장님 판단 대기 · 완료 보고에서 3가지 옵션 명시 (준비중 alert / disabled 시각 / 페이지 완성 후 노출)
  //   · label 이중언어 (실사진 / 実写真) · 관리자 실사진 자료실과 표기 일관
  // - SHOP / REVIEW / BRAND · 브랜드 컨셉상 영문 고정 (i18n 미적용) · 기존 정책 유지
  const onMain = pathname === "/";
  const previewingMsg = language === "ja"
    ? "実写真ページは準備中です"
    : "실사진 페이지는 준비 중입니다";
  const mainNav: Array<{ label: string; href: string; active: boolean; preparing?: boolean }> = [
    { label: "SHOP",   href: "/",         active: onMain },
    { label: language === "ja" ? "実写真" : "실사진", href: "#", active: false, preparing: true },
    { label: "REVIEW", href: "/reviews",  active: pathname === "/reviews" },
    { label: "BRAND",  href: "/about",    active: pathname === "/about" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, preparing?: boolean) => {
    if (preparing) {
      e.preventDefault();
      alert(previewingMsg);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-white">
      {/* ─── 상단 슬림바 (텍스트 무한 루프) · 사장님 설정에 따라 표시/숨김 ─── */}
      {promoBarEnabled && (
        <div data-section="promoBar" className={`bg-[var(--color-text)] text-white text-[11px] tracking-widest h-8 flex items-center overflow-hidden ${spotlight("promoBar")}`}>
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
      <div data-section="header" className={`border-b border-[var(--color-line)] ${spotlight("header")}`}>
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 h-14 lg:h-[72px] grid grid-cols-[1fr_auto_1fr] items-center gap-4 lg:gap-6">
          {/* 좌: 로고 (P-01 · 햄버거 제거) */}
          <div className="flex items-center min-w-0">
            <Link href="/" className="flex items-baseline gap-2 min-w-0">
              <span className="font-serif text-2xl lg:text-[28px] tracking-[0.05em] text-[var(--color-text)] leading-none">
                {renderInlineFormat(shopUi.mainTop.logo.brand || "CREAM")}
              </span>
              <span className="hidden sm:inline font-serif italic text-[10px] text-[var(--color-text-mute)] leading-none truncate">
                {renderInlineFormat(language === "ja" ? (shopUi.mainTop.logo.tagline.ja || shopUi.mainTop.logo.tagline.ko) : (shopUi.mainTop.logo.tagline.ko || shopUi.mainTop.logo.tagline.ja))}
              </span>
            </Link>
          </div>

          {/* 중: 메인 메뉴 (PC · 기존 그대로 · 4개 메뉴) */}
          <nav className="hidden lg:flex items-center gap-8 text-[13px] tracking-[0.15em] text-[var(--color-text)]">
            {mainNav.map(n => (
              <Link
                key={n.label}
                href={n.href}
                onClick={(e) => handleNavClick(e, n.preparing)}
                aria-disabled={n.preparing || undefined}
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

        {/* ─── 모바일 sub-row · 4개 메뉴 상시 노출 (P-01) ───
            - lg:hidden · 320~430px 모두 한 줄 · 각 메뉴 균등
            - min-w-0 · flex-1 · text-center · 폰트 축소 (10~11px) · tracking-tight
            - 각 항목 아래 얇은 밑줄 (active) · 비활성 항목은 밑줄 없음
            - preparing (실사진) 은 opacity 낮춰서 「준비중」 시각 힌트 · 다만 클릭은 가능 (alert 뜸) */}
        <nav className="lg:hidden border-t border-[var(--color-line-soft)]">
          <div className="max-w-[1400px] mx-auto px-2 flex items-stretch">
            {mainNav.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={(e) => handleNavClick(e, n.preparing)}
                aria-disabled={n.preparing || undefined}
                className={`flex-1 min-w-0 text-center text-[11px] tracking-[0.12em] py-2.5 relative transition ${
                  n.active
                    ? "text-[var(--color-text)] after:absolute after:left-1/4 after:right-1/4 after:bottom-0 after:h-px after:bg-[var(--color-text)]"
                    : n.preparing
                      ? "text-[var(--color-text-mute)]"
                      : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
                }`}
              >
                <span className="truncate inline-block max-w-full align-middle">{n.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
