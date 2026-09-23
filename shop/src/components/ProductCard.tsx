"use client";
// 기존 real 스타일로 복원 (사장님 요청):
// - 이미지 · 카테고리 · 상품명만 노출 (가격 숨김)
// - SALE 뱃지 유지
// - 라운드 코너 + 호버 스케일 효과 (real 브랜치 동일)
//
// P-02 (2026-09-24) · 상품카드 원가 취소선 overflow 수정 (320/360 mobile 2열)
// root cause: `<p>` 태그 안 판매가 + 원가 취소선 span 이 하나의 inline flow 로 이어져
//   `¥` + 5~6자리 숫자 텍스트가 각각 하나의 "단어"로 취급 · 카드 폭 (viewport 320 · 2열
//   · gap 32 · px-4 · 카드 폭 ~128px)을 판매가+ml-2+원가 합계가 초과할 때 wrap 되지 않아
//   부모 min-w-0(shop-product-grid) 를 넘어 컨테이너 밖으로 삐져나감.
// fix: `<p>` → `<div flex flex-wrap items-baseline>` · 판매가/원가 span 을 개별 아이템으로
//   → 카드 폭 초과 시 원가가 자연스럽게 다음 줄로 wrap (두 줄 표시).
//   body/html overflow-x:hidden 은폐 X · 원인 지점 직접 수정.
//   원가·취소선·할인표시 정보 삭제 X · 기존 노출 정보 100% 유지 (표시 형태만 flex-wrap).

import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useShopUi } from "@/contexts/ShopUiContext";

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
  const { config } = useShopUi();
  const showName = config.productList.showName;
  const showPrice = config.productList.showPrice;
  const showCategory = config.productList.showCategory;
  const aspectClass = config.productList.imageAspect === "portrait"
    ? "aspect-[4/5]"
    : config.productList.imageAspect === "landscape"
      ? "aspect-[4/3]"
      : "aspect-square";
  const radiusStyle = { borderRadius: `${config.productList.imageBorderRadius}px` };

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
      <div className={`relative ${aspectClass} overflow-hidden bg-gray-50 flex items-center justify-center`} style={radiusStyle}>
        <Image
          src={product.image}
          alt={getProductName()}
          fill
          className="object-contain group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 50vw, 25vw"
        />
        {product.original_price && (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
            {t("product.sale")}
          </span>
        )}
      </div>
      {(showCategory || showName || showPrice) && (
        <div className="mt-3 md:mt-4 px-0.5 space-y-1 min-w-0">
          {showCategory && (
            <p className="text-[11px] text-gray-500 tracking-widest uppercase truncate">{getCategory()}</p>
          )}
          {showName && (
            <h3 className="text-[13px] md:text-sm font-medium text-gray-900 group-hover:text-gray-600 line-clamp-2 min-h-[2.6em]">
              {getProductName()}
            </h3>
          )}
          {showPrice && (
            // P-02 fix: <p> → flex flex-wrap items-baseline · 판매가/원가 span 이 카드 폭 초과 시
            // 자연스럽게 두 줄로 wrap · body/html overflow-x:hidden 은폐 없이 root cause 수정.
            <div className="text-sm font-semibold text-gray-900 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
              <span className="tabular-nums">
                ¥{Number(product.price).toLocaleString("ja-JP")}
              </span>
              {product.original_price && (
                <span className="text-xs text-gray-400 line-through tabular-nums">
                  ¥{Number(product.original_price).toLocaleString("ja-JP")}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
