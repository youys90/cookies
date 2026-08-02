"use client";
// CREAM 메인 - 셀렉트샵 미니멀 패턴 (자체 작성)
// 구조: 짧은 히어로 → 카테고리 8개 슬림 → NEW ARRIVAL 그리드 → BEST 그리드 → ALL PRODUCTS(쿠키즈 검색/필터/페이지네이션 유지)
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ProductCard from "@/components/ProductCard";
import StaffPasswordModal from "@/components/StaffPasswordModal";
import { supabase } from "@/lib/supabase";
import { BuiltinCategoryIcon, isBuiltinIcon, guessIconKey } from "@/lib/category-icons";
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

// ── 서브 카테고리 다국어 매핑 (DB는 일본어로만 저장되어 있어 한국어 UI에서 변환 필요) ──
const SUB_CATEGORY_KO: Record<string, string> = {
  // アクセサリー
  "ピアス": "피어싱",
  "ネックレス": "목걸이",
  "リング": "반지",
  "ブレスレット": "팔찌",
  // ファッション雑貨
  "キャップ": "캡모자",
  "靴下": "양말",
  "ミニバッグ": "미니백",
  "財布": "지갑",
  "ポーチ": "파우치",
  // ヘアアクセサリー
  "ヘアピン": "헤어핀",
  "ヘアバンド": "헤어밴드",
  "ヘアゴム": "헤어끈",
  // キーリング
  "バッグキーリング": "백키링",
  // 冬物アイテム
  "手袋": "장갑",
  // 공통
  "その他": "기타",
  "アクセサリー": "악세사리",
};
const subCategoryLabel = (sub: string, lang: string) =>
  lang === "ko" ? (SUB_CATEGORY_KO[sub] || sub) : sub;

// ── CREAM 카테고리 8개 ──
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
  const [subCategories, setSubCategories] = useState<string[]>([]);
  const [selectedSubCat, setSelectedSubCat] = useState<string>(searchParams.get("sub") || "");
  // adm에서 관리하는 categories 테이블 (최상위) — 하드코딩 MIGNON_CATEGORIES 대체
  const [dbCategories, setDbCategories] = useState<Array<{ id: number; name_ko: string; name_ja: string; name_en?: string | null; icon_url: string | null; sort_order: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [hasStaffAccess, setHasStaffAccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size")) || 25);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  useEffect(() => {
    // 서버 세션 쿠키 검증 (HMAC 서명, 클라이언트 조작 불가)
    (async () => {
      try {
        const r = await fetch("/api/staff/session", { cache: "no-store" });
        const j = await r.json();
        if (j.ok) setHasStaffAccess(true);
        else if (searchParams.get("staff") === "1") setShowStaffModal(true);
      } catch {
        if (searchParams.get("staff") === "1") setShowStaffModal(true);
      }
    })();
    fetchHero();
    fetchDbCategories();
  }, []);

  // adm에서 편집한 카테고리 실시간 반영 (categories 테이블 조회)
  const fetchDbCategories = async () => {
    const { data } = await supabase
      .from("categories")
      .select("id, name_ko, name_ja, name_en, icon_url, sort_order")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setDbCategories((data as typeof dbCategories) || []);
  };

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
    if (selectedSubCat) params.set("sub", selectedSubCat);
    if (searchKeyword) params.set("search", searchKeyword);
    const newUrl = params.toString() ? "/?" + params.toString() : "/";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedMignonCat, searchKeyword]);

  useEffect(() => {
    fetchProducts();
  }, [selectedMignonCat, selectedSubCat, currentPage, pageSize, searchKeyword]);

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
    // DB 카테고리(adm 관리)에서 온 경우: selectedMignonCat이 name_ja 값
    const dbCat = dbCategories.find((c) => c.name_ja === selectedMignonCat);
    if (dbCat) {
      query = query.eq("category", dbCat.name_ja);
      if (selectedSubCat) {
        query = query.eq("sub_category", selectedSubCat);
      }
    } else if (cat) {
      if (cat.saleOnly) {
        query = query.not("original_price", "is", null);
      } else {
        query = query.eq("category", cat.dbCategory);
        // 사장님 선택한 세부 카테고리(2뎁스, 텍스트)만 필터
        if (selectedSubCat) {
          query = query.eq("sub_category", selectedSubCat);
        } else if (cat.subFilter.length > 0) {
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
    setSelectedSubCat(""); // 상위 바뀌면 하위 초기화
    setCurrentPage(1);
    setSearchKeyword("");
    setSearchInput("");
    // 하위 카테고리 자동 조회
    if (cat.key !== "all" && !cat.saleOnly && cat.dbCategory) {
      fetchSubCategories(cat.dbCategory);
    } else {
      setSubCategories([]);
    }
  };

  // 상위 카테고리의 실제 sub_category distinct 조회
  const fetchSubCategories = async (dbCategory: string) => {
    const { data } = await supabase
      .from("products")
      .select("sub_category")
      .eq("is_active", true)
      .eq("category", dbCategory)
      .not("sub_category", "is", null);
    const uniq = Array.from(new Set((data || []).map((r) => r.sub_category as string).filter(Boolean))).sort();
    setSubCategories(uniq);
  };

  // 처음 진입 시에도 URL의 cat이 있으면 서브 카테고리 조회
  useEffect(() => {
    const cat = MIGNON_CATEGORIES.find((c) => c.key === selectedMignonCat);
    if (cat && cat.key !== "all" && !cat.saleOnly && cat.dbCategory) {
      fetchSubCategories(cat.dbCategory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageSizeChange = (newSize: number) => { setPageSize(newSize); setCurrentPage(1); };

  const handleStaffAccessSuccess = () => {
    setHasStaffAccess(true);
    setShowStaffModal(false);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const currentCat = MIGNON_CATEGORIES.find((c) => c.key === selectedMignonCat);
  const currentDbCat = dbCategories.find((c) => c.name_ja === selectedMignonCat);
  const currentTitleEn = currentCat?.labelEn || (currentDbCat ? currentDbCat.name_ja.toUpperCase() : "ALL");
  const currentTitleLocal = language === "ja"
    ? (currentCat?.labelJp || currentDbCat?.name_ja || "全アイテム")
    : (currentDbCat?.name_ko || "전체");

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
              {/* 히어로 안 오버레이: 크림 톤 정책 안내 (크림디자인팀 시안 A) */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-white/20" />
              <div className="absolute inset-0 flex items-center justify-center px-4 md:px-8 lg:px-12">
                <div className="text-center w-[calc(100%-2rem)] md:w-[calc(100%-4rem)] max-w-[880px] bg-[var(--color-bg-cream)]/95 backdrop-blur-md border border-[var(--color-text)]/8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-sm px-6 md:px-10 lg:px-14 py-8 md:py-12 lg:py-14 overflow-hidden">
                  <h2 className="font-serif font-medium text-[24px] md:text-[40px] lg:text-[54px] leading-[1.25] tracking-[0.04em] mb-6 md:mb-8 text-[var(--color-text)]">
                    {language === "ja" ? "オンライン価格ポリシー変更のお知らせ" : "온라인 가격 정책 변경 안내"}
                  </h2>
                  <div className="text-[13px] md:text-[17px] lg:text-[19px] leading-[1.85] font-light text-[var(--color-text-soft)] space-y-2 md:space-y-3">
                    {language === "ja" ? (
                      <>
                        <p>
                          ご利用の便宜のため、<b className="font-semibold text-[var(--color-point)]">送料と通関保証費用をすべて無料</b>でご提供いたします。
                        </p>
                        <p>これに伴い、一部のオンライン商品の販売価格が若干調整されます。</p>
                        <p className="text-[var(--color-text-mute)]">店舗に直接お越しのお客様には、従来通り店舗価格にて販売しております。</p>
                      </>
                    ) : (
                      <>
                        <p>
                          이용 편의를 위해 <b className="font-semibold text-[var(--color-point)]">배송비와 통관보장 비용을 모두 무료</b>로 제공합니다.
                        </p>
                        <p>이에 따라 일부 온라인 상품의 판매 가격이 소폭 조정됩니다.</p>
                        <p className="text-[var(--color-text-mute)]">매장에 직접 방문하시는 고객님께는 기존 매장 가격 그대로 판매됩니다.</p>
                      </>
                    )}
                  </div>
                  <p className="mt-6 md:mt-8 text-[12px] md:text-[14px] lg:text-[16px] tracking-[0.28em] text-[var(--color-text-mute)]">
                    {language === "ja" ? "いつもご愛顧いただきありがとうございます." : "항상 감사합니다."}
                  </p>
                </div>
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

      {/* ─── 무료 혜택 강조 (슬림) ─── */}
      <section className="bg-[var(--color-bg-cream)] border-y border-[var(--color-line-soft)]">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-5 md:py-7">
          <div className="flex items-center justify-center gap-6 md:gap-16">
            <div className="flex items-center gap-2 md:gap-3">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-[var(--color-text)]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 8h14v14H3z" />
                <path d="M17 12h6l4 5v5h-10V12z" />
                <circle cx="8" cy="24" r="2.5" fill="currentColor" />
                <circle cx="22" cy="24" r="2.5" fill="currentColor" />
              </svg>
              <div className="text-left">
                <p className="font-serif text-[13px] md:text-[16px] leading-tight text-[var(--color-text)] tracking-wide">
                  {language === "ja" ? "送料無料" : "배송비 무료"}
                </p>
                <p className="text-[9px] md:text-[10px] text-[var(--color-text-mute)] tracking-widest mt-0.5">FREE SHIPPING</p>
              </div>
            </div>
            <div className="w-px h-10 md:h-12 bg-[var(--color-line)]" />
            <div className="flex items-center gap-2 md:gap-3">
              <svg className="w-6 h-6 md:w-8 md:h-8 text-[var(--color-text)]" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M16 3l11 4v9c0 7-5 12-11 13-6-1-11-6-11-13V7l11-4z" />
                <path d="M11 16l4 4 6-7" />
              </svg>
              <div className="text-left">
                <p className="font-serif text-[13px] md:text-[16px] leading-tight text-[var(--color-text)] tracking-wide">
                  {language === "ja" ? "通関保証無料" : "통관보장 무료"}
                </p>
                <p className="text-[9px] md:text-[10px] text-[var(--color-text-mute)] tracking-widest mt-0.5">CUSTOMS COVERED</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 카테고리 8개 (슬림) ─── */}
      <section className="border-b border-[var(--color-line-soft)] bg-white">
        <div className="max-w-[1400px] mx-auto px-4 lg:px-8 py-7 lg:py-9">
          {/* dbCategories(adm 카테고리 관리)가 있으면 그것 우선 렌더, 없으면 하드코딩 fallback */}
          <div className={`grid gap-y-5 gap-x-2 ${dbCategories.length > 0 ? (dbCategories.length <= 4 ? "grid-cols-4" : dbCategories.length <= 8 ? "grid-cols-4 md:grid-cols-8" : "grid-cols-4 md:grid-cols-8 lg:grid-cols-10") : "grid-cols-4 md:grid-cols-8"}`}>
            {dbCategories.length > 0 ? (
              dbCategories.map((cat) => {
                const active = selectedMignonCat === cat.name_ja;
                // name_en 있으면 언어 무관 짧은 영문 라벨 우선 (사장님 요구)
                const label = cat.name_en || (language === "ja" ? cat.name_ja : cat.name_ko);
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedMignonCat(cat.name_ja);
                      setSelectedSubCat("");
                      setCurrentPage(1);
                      setSearchKeyword("");
                      setSearchInput("");
                      fetchSubCategories(cat.name_ja);
                    }}
                    className="flex flex-col items-center group cursor-pointer"
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition border overflow-hidden ${active ? "border-[var(--color-text)] bg-[var(--color-bg-cream)]" : "border-[var(--color-line)] bg-[var(--color-bg-soft)] group-hover:border-[var(--color-text-soft)]"}`}>
                      {(() => {
                        const builtin = isBuiltinIcon(cat.icon_url);
                        if (builtin) {
                          return <BuiltinCategoryIcon name={builtin} className="w-7 h-7 md:w-8 md:h-8 stroke-[var(--color-text)]" />;
                        }
                        if (cat.icon_url) {
                          return <Image src={cat.icon_url} alt={label} width={64} height={64} className="object-cover w-full h-full" unoptimized />;
                        }
                        // icon_url 없으면 이름 기반 자동 매칭 (사장님이 adm에서 지정 전에도 예쁘게)
                        const guessed = guessIconKey(cat.name_ja || cat.name_ko);
                        return <BuiltinCategoryIcon name={guessed} className="w-7 h-7 md:w-8 md:h-8 stroke-[var(--color-text)]" />;
                      })()}
                    </div>
                    <span className={`mt-2.5 text-[10px] md:text-[11px] tracking-[0.18em] ${active ? "text-[var(--color-text)]" : "text-[var(--color-text-soft)] group-hover:text-[var(--color-text)]"}`}>
                      {label}
                    </span>
                  </button>
                );
              })
            ) : (
              MIGNON_CATEGORIES.map((cat) => {
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
              })
            )}
          </div>

          {/* 2뎁스 - 하위 카테고리 텍스트 탭 (상위 선택 시 자동 노출) */}
          {subCategories.length > 0 && selectedMignonCat !== "all" && (
            <div className="mt-6 pt-5 border-t border-[var(--color-line-soft)]">
              <div className="flex flex-wrap justify-center gap-x-1 gap-y-2">
                <button
                  onClick={() => setSelectedSubCat("")}
                  className={`px-3 py-1.5 text-[11px] tracking-[0.15em] transition ${
                    !selectedSubCat
                      ? "text-[var(--color-text)] border-b border-[var(--color-text)]"
                      : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
                  }`}
                >
                  {language === "ja" ? "全部" : "전체"}
                </button>
                {subCategories.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubCat(sub)}
                    className={`px-3 py-1.5 text-[11px] tracking-[0.15em] transition ${
                      selectedSubCat === sub
                        ? "text-[var(--color-text)] border-b border-[var(--color-text)]"
                        : "text-[var(--color-text-soft)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {subCategoryLabel(sub, language)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── 상품 그리드 (전체 or 선택 카테고리 or NEW IN) ─── */}
      <section id="products" className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-14">
        <div className="text-center mb-7 lg:mb-9">
          <h2 className="text-[11px] tracking-[0.25em] text-[var(--color-text)]">
            {searchParams.get("sort") === "new"
              ? "NEW IN"
              : selectedMignonCat !== "all"
                ? currentTitleEn
                : "ALL PRODUCTS"}
          </h2>
          <p className="text-[10px] text-[var(--color-text-mute)] mt-1.5">
            {searchParams.get("sort") === "new"
              ? (language === "ja" ? "新着アイテム" : "신상품")
              : selectedMignonCat !== "all"
                ? currentTitleLocal
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
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
