"use client";

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
  category: string;
  category_ja?: string;
  category_ko?: string;
  description?: string;
}

interface ProductCardProps {
  product: Product;
  returnQuery?: string;
}

export default function ProductCard({ product, returnQuery }: ProductCardProps) {
  const { language, formatPrice, t } = useLanguage();

  const getProductName = () => {
    if (language === "ja") {
      return product.name_ja || product.name;
    }
    return product.name_ko || product.name;
  };

  const getCategory = () => {
    if (language === "ja") {
      return product.category_ja || product.category;
    }
    return product.category_ko || product.category;
  };

  const productUrl = returnQuery
    ? "/products/" + product.id + "?return=" + encodeURIComponent(returnQuery)
    : "/products/" + product.id;

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
      <div className="mt-4 space-y-1">
        <p className="text-xs text-gray-400 tracking-wide">{getCategory()}</p>
        <h3 className="text-sm font-medium text-gray-900 group-hover:text-gray-600">
          {getProductName()}
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-900">
            {formatPrice(product.price)}
          </span>
          {product.original_price && (
            <span className="text-xs text-gray-400 line-through">
              {formatPrice(product.original_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
