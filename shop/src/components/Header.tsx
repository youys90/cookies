"use client";

import Link from "next/link";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";

export default function Header() {
  const { totalItems } = useCart();
  const { t } = useLanguage();

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center">
            <span className="text-xl md:text-2xl font-medium tracking-wide text-gray-900">
              Cookies
            </span>
          </Link>

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
    </header>
  );
}
