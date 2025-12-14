"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Header() {
  const { totalItems } = useCart();
  const { language, setLanguage, t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900"
            aria-label="メニュー"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>

          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl md:text-2xl font-medium tracking-wide text-gray-900">
              Cookies
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.home")}
            </Link>
            <Link href="/?category=ネックレス" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.necklace")}
            </Link>
            <Link href="/?category=ピアス" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.earrings")}
            </Link>
            <Link href="/?category=リング" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.rings")}
            </Link>
            <Link href="/?category=ブレスレット" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.bracelet")}
            </Link>
          </nav>

          {/* Right Icons */}
          <div className="flex items-center space-x-1 md:space-x-3">
            {/* Language Toggle - Slide Switch */}
            <div className="flex items-center bg-gray-100 rounded-full p-0.5">
              <button
                onClick={() => setLanguage("ja")}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-all ${
                  language === "ja"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                JP
              </button>
              <button
                onClick={() => setLanguage("ko")}
                className={`px-2 py-1 text-xs font-medium rounded-full transition-all ${
                  language === "ko"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                KR
              </button>
            </div>

            {/* Search */}
            <button className="p-3 text-gray-600 hover:text-gray-900" aria-label={t("nav.search")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Cart */}
            <Link href="/cart" className="p-3 text-gray-600 hover:text-gray-900 relative" aria-label={t("nav.cart")}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {totalItems > 0 && (
                <span className="absolute top-1 right-1 bg-black text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <nav className="px-4 py-3 space-y-1">
            <Link
              href="/"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-900 text-base font-medium"
            >
              {t("nav.home")}
            </Link>
            <Link
              href="/?category=ネックレス"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("nav.necklace")}
            </Link>
            <Link
              href="/?category=ピアス"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("nav.earrings")}
            </Link>
            <Link
              href="/?category=リング"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("nav.rings")}
            </Link>
            <Link
              href="/?category=ブレスレット"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("nav.bracelet")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}