"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/contexts/CartContext";
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
  description_ja?: string;
  description_ko?: string;
}

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const { language, t, formatPrice } = useLanguage();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  // 언어별 상품 정보 가져오기
  const getProductName = (p: Product) => {
    if (language === "ja") return p.name_ja || p.name;
    return p.name_ko || p.name;
  };

  const getProductCategory = (p: Product) => {
    if (language === "ja") return p.category_ja || p.category;
    return p.category_ko || p.category;
  };

  const getProductDescription = (p: Product) => {
    if (language === "ja") return p.description_ja || p.description;
    return p.description_ko || p.description;
  };

  useEffect(() => {
    fetchProduct();
  }, [productId]);

  const fetchProduct = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();

    if (error) {
      console.error('상품 조회 실패:', error);
    } else {
      setProduct(data);
    }
    setLoading(false);
  };

  const handleAddToCart = () => {
    if (product) {
      addToCart({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        category: product.category,
      }, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t("common.loading")}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t("product.notFound")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Breadcrumb */}
      <nav className="text-sm mb-8">
        <ol className="flex items-center space-x-2 text-gray-400">
          <li><Link href="/" className="hover:text-gray-600">Home</Link></li>
          <li>/</li>
          <li><Link href={`/?category=${product.category}`} className="hover:text-gray-600">{getProductCategory(product)}</Link></li>
          <li>/</li>
          <li className="text-gray-900">{getProductName(product)}</li>
        </ol>
      </nav>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Product Image */}
        <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 50vw"
            priority
          />
          {product.original_price && (
            <span className="absolute top-4 left-4 bg-red-500 text-white text-sm px-3 py-1 rounded">
              SALE
            </span>
          )}
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <p className="text-sm text-gray-400 tracking-wide mb-2">{getProductCategory(product)}</p>
          <h1 className="text-2xl font-light text-gray-900 mb-6">{getProductName(product)}</h1>

          {/* Price */}
          <div className="flex items-center space-x-3 mb-6">
            <span className="text-2xl font-medium text-gray-900">
              {formatPrice(product.price)}
            </span>
            {product.original_price && (
              <span className="text-lg text-gray-400 line-through">
                {formatPrice(product.original_price)}
              </span>
            )}
          </div>

          {/* Description */}
          {getProductDescription(product) && (
            <p className="text-gray-600 mb-8">{getProductDescription(product)}</p>
          )}

          {/* Quantity */}
          <div className="flex items-center space-x-4 mb-6">
            <span className="text-sm text-gray-600">{t("product.quantity")}</span>
            <div className="flex items-center border border-gray-200 rounded">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3 py-2 text-gray-600 hover:bg-gray-50"
              >
                -
              </button>
              <span className="px-4 py-2 text-sm">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3 py-2 text-gray-600 hover:bg-gray-50"
              >
                +
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={handleAddToCart}
              className={`flex-1 py-4 text-sm tracking-wide transition-colors min-h-[50px] rounded-lg ${
                added
                  ? "bg-green-600 text-white"
                  : "bg-gray-900 text-white hover:bg-gray-800"
              }`}
            >
              {added ? t("product.addedToCart") : t("product.addToCart")}
            </button>
            <button className="px-6 py-4 border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          </div>

          {/* Delivery Info */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3 text-sm text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <span>{t("product.deliveryInfo")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
