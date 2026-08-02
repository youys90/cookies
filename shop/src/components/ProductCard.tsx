"use client";
// 상품 카드 — 판석이형/YYS 피드백 반영:
// - 하트/자물쇠 아이콘 제거
// - 목록에선 상품명 숨김 (상세 진입해야 확인)
// - 이미지만 크게 노출 (미니멀)

import Link from "next/link";
import Image from "next/image";
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

  const getProductName = () => (language === "ja" ? product.name_ja || product.name : product.name_ko || product.name);

  const isNew = product.created_at ? Date.now() - new Date(product.created_at).getTime() < 14 * 24 * 60 * 60 * 1000 : false;
  const onSale = !!product.original_price;

  const productUrl = returnQuery
    ? "/product/" + product.id + "?return=" + encodeURIComponent(returnQuery)
    : "/product/" + product.id;

  const imgArr = Array.isArray(product.images) ? (product.images as string[]) : [];
  const secondImg = imgArr.find((u) => u && u !== product.image);

  return (
    <Link href={productUrl} className="group block" aria-label={getProductName()}>
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <Image
          src={product.image}
          alt={getProductName()}
          fill
          className={`object-cover transition-all duration-500 ${secondImg ? "group-hover:opacity-0" : "group-hover:scale-[1.04]"}`}
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {secondImg && (
          <Image
            src={secondImg}
            alt={getProductName()}
            fill
            className="object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        )}

        {/* NEW / SALE 배지만 유지 */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
          {isNew && (
            <span className="bg-black text-white text-[10px] tracking-[0.25em] px-2 py-0.5 leading-tight">NEW</span>
          )}
          {onSale && (
            <span className="bg-red-500 text-white text-[10px] tracking-[0.25em] px-2 py-0.5 leading-tight">SALE</span>
          )}
        </div>
      </div>
      {/* 상품명·가격·카테고리 텍스트 완전 제거 (상세 진입해야 확인) */}
    </Link>
  );
}
