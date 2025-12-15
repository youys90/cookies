"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Header() {
  const { totalItems } = useCart();
  const { t } = useLanguage();
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
          <nav className="hidden md:flex space-x-6">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("nav.home")}
            </Link>
            <Link href="/?category=accessory" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("category.accessory")}
            </Link>
            <Link href="/?category=hair" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("category.hair")}
            </Link>
            <Link href="/?category=winter" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("category.winter")}
            </Link>
            <Link href="/?category=keyring" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("category.keyring")}
            </Link>
            <Link href="/?category=fashion" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              {t("category.fashion")}
            </Link>
          </nav>

          {/* Right Icons */}
          <div className="flex items-center space-x-1 md:space-x-3">
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
              href="/?category=accessory"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.accessory")}
            </Link>
            <Link
              href="/?category=hair"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.hair")}
            </Link>
            <Link
              href="/?category=winter"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.winter")}
            </Link>
            <Link
              href="/?category=keyring"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.keyring")}
            </Link>
            <Link
              href="/?category=eyewear"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.eyewear")}
            </Link>
            <Link
              href="/?category=fashion"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.fashion")}
            </Link>
            <Link
              href="/?category=etc"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              {t("category.etc")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}