"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/contexts/CartContext";

export default function Header() {
  const { totalItems } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 md:h-16">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900"
            aria-label="메뉴"
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
              HOME
            </Link>
            <Link href="/?category=목걸이" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              NECKLACE
            </Link>
            <Link href="/?category=귀걸이" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              EARRINGS
            </Link>
            <Link href="/?category=반지" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              RINGS
            </Link>
            <Link href="/?category=팔찌" className="text-gray-600 hover:text-gray-900 text-sm tracking-wide">
              BRACELET
            </Link>
          </nav>

          {/* Right Icons */}
          <div className="flex items-center space-x-1 md:space-x-3">
            {/* Search */}
            <button className="p-3 text-gray-600 hover:text-gray-900" aria-label="검색">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Cart */}
            <Link href="/cart" className="p-3 text-gray-600 hover:text-gray-900 relative" aria-label="장바구니">
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
              HOME
            </Link>
            <Link
              href="/?category=목걸이"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              목걸이
            </Link>
            <Link
              href="/?category=귀걸이"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              귀걸이
            </Link>
            <Link
              href="/?category=반지"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              반지
            </Link>
            <Link
              href="/?category=팔찌"
              onClick={() => setMobileMenuOpen(false)}
              className="block py-3 text-gray-600 text-base border-t border-gray-50"
            >
              팔찌
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
