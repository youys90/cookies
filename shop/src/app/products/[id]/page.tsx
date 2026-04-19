"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";
import { useCart } from "@/contexts/CartContext";

interface Product {
  id: number;
  name: string;
  name_ja?: string;
  name_ko?: string;
  price: number;
  original_price?: number;
  image: string;
  images?: string[];
  category: string;
  category_ja?: string;
  category_ko?: string;
  sub_category?: string;
  description?: string;
  description_ja?: string;
  description_ko?: string;
  stock?: number;
}

interface ProductOption {
  id: number;
  product_id: number;
  option_name: string;
  additional_price: number;
  stock: number;
  is_active: boolean;
  sort_order: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnQuery = searchParams.get("return");
  const { language, t, formatPrice } = useLanguage();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchProduct(params.id as string);
      fetchOptions(params.id as string);
    }
  }, [params.id]);

  const fetchProduct = async (id: string) => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('상품 조회 실패:', error);
      setProduct(null);
    } else {
      // Premium 카테고리 상품은 비밀번호 인증 필요
      if (data?.category === '➡ Premium High-Quality ✨') {
        const staffAccess = sessionStorage.getItem('staff_access');
        if (staffAccess !== 'true') {
          // 권한 없으면 홈으로 리다이렉트
          router.push('/');
          return;
        }
      }
      setProduct(data);
    }
    setLoading(false);
  };

  const fetchOptions = async (id: string) => {
    const { data, error } = await supabase
      .from('product_options')
      .select('*')
      .eq('product_id', id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('옵션 조회 실패:', error);
      setOptions([]);
    } else {
      setOptions(data || []);
      if (data && data.length > 0) {
        setSelectedOption(data[0]);
      }
    }
  };

  const productImages = product?.images?.length ? product.images : (product?.image ? [product.image] : []);

  const productName = language === 'ko'
    ? (product?.name_ko || product?.name_ja || product?.name)
    : (product?.name_ja || product?.name_ko || product?.name);

  const productDescription = language === 'ko'
    ? (product?.description_ko || product?.description_ja || product?.description)
    : (product?.description_ja || product?.description_ko || product?.description);

  const productCategory = language === 'ko'
    ? (product?.category_ko || product?.category_ja || product?.category)
    : (product?.category_ja || product?.category_ko || product?.category);

  const discountPercent = product?.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  const finalPrice = product ? product.price + (selectedOption?.additional_price || 0) : 0;

  const handleAddToCart = () => {
    if (!product) return;
    if (options.length > 0 && !selectedOption) {
      alert(language === 'ko' ? '옵션을 선택해주세요.' : 'オプションを選択してください。');
      return;
    }
    addToCart({
      id: product.id,
      name: productName || '',
      price: product.price,
      image: productImages[0] || '/images/default.jpg',
      category: productCategory || '',
      optionId: selectedOption?.id,
      optionName: selectedOption?.option_name,
      additionalPrice: selectedOption?.additional_price || 0,
    }, quantity);
    alert(t('product.addedToCart'));
  };

  const prevImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
  }, [productImages.length]);

  const nextImage = useCallback(() => {
    setSelectedImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
  }, [productImages.length]);

  const openLightbox = () => setIsLightboxOpen(true);
  const closeLightbox = () => setIsLightboxOpen(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isLightboxOpen) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") prevImage();
      if (e.key === "ArrowRight") nextImage();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isLightboxOpen, prevImage, nextImage]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{t('common.loading')}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">{t('product.notFound')}</p>
        <Link href="/" className="text-gray-900 underline">
          {t('nav.home')}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => { if (returnQuery) { window.location.href = "/?"+returnQuery; } else { router.back(); } }} className="flex items-center text-gray-500 hover:text-gray-900 mb-6 text-sm">
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {t('common.back')}
      </button>

      <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
        <div className="space-y-4">
          <div className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden">
            {productImages.length > 0 ? (
              <>
                <button onClick={openLightbox} className="w-full h-full cursor-zoom-in">
                  <Image src={productImages[selectedImageIndex]} alt={productName || '상품 이미지'} fill className="object-cover" priority />
                </button>
                {productImages.length > 1 && (
                  <>
                    <button onClick={prevImage} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <button onClick={nextImage} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow-md">
                      <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-2">
                      {productImages.map((_, idx) => (
                        <button key={idx} onClick={() => setSelectedImageIndex(idx)} className={`w-2 h-2 rounded-full transition-all ${idx === selectedImageIndex ? 'bg-gray-900 w-4' : 'bg-gray-400'}`} />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
            )}
          </div>
          {productImages.length > 1 && (
            <div className="flex space-x-2 overflow-x-auto pb-2">
              {productImages.map((img, idx) => (
                <button key={idx} onClick={() => setSelectedImageIndex(idx)} className={`relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all ${idx === selectedImageIndex ? 'border-gray-900' : 'border-gray-200 hover:border-gray-400'}`}>
                  <Image src={img} alt={`썸네일 ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <p className="text-sm text-gray-500">{productCategory}</p>
          <h1 className="text-2xl md:text-3xl font-light text-gray-900">{productName}</h1>

          <div className="space-y-1">
            <div className="flex items-baseline space-x-3">
              <span className="text-2xl font-medium text-gray-900">{formatPrice(finalPrice)}</span>
              {selectedOption && selectedOption.additional_price > 0 && (
                <span className="text-sm text-gray-500">
                  ({language === 'ko' ? '기본' : '基本'} {formatPrice(product.price)} + {formatPrice(selectedOption.additional_price)})
                </span>
              )}
              {discountPercent > 0 && !selectedOption?.additional_price && (
                <>
                  <span className="text-lg text-gray-400 line-through">{formatPrice(product.original_price!)}</span>
                  <span className="text-sm text-red-500 font-medium">-{discountPercent}%</span>
                </>
              )}
            </div>
          </div>

          {product.stock !== null && product.stock !== undefined && (
            <p className={`text-sm ${product.stock > 0 ? 'text-green-600' : 'text-red-500'}`}>
              {product.stock > 0 ? (language === 'ko' ? `재고: ${product.stock}개` : `在庫: ${product.stock}個`) : (language === 'ko' ? '품절' : '売り切れ')}
            </p>
          )}

          <hr className="border-gray-200" />

          {options.length > 0 && (
            <div className="space-y-3">
              <span className="text-sm font-medium text-gray-700">COLOR</span>
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt)}
                    className={`px-4 py-2 text-sm rounded-lg border transition-all ${selectedOption?.id === opt.id ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-300 text-gray-700 hover:border-gray-500'}`}
                  >
                    {opt.option_name}
                    {opt.additional_price > 0 && <span className="ml-1 text-xs">(+{formatPrice(opt.additional_price)})</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {productDescription && (
            <div className="prose prose-sm max-w-none text-gray-600">
              <p className="whitespace-pre-wrap">{productDescription}</p>
            </div>
          )}

          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-700">{language === 'ko' ? '수량' : '数量'}</span>
            <div className="flex items-center border border-gray-200 rounded-lg">
              <button onClick={() => setQuantity((q) => Math.max(1, q - 1))} className="px-3 py-2 text-gray-600 hover:text-gray-900">-</button>
              <span className="px-4 py-2 text-gray-900 min-w-[40px] text-center">{quantity}</span>
              <button onClick={() => setQuantity((q) => q + 1)} className="px-3 py-2 text-gray-600 hover:text-gray-900">+</button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleAddToCart} disabled={product.stock === 0} className="flex-1 px-6 py-4 bg-gray-900 text-white text-sm tracking-wide rounded-lg hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed">
              {t('product.addToCart')}
            </button>
            <Link href="/cart" className="flex-1 px-6 py-4 border border-gray-900 text-gray-900 text-sm tracking-wide rounded-lg hover:bg-gray-50 text-center">
              {t('nav.cart')}
            </Link>
          </div>
        </div>
      </div>

      {isLightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 z-10 w-12 h-12 flex items-center justify-center text-white/80 hover:text-white">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          {productImages.length > 1 && <div className="absolute top-4 left-4 text-white/80 text-sm">{selectedImageIndex + 1} / {productImages.length}</div>}
          <div className="relative w-full h-full max-w-4xl max-h-[90vh] mx-4" onClick={(e) => e.stopPropagation()}>
            <Image src={productImages[selectedImageIndex]} alt={productName || '상품 이미지'} fill className="object-contain" sizes="100vw" priority />
          </div>
          {productImages.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); prevImage(); }} className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center text-white/80 hover:text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button onClick={(e) => { e.stopPropagation(); nextImage(); }} className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 items-center justify-center text-white/80 hover:text-white">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
