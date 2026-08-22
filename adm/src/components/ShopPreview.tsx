"use client";

// 매장 화면 관리 · 실시간 인라인 미리보기
// - shop 실제 화면을 그대로 옮겨오지 않고 · config 값이 적용된 축소판을 즉시 렌더
// - 상품 목록 (카테고리 탭 + 상품 그리드) / 상품 상세 (사진 + 썸네일) 두 화면만
// - 사장님이 슬라이더 움직이는 즉시 눈에 보이게

import { useMemo } from "react";
import Image from "next/image";
import type { ShopUiConfig } from "@/lib/shopUiSchema";

interface Props {
  config: ShopUiConfig;
  device: "desktop" | "mobile";
  page: "list" | "detail";
}

// 가짜 상품 · 미리보기 전용 · 실제 DB 조회 없음
const MOCK_PRODUCTS = [
  { id: 1, name: "골드 체인 목걸이", price: 12800, category: "액세서리", img: "https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=400" },
  { id: 2, name: "실버 이어링", price: 8500, category: "액세서리", img: "https://images.unsplash.com/photo-1611652022419-a9419f74343d?w=400" },
  { id: 3, name: "레더 미니 백", price: 45000, category: "패션잡화", img: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400" },
  { id: 4, name: "울 니트 스카프", price: 22000, category: "겨울상품", img: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=400" },
  { id: 5, name: "실크 헤어밴드", price: 6800, category: "헤어", img: "https://images.unsplash.com/photo-1596704017254-9b121068fb31?w=400" },
  { id: 6, name: "가죽 키링", price: 4200, category: "키링", img: "https://images.unsplash.com/photo-1607779097040-26e80aa4576b?w=400" },
  { id: 7, name: "블라우스", price: 38000, category: "의류", img: "https://images.unsplash.com/photo-1554568218-0f1715e72254?w=400" },
  { id: 8, name: "선글라스", price: 32000, category: "안경/선글라스", img: "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=400" },
];

const MOCK_CATEGORIES = ["전체", "액세서리", "헤어", "겨울상품", "키링", "안경/선글라스", "패션잡화", "기타", "Premium", "의류"];

export default function ShopPreview({ config, device, page }: Props) {
  const isMobile = device === "mobile";

  return (
    <div
      className={`bg-white rounded-xl shadow-lg overflow-hidden mx-auto transition-all ${isMobile ? "w-[390px]" : "w-full max-w-[860px]"}`}
      style={{ height: "calc(100vh - 320px)", minHeight: "560px" }}
    >
      {/* 브라우저 프레임 */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <div className="ml-2 flex-1 text-[10px] text-gray-500 truncate">
          {page === "list" ? "cookiesshop.vercel.app" : "cookiesshop.vercel.app/product/1"}
        </div>
        <div className="text-[9px] text-gray-400">{isMobile ? "📱 390px" : "🖥 PC"}</div>
      </div>

      {/* 콘텐츠 · 스크롤 */}
      <div className="overflow-y-auto h-full pb-16">
        {page === "list" ? (
          <ListView config={config} isMobile={isMobile} />
        ) : (
          <DetailView config={config} isMobile={isMobile} />
        )}
      </div>
    </div>
  );
}

// ── 상품 목록 미리보기 ─────────────────────────
function ListView({ config, isMobile }: { config: ShopUiConfig; isMobile: boolean }) {
  const cols = isMobile ? config.categoryTabs.columnsMobile : config.categoryTabs.columnsDesktop;
  const prodCols = isMobile ? config.productList.columnsMobile : config.productList.columnsDesktop;

  const shownProducts = useMemo(() => {
    // 최소 prodCols * 3 만큼 채워서 스크롤도 되게
    const need = Math.max(prodCols * 3, MOCK_PRODUCTS.length);
    const arr: typeof MOCK_PRODUCTS = [];
    for (let i = 0; i < need; i++) arr.push(MOCK_PRODUCTS[i % MOCK_PRODUCTS.length]);
    return arr;
  }, [prodCols]);

  return (
    <>
      {/* 로고 · 간이 */}
      <div className="text-center py-3 border-b border-gray-100">
        <p className="font-serif tracking-widest text-lg">CREAM</p>
      </div>

      {/* 카테고리 탭 */}
      <div className="px-3 py-4 border-b border-gray-100">
        <div className="grid gap-y-3 gap-x-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {MOCK_CATEGORIES.slice(0, cols * config.categoryTabs.maxRows).map((c, i) => (
            <button
              key={i}
              className={`text-[10px] tracking-wider py-1 ${i === 0 ? "font-semibold text-gray-900" : "text-gray-500"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 상품 그리드 · 실제 shop 배치와 동일 · 페이지 개수는 그리드 위 우측 */}
      <div className="p-3">
        {/* 페이지 개수 · 실제 shop과 같은 위치 (그리드 상단 오른쪽) */}
        <div className="flex justify-end items-center gap-1 mb-3 text-[9px] text-gray-400">
          <span className="mr-1">VIEW</span>
          {config.pagination.options.map((v, i) => (
            <span key={v} className="flex items-center">
              <span className={v === config.pagination.default ? "text-gray-900 underline underline-offset-2 font-semibold" : ""}>{v}</span>
              {i < config.pagination.options.length - 1 && <span className="mx-1 text-gray-300">|</span>}
            </span>
          ))}
        </div>

        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${prodCols}, minmax(0, 1fr))`,
            gap: `${config.productList.gap * 0.5}px`, // 축소판이라 절반
          }}
        >
          {shownProducts.slice(0, prodCols * 4).map((p, i) => (
            <div key={i}>
              <div
                className="relative bg-gray-50 overflow-hidden flex items-center justify-center"
                style={{
                  aspectRatio: config.productList.imageAspect === "portrait" ? "4/5" : config.productList.imageAspect === "landscape" ? "4/3" : "1/1",
                  borderRadius: `${config.productList.imageBorderRadius}px`,
                }}
              >
                <Image src={p.img} alt="" fill unoptimized className="object-contain" />
              </div>
              {(config.productList.showName || config.productList.showPrice || config.productList.showCategory) && (
                <div className="mt-1.5 space-y-0.5">
                  {config.productList.showCategory && (
                    <p className="text-[8px] text-gray-400 uppercase tracking-widest truncate">{p.category}</p>
                  )}
                  {config.productList.showName && (
                    <p className="text-[10px] text-gray-800 line-clamp-2 leading-tight">{p.name}</p>
                  )}
                  {config.productList.showPrice && (
                    <p className="text-[10px] font-semibold text-gray-900">¥{p.price.toLocaleString()}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 페이지 네비게이션 · 실제 shop 하단 페이지 이동과 매칭 */}
        <div className="flex justify-center items-center gap-2 mt-4 text-[9px] text-gray-400 tracking-widest">
          <span>&lt; PREV</span>
          <span className="text-gray-900 font-semibold">1</span>
          <span>2</span>
          <span>3</span>
          <span>NEXT &gt;</span>
        </div>

      </div>
    </>
  );
}

// ── 상품 상세 미리보기 ─────────────────────────
function DetailView({ config, isMobile }: { config: ShopUiConfig; isMobile: boolean }) {
  const detail = config.productDetail;
  // 설정한 그대로 · N열 × N줄 만큼 노출 (샘플용으로 이미지 순환)
  const totalThumbs = Math.max(1, detail.thumbColumns * detail.thumbMaxRows);
  const thumbs = Array.from({ length: totalThumbs }, (_, i) => MOCK_PRODUCTS[i % MOCK_PRODUCTS.length]);
  const mainImg = MOCK_PRODUCTS[0].img;

  return (
    <div className={`${isMobile ? "px-4" : "px-8"} py-4`}>
      <p className="text-[10px] text-gray-400 mb-2">SHOP &nbsp;/&nbsp; 상품 상세</p>

      <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-[1.15fr_1fr]"} gap-6`}>
        {/* 좌 · 사진 영역 */}
        <div>
          <div className="relative aspect-square bg-gray-100 overflow-hidden rounded">
            <Image src={mainImg} alt="" fill unoptimized className="object-cover" />
          </div>
          <p className="text-center text-[10px] tracking-widest text-gray-400 mt-2">CLASSIC CHAIN NECKLACE</p>

          {/* 썸네일 · 사장님 설정 반영 */}
          <div
            className="mt-3 grid mx-auto"
            style={{
              gridTemplateColumns: `repeat(${detail.thumbColumns}, ${detail.thumbSize * 0.7}px)`,
              gap: `${detail.thumbGap}px`,
              justifyContent: "center",
            }}
          >
            {thumbs.map((t, i) => (
              <div
                key={i}
                className={`relative bg-gray-100 overflow-hidden border ${i === 0 ? "border-gray-900" : "border-transparent"}`}
                style={{ width: `${detail.thumbSize * 0.7}px`, height: `${detail.thumbSize * 0.7}px` }}
              >
                <Image src={t.img} alt="" fill unoptimized className="object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* 우 · 정보 */}
        <div className="space-y-3">
          {detail.showBrandCategory && (
            <p className="text-[10px] tracking-widest text-gray-500 uppercase">액세서리 · 목걸이</p>
          )}
          <h1 className="text-base font-medium tracking-wide">CLASSIC CHAIN NECKLACE</h1>
          <p className="text-[11px] text-gray-400 line-through">¥15,000</p>
          <p className="text-lg font-medium">¥12,800</p>
          <div className="border-t border-gray-200 pt-3 space-y-2">
            <p className="text-[10px] tracking-wider text-gray-500">색상 · 사이즈</p>
            <div className="px-2 py-1.5 text-xs border border-gray-200 rounded">━ 옵션 선택 ━</div>
          </div>
          <button className="w-full py-2.5 bg-gray-900 text-white text-xs tracking-widest">CART에 담기</button>
          {detail.showDescription ? (
            <div className="text-[10px] text-gray-500 leading-relaxed border-t border-gray-100 pt-3">
              심플하고 고급스러운 골드 체인 목걸이. 데일리로 착용 가능한 얇은 두께와 안정감 있는 걸림. 자연스러운 광택이 어떤 스타일에도 잘 어울립니다.
            </div>
          ) : (
            <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-3 flex items-center justify-between">
              <span>▸ 상품 설명</span>
              <span className="text-gray-300">클릭 시 펼침</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
