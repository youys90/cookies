"use client";
// 메인 그리드용 상품 카드 - 셀렉트샵 미니멀, 가격 숨김 + 자물쇠 / 호버 시 두 번째 이미지 + 줌

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";

interface Product {
  id: number;
  name: string;
  name_ja?: string;
  name_ko?: string;
  price: number;
  original_price?: number;
  image: string;
  images?: string[] | unknown;
  category: string;
  category_ja?: string;
  category_ko?: string;
  description?: string;
  created_at?: string;
}

interface ProductCardProps {
  product: Product;
  returnQuery?: string;
}

export default function ProductCard({ product, returnQuery }: ProductCardProps) {
  const { language } = useLanguage();
  const [wished, setWished] = useState(false);

  const getProductName = () => (language === "ja" ? product.name_ja || product.name : product.name_ko || product.name);
  const getCategory = () => (language === "ja" ? product.category_ja || product.category : product.category_ko || product.category);

  const isNew = product.created_at ? Date.now() - new Date(product.created_at).getTime() < 14 * 24 * 60 * 60 * 1000 : false;
  const onSale = !!product.original_price;

  const productUrl = returnQuery
    ? "/product/" + product.id + "?return=" + encodeURIComponent(returnQuery)
    : "/product/" + product.id;

  const lockText = language === "ja" ? "価格はログイン後に表示" : "가격은 로그인 후 표시";

  // 호버 시 보일 두 번째 이미지 (images 배열에 1개 이상 있을 때)
  const imgArr = Array.isArray(product.images) ? (product.images as string[]) : [];
  const secondImg = imgArr.find((u) => u && u !== product.image);

  return (
    <Link href={productUrl} className="group block">
      <div className="relative aspect-square overflow-hidden bg-[var(--color-bg-soft)]">
        {/* 메인 이미지 */}
        <Image
          src={product.image}
          alt={getProductName()}
          fill
          className={`object-cover transition-all duration-500 ${secondImg ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"}`}
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {/* 호버 시 두 번째 이미지 (있을 때만) */}
        {secondImg && (
          <Image
            src={secondImg}
            alt={getProductName()}
            fill
            className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}

        {/* NEW / SALE 배지 (좌측 상단, 작고 각진) */}
        <div className="absolute top-3 left-3 flex flex-col gap-1">
          {isNew && (
            <span className="bg-[var(--color-text)] text-white text-[10px] tracking-[0.25em] px-2 py-0.5 leading-tight">NEW</span>
          )}
          {onSale && (
            <span className="bg-[var(--color-point)] text-white text-[10px] tracking-[0.25em] px-2 py-0.5 leading-tight">SALE</span>
          )}
        </div>

        {/* 위시 하트 (우측 상단, 호버 시 부각) */}
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setWished((w) => !w); }}
          className="absolute top-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-70 group-hover:opacity-100 transition"
          aria-label="wishlist"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill={wished ? "var(--color-point)" : "none"} stroke={wished ? "var(--color-point)" : "var(--color-text)"} strokeWidth="1.5">
            <path d="M12 21s-7-4-7-10a4 4 0 017-2 4 4 0 017 2c0 6-7 10-7 10z" />
          </svg>
        </button>

        {/* 자물쇠 (우측 하단) */}
        <div className="absolute bottom-2.5 right-2.5 w-8 h-8 bg-white/90 backdrop-blur-sm flex items-center justify-center">
          <svg className="w-4 h-4 text-[var(--color-text-soft)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="5" y="11" width="14" height="10" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
        </div>
      </div>

      {/* 상품 정보 */}
      <div className="mt-3 px-0.5 space-y-1">
        <p className="text-[10px] tracking-[0.2em] text-[var(--color-text-mute)] uppercase">{getCategory()}</p>
        <h3 className="text-[13px] text-[var(--color-text)] group-hover:text-[var(--color-point)] transition leading-snug line-clamp-2 min-h-[2.4em]">
          {getProductName()}
        </h3>
        <p className="text-[10px] text-[var(--color-text-mute)] italic tracking-[0.05em] pt-0.5">{lockText}</p>
      </div>
    </Link>
  );
}
