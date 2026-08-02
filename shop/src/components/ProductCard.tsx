"use client";
// 기존 real 스타일로 복원 (사장님 요청):
// - 이미지 · 카테고리 · 상품명만 노출 (가격 숨김)
// - SALE 뱃지 유지
// - 라운드 코너 + 호버 스케일 효과 (real 브랜치 동일)

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
  const { language, t } = useLanguage();

  const getProductName = () =>
    language === "ja" ? product.name_ja || product.name : product.name_ko || product.name;

  const getCategory = () =>
    language === "ja" ? product.category_ja || product.category : product.category_ko || product.category;

  // 신 라우트(/product) 유지 · CREAM 리디자인 페이지로 연결
  const productUrl = returnQuery
    ? "/product/" + product.id + "?return=" + encodeURIComponent(returnQuery)
    : "/product/" + product.id;

  return (
    <Link href={productUrl} className="group">
      <div className="relative aspect-square overflow-hidden bg-gray-100 rounded-lg">
        <Image
          src={product.image}
          alt={getProductName()}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {product.original_price && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            {t("product.sale")}
          </span>
        )}
      </div>
      <div className="mt-3 md:mt-4 space-y-1 px-0.5">
        <p className="text-[11px] text-gray-400 tracking-wide">{getCategory()}</p>
        <h3 className="text-[13px] md:text-sm font-medium text-gray-900 group-hover:text-gray-600 line-clamp-2 min-h-[2.6em]">
          {getProductName()}
        </h3>
      </div>
    </Link>
  );
}
