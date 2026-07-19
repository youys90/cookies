"use client";
// mignon 메인 - 셀렉트샵 미니멀 패턴 (자체 작성)
// 구조: 짧은 히어로 → 카테고리 8개 슬림 → NEW ARRIVAL 그리드 → BEST 그리드 → ALL PRODUCTS(쿠키즈 검색/필터/페이지네이션 유지)
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import StaffPasswordModal from "@/components/StaffPasswordModal";
import { supabase } from "@/lib/supabase";
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
  sub_category?: string;
  description?: string;
  created_at?: string;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100]; // 5의 배수 (5컬럼 그리드)

// ── mignon 카테고리 8개 ──
type MignonCat = {
  key: string;
  labelJp: string;
  labelEn: string;
  icon: string;
  dbCategory: string;
  subFilter: string[];
  saleOnly?: boolean;
};
const MIGNON_CATEGORIES: MignonCat[] = [
  { key: "acc",        labelJp: "アクセサリー",     labelEn: "ACC",        icon: "ring",     dbCategory: "アクセサリー",     subFilter: ["ピアス","リング","ブレスレット"] },
  { key: "bag",        labelJp: "バッグ",            labelEn: "BAG",        icon: "bag",      dbCategory: "ファッション雑貨", subFilter: ["ミニバッグ"] },
  { key: "jewelry",    labelJp: "ジュエリー",        labelEn: "JEWELRY",    icon: "necklace", dbCategory: "アクセサリー",     subFilter: ["ネックレス"] },
  { key: "hair",       labelJp: "ヘアアクセサリー",  labelEn: "HAIR ACC",   icon: "ribbon",   dbCategory: "ヘアアクセサリー", subFilter: [] },
  { key: "lifestyle",  labelJp: "ライフスタイル",    labelEn: "LIFESTYLE",  icon: "cup",      dbCategory: "ファッション雑貨", subFilter: ["ポーチ","靴下","キャップ","財布"] },
  { key: "interior",   labelJp: "インテリア",        labelEn: "INTERIOR",   icon: "lamp",     dbCategory: "その他（ETC）",   subFilter: [] },
  { key: "stationery", labelJp: "ステーショナリー",  labelEn: "STATIONERY", icon: "note",     dbCategory: "その他（ETC）",   subFilter: [] },
  { key: "sale",       labelJp: "SALE",              labelEn: "SALE",       icon: "heart",    dbCategory: "",                 subFilter: [], saleOnly: true },
];

function CategoryIcon({ name }: { name: string }) {
  const c = "w-7 h-7 md:w-8 md:h-8 stroke-[var(--color-text)]";
  switch (name) {
    case "ring":     return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><circle cx="24" cy="30" r="9" /><path d="M16 22l4-7h8l4 7" /><path d="M22 14l2 2 2-2" /></svg>);
    case "bag":      return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M13 17h22l-2 21H15L13 17z" /><path d="M19 17v-2a5 5 0 0110 0v2" /></svg>);
    case "necklace": return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M11 13c4 12 13 19 13 19s9-7 13-19" /><path d="M24 32l-2.5 4h5l-2.5-4z" /></svg>);
    case "ribbon":   return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M18 18c-4-4-10-2-10 4s6 8 10 4c-4 4-2 10 4 10s8-6 4-10c4 4 10 2 10-4s-6-8-10-4c4-4 2-10-4-10s-8 6-4 10z" /><circle cx="24" cy="24" r="2" /></svg>);
    case "cup":      return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M14 18h18v14a5 5 0 01-5 5h-8a5 5 0 01-5-5V18z" /><path d="M32 22h3a4 4 0 010 8h-3" /></svg>);
    case "lamp":     return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M17 18l3-7h8l3 7" /><path d="M17 18l2 9h10l2-9" /><path d="M24 27v9M18 36h12" /></svg>);
    case "note":     return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><rect x="13" y="11" width="22" height="26" rx="1.5" /><path d="M17 17h14M17 22h14M17 27h10" /></svg>);
    case "heart":    return (<svg className={c} viewBox="0 0 48 48" fill="none" strokeWidth="1.3"><path d="M24 36s-11-6-11-15a6 6 0 0111-3 6 6 0 0111 3c0 9-11 15-11 15z" /></svg>);
    default: return null;
  }
}

export default function Home() {
  const { language, t } = useLanguage();
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [heroItems, setHeroItems] = useState<Product[]>([]); // 히어로 모자이크 3장용
  const [selectedMignonCat, setSelectedMignonCat] = useState<string>(searchParams.get("cat") || "all");
  const [loading, setLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size")) || 25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  useEffect(() => {
    const staffAccess = sessionStorage.getItem("staff_access");
    if (staffAccess === "true") setHasStaffAccess(true);
    if (searchParams.get("staff") === "1" && staffAccess !== "true") setShowStaffModal(true);
    fetchHero();
  }, []);

  useEffect(() => {
    const page = Number(searchParams.get("page")) || 1;
    const size = Number(searchParams.get("size")) || 25;
    const cat = searchParams.get("cat") || "all";
    const search = searchParams.get("search") || "";
    setCurrentPage(page);
    setPageSize(size);
    setSelectedMignonCat(cat);
    setSearchKeyword(search);
    setSearchInput(search);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 25) params.set("size", String(pageSize));
    if (selectedMignonCat !== "all") params.set("cat", selectedMignonCat);
    if (searchKeyword) params.set("search", searchKeyword);
    const newUrl = params.toString() ? "/?" + params.toString() : "/";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedMignonCat, searchKeyword]);

  useEffect(() => {
    fetchProducts();
  }, [selectedMignonCat, currentPage, pageSize, searchKeyword]);

  const fetchHero = async () => {
    // 히어로 모자이크 3장용 — 최신 상품 중 이미지 있는 것
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("is_active", true)
      .neq("category", "➡ Premium High-Quality ✨")
      .not("image", "is", null)
      .order("created_at", { ascending: false })
      .limit(3);
    setHeroItems((data as Product[]) || []);
  };

  const fetchProducts = async () => {
    setLoading(true);
    let query = supabase.from("products").select("*", { count: "exact" }).eq("is_active", true).neq("category", "➡ Premium High-Quality ✨");

    const cat = MIGNON_CATEGORIES.find((c) => c.key === selectedMignonCat);
    if (cat) {
      if (cat.saleOnly) {
        query = query.not("original_price", "is", null);
      } else {
        query = query.eq("category", cat.dbCategory);
        if (cat.subFilter.length > 0) {
          query = query.in("sub_category", cat.subFilter);
        }
      }
    }
    if (searchKeyword) {
      query = query.or("name.ilike.%" + searchKeyword + "%,name_ja.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%");
    }
    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
    if (error) console.error("상품 조회 실패:", error);
    else {
      setProducts((data as Product[]) || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const handleMignonCategoryClick = (cat: MignonCat) => {
    setSelectedMignonCat(cat.key);
    setCurrentPage(1);
    setSearchKeyword("");
    setSearchInput("");
    // 스크롤 안 함 - 같은 자리에서 콘텐츠만 갱신
  };

  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setCurrentPage(1); };

  const handleStaffAccessSuccess = () => {
    setHasStaffAccess(true);
    setShowStaffModal(false);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const currentCat = MIGNON_CATEGORIES.find((c) => c.key === selectedMignonCat);

  return (
    <div className="bg-white text-[var(--color-text)]">
      {/* ─── 히어로 (큰 비주얼 모자이크: BEST 3개 상품 활용) ─── */}
      <section className="bg-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 pt-6 lg:pt-8 pb-10 lg:pb-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 h-[420px] md:h-[560px] lg:h-[640px]">
            {/* 좌 큰 비주얼 + 카피 오버레이 */}
            <Link href="/?cat=all" className="relative md:col-span-2 row-span-2 bg-[var(--color-bg-cream)] overflow-hidden group">
              {heroItems[0]?.image ? (
                <Image src={heroItems[0].image} alt="hero" fill className="object-cover group-hover:scale-[1.02] transition-transform duration-700" sizes="(max-width: 768px) 100vw, 66vw" priority />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-[#F5EFE6] to-[#E8DECF]" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
              <div className="absolute left-6 lg:left-12 bottom-8 lg:bottom-12 text-white">
                <p className="font-serif text-[12px] lg:text-[14px] tracking-[0.3em] mb-2 opacity-90">2026 S/S</p>
                <p className="font-serif text-[40px] lg:text-[64px] leading-none tracking-tight">mignon</p>
                <p className="font-serif italic text-[14px] lg:text-[16px] opacity-90 mt-2">little happiness</p>
                <p className="text-[11px] lg:text-[12px] opacity-80 mt-5 leading-relaxed max-w-[280px]">
                  {language === "ja" ? "東京から、ときめくアイテムをあなたへ。" : "도쿄에서, 두근거리는 아이템을 당신에게."}
                </p>
                <span className="inline-block mt-6 text-[11px] tracking-[0.3em] border-b border-white/80 pb-1">SHOP NOW +</span>
              </div>
            </Link>

            {/* 우 상단 */}
            <Link href="/?cat=acc" className="relative bg-[var(--color-bg-soft)] overflow-hidden group hidden md:block">
              {heroItems[1]?.image ? (
                <Image src={heroItems[1].image} alt="acc" fill className="object-cover group-hover:scale-[1.04] transition-transform duration-700" sizes="33vw" />
              ) : (
                <div className="w-full h-full" />
              )}
              <div className="absolute left-5 bottom-5 text-white">
                <p className="text-[10px] tracking-[0.3em] opacity-90 mb-1">CATEGORY</p>
                <p className="font-serif text-[22px] lg:text-[26px] leading-none">ACC</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </Link>

            {/* 우 하단 */}
            <Link href="/?cat=bag" className="relative bg-[var(--color-bg-soft)] overflow-hidden group hidden md:block">
              {heroItems[2]?.image ? (
                <Image src={heroItems[2].image} alt="bag" fill className="object-cover group-hover:scale-[1.04] transition-transform duration-700" sizes="33vw" />
              ) : (
                <div className="w-full h-full" />
              )}
              <div className="absolute left-5 bottom-5 text-white">
                <p className="text-[10px] tracking-[0.3em] opacity-90 mb-1">CATEGORY</p>
                <p className="font-serif text-[22px] lg:text-[26px] leading-none">BAG</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 카테고리 8개 (슬림) ─── */}
      <section className="border-b border-[var(--color-line-soft)] bg-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-7 lg:py-9">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-y-5 gap-x-2">
            {MIGNON_CATEGORIES.map((cat) => {
              const active = selectedMignonCat === cat.key;
              return (
                <button key={cat.key} onClick={() => handleMignonCategoryClick(cat)} className="flex flex-col items-center group cursor-pointer">
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition border ${active ? "border-[var(--color-text)] bg-[var(--color-bg-cream)]" : "border-[var(--color-line)] bg-[var(--color-bg-soft)] group-hover:border-[var(--color-text-soft)]"}`}>
                    <CategoryIcon name={cat.icon} />
                  </div>
                  <span className={`mt-2.5 text-[10px] md:text-[11px] tracking-[0.18em] ${active ? "text-[var(--color-text)]" : "text-[var(--color-text-soft)] group-hover:text-[var(--color-text)]"}`}>
                    {cat.labelEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── 상품 그리드 (전체 or 선택 카테고리 or NEW IN) ─── */}
      <section id="products" className="max-w-[1400px] mx-auto px-4 lg:px-8 py-10 lg:py-14">
        <div className="text-center mb-7 lg:mb-9">
          <h2 className="text-[11px] tracking-[0.25em] text-[var(--color-text)]">
            {searchParams.get("sort") === "new"
              ? "NEW IN"
              : currentCat && currentCat.key !== "all"
                ? currentCat.labelEn
                : "ALL PRODUCTS"}
          </h2>
          <p className="text-[10px] text-[var(--color-text-mute)] mt-1.5">
            {searchParams.get("sort") === "new"
              ? (language === "ja" ? "新着アイテム" : "신상품")
              : currentCat && currentCat.key !== "all"
                ? (language === "ja" ? currentCat.labelJp : currentCat.labelEn)
                : (language === "ja" ? "全アイテム" : "전체")}
            {totalCount > 0 && <span className="ml-1">· {totalCount}</span>}
          </p>
        </div>

        {/* 검색 (slim) */}
        <form onSubmit={(e) => { e.preventDefault(); setSearchKeyword(searchInput); setCurrentPage(1); }} className="mb-6 flex justify-center">
          <div className="relative w-full max-w-[480px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={language === "ko" ? "상품명 검색" : "商品名で検索"}
              className="w-full pl-4 pr-24 py-2.5 bg-white border border-[var(--color-line)] text-[12px] text-[var(--color-text)] placeholder:text-[var(--color-text-mute)] focus:outline-none focus:border-[var(--color-text)] rounded-none"
            />
            <button type="submit" className="absolute right-0 top-0 bottom-0 px-5 bg-[var(--color-text)] text-white text-[11px] tracking-[0.25em]">
              SEARCH
            </button>
          </div>
        </form>

        {/* 페이지 사이즈 */}
        <div className="flex justify-end items-center gap-1 mb-5 text-[11px] text-[var(--color-text-soft)]">
          <span className="mr-2">VIEW</span>
          {PAGE_SIZE_OPTIONS.map((size, idx) => (
            <span key={size} className="flex items-center">
              <button
                onClick={() => handlePageSizeChange(size)}
                className={`px-1 ${pageSize === size ? "text-[var(--color-text)] underline underline-offset-2" : "hover:text-[var(--color-text)]"}`}
              >
                {size}
              </button>
              {idx < PAGE_SIZE_OPTIONS.length - 1 && <span className="text-[var(--color-text-mute)]">|</span>}
            </span>
          ))}
        </div>

        {/* 상품 그리드 */}
        {loading ? (
          <div className="text-center text-[var(--color-text-soft)] py-20 text-[12px] tracking-widest">LOADING...</div>
        ) : products.length === 0 ? (
          <div className="text-center text-[var(--color-text-soft)] py-20 text-[12px] tracking-widest">NO PRODUCTS</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-4 md:gap-y-10">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} returnQuery={"page=" + currentPage + "&size=" + pageSize + "&cat=" + selectedMignonCat + (searchKeyword ? "&search=" + searchKeyword : "")} />
            ))}
          </div>
        )}

        {/* 페이지네이션 (셀렉트샵 슬림) */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-14 gap-3 text-[11px] text-[var(--color-text-soft)] tracking-widest">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="hover:text-[var(--color-text)] disabled:opacity-30">{"<<"}</button>
            <button onClick={() => setCurrentPage(currentPage - 1)} disabled={currentPage === 1} className="hover:text-[var(--color-text)] disabled:opacity-30">PREV</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (currentPage <= 3) pageNum = i + 1;
              else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-1.5 ${currentPage === pageNum ? "text-[var(--color-text)] font-medium underline underline-offset-4" : "hover:text-[var(--color-text)]"}`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button onClick={() => setCurrentPage(currentPage + 1)} disabled={currentPage === totalPages} className="hover:text-[var(--color-text)] disabled:opacity-30">NEXT</button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="hover:text-[var(--color-text)] disabled:opacity-30">{">>"}</button>
          </div>
        )}
      </section>

      <StaffPasswordModal isOpen={showStaffModal} onClose={() => setShowStaffModal(false)} onSuccess={handleStaffAccessSuccess} />
    </div>
  );
}
