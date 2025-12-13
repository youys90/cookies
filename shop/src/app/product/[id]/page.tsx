"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/contexts/CartContext";

interface Product {
  id: number;
  name: string;
  name_en?: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  description?: string;
}

export default function ProductDetail() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

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

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
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
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">상품을 찾을 수 없습니다.</p>
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
          <li><Link href={`/?category=${product.category}`} className="hover:text-gray-600">{product.category}</Link></li>
          <li>/</li>
          <li className="text-gray-900">{product.name}</li>
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
          <p className="text-sm text-gray-400 tracking-wide mb-2">{product.category}</p>
          <h1 className="text-2xl font-light text-gray-900 mb-2">{product.name}</h1>
          {product.name_en && (
            <p className="text-sm text-gray-500 mb-6">{product.name_en}</p>
          )}

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
          {product.description && (
            <p className="text-gray-600 mb-8">{product.description}</p>
          )}

          {/* Quantity */}
          <div className="flex items-center space-x-4 mb-6">
            <span className="text-sm text-gray-600">수량</span>
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
              {added ? "담기 완료!" : "장바구니 담기"}
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
              <span>5만원 이상 무료배송 | 평일 오후 2시 이전 주문 시 당일 발송</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
