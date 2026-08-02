"use client";
// mignon 상품 상세 - 셀렉트샵 정밀 패턴 (자체 작성)
// 구조: breadcrumb → 좌측 이미지+좌우화살표+썸네일 / 우측 브랜드+상품명+가격+옵션+수량+TOTAL+액션3+이벤트 → 아코디언4
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
  images?: string[] | unknown;
  category: string;
  category_ja?: string;
  category_ko?: string;
  sub_category?: string;
  description?: string;
  description_ja?: string;
  description_ko?: string;
  created_at?: string;
}

interface ProductOption {
  id: number;
  product_id: number;
  option_name: string;
  additional_price: number;
  stock?: number;
  sort_order?: number;
  is_active?: boolean;
}

type AccordionKey = "info" | "size" | "ship" | "notice";

export default function ProductDetail() {
  const params = useParams();
  const { addToCart } = useCart();
  const router = useRouter();
  const { language, t, formatPrice } = useLanguage();
  const productId = Number(params.id);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);
  const [imgIdx, setImgIdx] = useState(0);
  const [openAcc, setOpenAcc] = useState<AccordionKey | null>("info");

  const getName = (p: Product) => (language === "ja" ? p.name_ja || p.name : p.name_ko || p.name);
  const getCategory = (p: Product) => (language === "ja" ? p.category_ja || p.category : p.category_ko || p.category);
  const getDescription = (p: Product) => (language === "ja" ? p.description_ja || p.description : p.description_ko || p.description);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("*").eq("id", productId).single();
      if (data) {
        // 특수 카테고리 상품 URL 직접 진입 차단
        // - products.category_id 로 categories 조회 → is_special 이면 세션 unlock 확인
        // - unlock 안 됐으면 홈으로 리다이렉트 (카테고리 클릭 시점에 암호창 뜨는 게 정상 흐름)
        const p = data as Product & { category_id?: number };
        if (p.category_id) {
          const { data: cat } = await supabase
            .from("categories")
            .select("id, is_special")
            .eq("id", p.category_id)
            .maybeSingle();
          if (cat?.is_special) {
            let unlocked = false;
            try {
              const r = await fetch(`/api/staff/session?categoryId=${cat.id}`, { cache: "no-store", credentials: "same-origin" });
              if (r.ok) {
                const j = await r.json().catch(() => ({ ok: false }));
                unlocked = !!j.ok;
              }
            } catch {
              unlocked = false;
            }
            if (!unlocked) {
              // 홈으로 되돌림 → 사장님이 원래 정책대로 카테고리 클릭 시 암호창 뜸
              router.replace(`/?cat=${encodeURIComponent(p.category || "")}`);
              return;
            }
          }
        }
        setProduct(p);
      }
      // 실제 product_options 연동 - 옵션 배열 조회
      const { data: opts } = await supabase
        .from("product_options")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      setOptions((opts as ProductOption[]) || []);
      setLoading(false);
    })();
  }, [productId, router]);

  const handleAddToCart = () => {
    if (!product) return;
    if (options.length > 0 && !selectedOption) {
      alert(language === "ja" ? "オプションを選択してください。" : "옵션을 선택해주세요.");
      return;
    }
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      optionId: selectedOption?.id,
      optionName: selectedOption?.option_name,
      additionalPrice: selectedOption?.additional_price || 0,
    }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // BUY NOW: 카트에 담고 즉시 주문 화면(/cart)으로 이동해 구매 흐름 시작
  const handleBuyNow = () => {
    if (!product) return;
    if (options.length > 0 && !selectedOption) {
      alert(language === "ja" ? "オプションを選択してください。" : "옵션을 선택해주세요.");
      return;
    }
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      category: product.category,
      optionId: selectedOption?.id,
      optionName: selectedOption?.option_name,
      additionalPrice: selectedOption?.additional_price || 0,
    }, quantity);
    router.push("/cart");
  };

  const toggleAcc = (k: AccordionKey) => setOpenAcc(openAcc === k ? null : k);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[12px] tracking-[0.25em] text-[var(--color-text-soft)]">LOADING...</p>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-[12px] tracking-[0.25em] text-[var(--color-text-soft)]">NOT FOUND</p>
      </div>
    );
  }

  const galleryImgs: string[] = (() => {
    const arr = Array.isArray(product.images) ? (product.images as string[]) : [];
    const filtered = arr.filter((u) => typeof u === "string" && u.length > 0);
    return filtered.length > 0 ? filtered : product.image ? [product.image] : [];
  })();
  const currentImg = galleryImgs[imgIdx] || product.image || "";

  const goPrev = () => setImgIdx((i) => (i - 1 + galleryImgs.length) % galleryImgs.length);
  const goNext = () => setImgIdx((i) => (i + 1) % galleryImgs.length);

  const isNew = product.created_at && Date.now() - new Date(product.created_at).getTime() < 14 * 24 * 60 * 60 * 1000;
  const onSale = !!product.original_price;

  // 상단 카테고리 경로: 언어 스위처에 맞춰 category_ko / category_ja 우선 사용
  const brandLabel = (getCategory(product) || "").toUpperCase();
  const displayName = (() => {
    const base = getName(product) || "";
    // 영문 우선 노출 (시안의 상품명 패턴 차용 - 자체 카피)
    return base;
  })();
  const subTitle = language === "ja" ? product.name_ko : product.name_ja;

  // 옵션이 있으면 옵션 추가금 반영, 없으면 상품 기본가
  const finalUnitPrice = product.price + (selectedOption?.additional_price || 0);
  const finalTotal = finalUnitPrice * quantity;

  const acc = {
    info:   language === "ja" ? "PRODUCT INFO"   : "PRODUCT INFO",
    size:   language === "ja" ? "SIZE GUIDE"     : "SIZE GUIDE",
    ship:   language === "ja" ? "SHIPPING INFO"  : "SHIPPING INFO",
    notice: language === "ja" ? "NOTICE"         : "NOTICE",
  };
  const accBody = {
    info:   getDescription(product) || (language === "ja" ? "詳細は近日中に更新されます。" : "상세 정보는 추후 업데이트됩니다."),
    size:   language === "ja" ? "サイズは商品により異なります。詳細は別途お問い合わせください。" : "사이즈는 상품에 따라 다릅니다. 자세한 문의는 별도로 부탁드립니다.",
    ship:   language === "ja" ? "8,000円以上のご注文で送料無料 / EMS国際配送対応 / 関税込み" : "8만원 이상 구매 시 무료배송 / EMS 국제배송 대응 / 관세 포함",
    notice: language === "ja" ? "ご注文後のキャンセル・交換はLINEでご連絡ください。" : "주문 후 취소·교환은 LINE으로 문의주세요.",
  } as Record<AccordionKey, string>;

  return (
    <div className="bg-white text-[var(--color-text)]">
      {/* breadcrumb */}
      <nav className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-6 pb-3">
        <ol className="flex items-center gap-2 text-[11px] tracking-[0.1em] text-[var(--color-text-mute)]">
          <li><Link href="/" className="hover:text-[var(--color-text)]">HOME</Link></li>
          <li>›</li>
          <li><Link href="/?cat=all" className="hover:text-[var(--color-text)] uppercase">{brandLabel}</Link></li>
          <li>›</li>
          <li className="text-[var(--color-text)] truncate max-w-[260px]">{displayName}</li>
        </ol>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pb-20">
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-8 lg:gap-14">
          {/* ─── 좌: 이미지 영역 ─── */}
          <div>
            <div className="relative aspect-square bg-[var(--color-bg-soft)] overflow-hidden">
              {currentImg && (
                <Image
                  src={currentImg}
                  alt={displayName}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 55vw"
                  priority
                />
              )}

              {/* 배지 */}
              {(onSale || isNew) && (
                <div className="absolute top-4 left-4 flex flex-col gap-1.5">
                  {isNew && <span className="bg-[var(--color-text)] text-white text-[10px] tracking-[0.25em] px-2.5 py-1">NEW</span>}
                  {onSale && <span className="bg-[var(--color-point)] text-white text-[10px] tracking-[0.25em] px-2.5 py-1">SALE</span>}
                </div>
              )}

              {/* 좌우 화살표 */}
              {galleryImgs.length > 1 && (
                <>
                  <button onClick={goPrev} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/85 backdrop-blur-sm flex items-center justify-center hover:bg-white transition" aria-label="prev">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M15 6l-6 6 6 6" /></svg>
                  </button>
                  <button onClick={goNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/85 backdrop-blur-sm flex items-center justify-center hover:bg-white transition" aria-label="next">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 6l6 6-6 6" /></svg>
                  </button>
                </>
              )}

              {/* 페이지 인디케이터 */}
              {galleryImgs.length > 1 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {galleryImgs.map((_, i) => (
                    <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIdx ? "bg-[var(--color-text)]" : "bg-white/70"}`} />
                  ))}
                </div>
              )}
            </div>

            {/* 상품명 라벨 (이미지 하단 중앙) */}
            <p className="text-center text-[11px] tracking-[0.25em] text-[var(--color-text-soft)] mt-3">{displayName}</p>

            {/* 썸네일 (3-5개) */}
            {galleryImgs.length > 1 && (
              <div className="mt-3 flex gap-2 justify-center">
                {galleryImgs.slice(0, 5).map((u, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`relative w-16 h-16 bg-[var(--color-bg-soft)] overflow-hidden border ${i === imgIdx ? "border-[var(--color-text)]" : "border-transparent hover:border-[var(--color-line)]"}`}
                  >
                    <Image src={u} alt={`thumb-${i}`} fill className="object-cover" sizes="80px" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ─── 우: 정보 영역 ─── */}
          <div className="flex flex-col">
            {/* 브랜드/카테고리 라벨 (상단 작은) */}
            <p className="text-[11px] tracking-[0.25em] text-[var(--color-text)] uppercase">{getCategory(product)}</p>
            <h1 className="text-[18px] lg:text-[20px] tracking-[0.05em] text-[var(--color-text)] mt-1 uppercase">{displayName}</h1>
            {subTitle && <p className="text-[12px] text-[var(--color-text-soft)] mt-1">{subTitle}</p>}

            {/* 가격 (두 줄: 정가 + 판매가) */}
            <div className="mt-5">
              {product.original_price && product.original_price !== product.price && (
                <p className="text-[15px] text-[var(--color-text-mute)] line-through leading-snug">{formatPrice(product.original_price)}</p>
              )}
              <p className="text-[20px] lg:text-[22px] font-medium text-[var(--color-text)] leading-snug">{formatPrice(product.price)}</p>
            </div>

            {/* 구분선 */}
            <div className="border-t border-[var(--color-line)] mt-6 mb-6" />

            {/* 옵션 (색상-사이즈) */}
            <div className="space-y-2.5">
              <p className="text-[11px] tracking-[0.2em] text-[var(--color-text-soft)]">
                {language === "ja" ? "色 · サイズ" : "색상 · 사이즈"}
              </p>
              <div className="relative">
                <select
                  value={selectedOption?.id ?? ""}
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    setSelectedOption(options.find((o) => o.id === id) || null);
                  }}
                  disabled={options.length === 0}
                  className="w-full h-11 px-3 pr-9 bg-white border border-[var(--color-line)] text-[12px] text-[var(--color-text)] focus:outline-none focus:border-[var(--color-text)] appearance-none cursor-pointer disabled:bg-[var(--color-bg-soft)] disabled:text-[var(--color-text-mute)] disabled:cursor-not-allowed"
                >
                  {options.length === 0 ? (
                    <option value="">
                      {language === "ja" ? "オプションなし (単一商品)" : "옵션 없음 (단일 상품)"}
                    </option>
                  ) : (
                    <>
                      <option value="">
                        {language === "ja" ? "- [必須] オプションを選択 -" : "- [필수] 옵션을 선택해 주세요 -"}
                      </option>
                      {options.map((opt) => {
                        const soldOut = typeof opt.stock === "number" && opt.stock <= 0;
                        return (
                          <option key={opt.id} value={opt.id} disabled={soldOut}>
                            {opt.option_name}
                            {opt.additional_price > 0 ? ` (+${formatPrice(opt.additional_price)})` : ""}
                            {soldOut ? (language === "ja" ? " · 品切れ" : " · 품절") : ""}
                          </option>
                        );
                      })}
                    </>
                  )}
                </select>
                <svg className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-soft)]" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M3 5l3 3 3-3" />
                </svg>
              </div>
            </div>

            {/* 수량 (옵션 선택 시 or 옵션 없는 상품이면 항상 노출) */}
            {(selectedOption || options.length === 0) && (
              <div className="mt-5 px-3 py-3 bg-[var(--color-bg-soft)] border border-[var(--color-line-soft)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-[var(--color-text-soft)]">
                      {selectedOption?.option_name || (language === "ja" ? "選択" : "선택")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="inline-flex items-center border border-[var(--color-line)] bg-white">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-8 h-8 hover:bg-[var(--color-bg-soft)]" aria-label="-">−</button>
                      <span className="w-10 text-center text-[12px]">{quantity}</span>
                      <button onClick={() => setQuantity(quantity + 1)} className="w-8 h-8 hover:bg-[var(--color-bg-soft)]" aria-label="+">+</button>
                    </div>
                    <span className="text-[13px] font-medium">{formatPrice(finalTotal)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* TOTAL PRICE */}
            <div className="flex items-center justify-between mt-7 pt-5 border-t border-[var(--color-line)]">
              <span className="text-[12px] tracking-[0.25em] text-[var(--color-text)]">TOTAL PRICE</span>
              <span className="text-[22px] font-medium text-[var(--color-text)]">
                {formatPrice(finalTotal)}
                <span className="ml-1 text-[12px] font-normal text-[var(--color-text-mute)]">
                  ({language === "ja" ? `${quantity}個` : `${quantity}개`})
                </span>
              </span>
            </div>

            {/* 액션 버튼 2개 */}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={handleAddToCart}
                className="h-12 border border-[var(--color-text)] bg-white text-[11px] tracking-[0.25em] hover:bg-[var(--color-bg-soft)] transition"
              >
                {added ? "ADDED" : "ADD TO SHOPPING"}
              </button>
              <button
                onClick={handleBuyNow}
                className="h-12 bg-[var(--color-text)] text-white text-[11px] tracking-[0.25em] hover:bg-black transition"
              >
                BUY NOW
              </button>
            </div>

            {/* 이벤트 안내 배너 */}
            <div className="mt-5 border border-[var(--color-line)] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] tracking-[0.2em] bg-[var(--color-bg-cream)] text-[var(--color-text)] px-2 py-0.5">EVENT</span>
                <p className="text-[12px] text-[var(--color-text-soft)]">
                  {language === "ja" ? "決済時の最大優待 10% 追加積立" : "결제 시 최대 혜택 10% 추가적립"}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[var(--color-text-mute)]">
                <button aria-label="prev event"><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3l-3 3 3 3" /></svg></button>
                <button aria-label="next event"><svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 3l3 3-3 3" /></svg></button>
              </div>
            </div>

            {/* SHIP TO 안내 */}
            <p className="mt-4 text-[11px] text-[var(--color-text-mute)]">
              <span className="tracking-[0.2em]">SHIP TO:</span> {language === "ja" ? "🇯🇵 JAPAN" : "🇰🇷 SOUTH KOREA"}
            </p>

            {/* 아코디언 4개 */}
            <div className="mt-7 border-t border-[var(--color-line)]">
              {(Object.keys(acc) as AccordionKey[]).map((k) => (
                <div key={k} className="border-b border-[var(--color-line)]">
                  <button
                    onClick={() => toggleAcc(k)}
                    className="w-full flex items-center justify-between py-4 text-left text-[12px] tracking-[0.2em]"
                  >
                    <span>{acc[k]}</span>
                    <span className="text-[var(--color-text-soft)]">{openAcc === k ? "−" : "+"}</span>
                  </button>
                  {openAcc === k && (
                    <div className="pb-5 text-[12px] text-[var(--color-text-soft)] leading-relaxed">
                      {accBody[k]}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
