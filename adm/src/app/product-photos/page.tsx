"use client";

// 상품 실사진 게시판 · 목록 (P-02 · 2026-09-21)
// 목적: 관리자용 실사진 자료실 진입점 · 상품별 실사진 축적 상황 한눈에
// 판매용 이미지(products.image / products.images)와 완전 분리 · products/page.tsx 목록 회귀 없음

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAdmLanguage } from "@/contexts/LanguageContext";
import CategoryFilter from "@/components/CategoryFilter";

interface Product {
  id: number;
  name: string;
  name_ko?: string;
  name_ja?: string;
  image: string;
  category: string;
  category_ko?: string;
  category_ja?: string;
  sub_category?: string;
}

type PhotoFilter = "all" | "has" | "none";

const PAGE_SIZE_OPTIONS = [10, 50, 100];

export default function ProductPhotosListPage() {
  const searchParams = useSearchParams();
  const { language, pickName, pickCategory } = useAdmLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [photoCountMap, setPhotoCountMap] = useState<Map<number, number>>(new Map());
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("cat") || "전체");
  const [selectedSubCategory, setSelectedSubCategory] = useState(searchParams.get("sub") || "");
  const [photoFilter, setPhotoFilter] = useState<PhotoFilter>((searchParams.get("photo") as PhotoFilter) || "all");
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size")) || 50);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  const [categories, setCategories] = useState<Array<{ id: number; name_ja: string; name_ko: string; parent_id: number | null }>>([]);
  const [showRegisterHint, setShowRegisterHint] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // URL 동기화
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 50) params.set("size", String(pageSize));
    if (selectedCategory !== "전체") params.set("cat", selectedCategory);
    if (selectedSubCategory) params.set("sub", selectedSubCategory);
    if (searchKeyword) params.set("search", searchKeyword);
    if (photoFilter !== "all") params.set("photo", photoFilter);
    const newUrl = params.toString() ? "/product-photos?" + params.toString() : "/product-photos";
    if (typeof window !== "undefined" && window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedCategory, selectedSubCategory, searchKeyword, photoFilter]);

  // 카테고리 로드 (products/page.tsx 패턴 재사용)
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name_ja, name_ko, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("카테고리 조회 실패:", error);
        return;
      }
      const list = (data || [])
        .filter((c): c is { id: number; name_ja: string; name_ko: string; parent_id: number | null; sort_order: number } => !!c.name_ja)
        .map((c) => ({ id: c.id, name_ja: c.name_ja, name_ko: c.name_ko || c.name_ja, parent_id: c.parent_id }));
      setCategories(list);
    };
    fetchCategories();
  }, []);

  const topCategories = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);
  const subCategoriesOfSelected = useMemo(() => {
    if (selectedCategory === "전체") return [];
    const parent = categories.find((c) => c.parent_id === null && c.name_ja === selectedCategory);
    if (!parent) return [];
    return categories.filter((c) => c.parent_id === parent.id);
  }, [categories, selectedCategory]);

  // 상품 조회 · 「실사진 있음/없음」 필터를 위해 photo product_id 리스트를 먼저 얻어서 필터
  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedSubCategory, currentPage, pageSize, searchKeyword, photoFilter]);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);

    // 「실사진 있음/없음」 필터가 걸리면 · 먼저 실사진이 있는 product_id 리스트 조회
    // MVP 방침 · 실사진 있는 상품 수는 초기엔 소수 (수십~수백) 예상 · in/not.in URL 파라미터 한도 내
    // 성능 이슈 시 후속 (사장님 지시)
    // P-03: FK SET NULL로 변경 후 product_id=NULL(고아 사진) row가 존재할 수 있음 → 필터링 필수
    let photoProductIds: number[] | null = null;
    if (photoFilter !== "all") {
      const { data: phRows, error: phErr } = await supabase
        .from("product_photos")
        .select("product_id")
        .not("product_id", "is", null);
      if (phErr) {
        setFetchError(phErr.message || "실사진 데이터를 불러오지 못했습니다.");
        setLoading(false);
        return;
      }
      photoProductIds = Array.from(new Set(
        (phRows || [])
          .map((r: { product_id: number | null }) => r.product_id)
          .filter((v): v is number => v !== null)
      ));
    }

    let query = supabase
      .from("products")
      .select("id, name, name_ko, name_ja, image, category, category_ko, category_ja, sub_category", { count: "exact" });

    if (selectedCategory !== "전체") {
      query = query.eq("category", selectedCategory);
      if (selectedSubCategory) query = query.eq("sub_category", selectedSubCategory);
    }
    if (searchKeyword) {
      query = query.or("name.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%");
    }
    if (photoFilter === "has") {
      if (!photoProductIds || photoProductIds.length === 0) {
        // 실사진이 있는 상품 없음 → 결과 0건 확정
        setProducts([]);
        setTotalCount(0);
        setPhotoCountMap(new Map());
        setLoading(false);
        return;
      }
      query = query.in("id", photoProductIds);
    } else if (photoFilter === "none") {
      if (photoProductIds && photoProductIds.length > 0) {
        query = query.not("id", "in", "(" + photoProductIds.join(",") + ")");
      }
    }

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      setFetchError(error.message || "상품 목록을 불러오지 못했습니다.");
      setLoading(false);
      return;
    }

    const rows = (data || []) as Product[];
    setProducts(rows);
    setTotalCount(count || 0);

    // 이번 페이지 상품들의 실사진 개수 조회 (배지용)
    if (rows.length > 0) {
      const ids = rows.map((p) => p.id);
      const { data: photoRows, error: photoErr } = await supabase
        .from("product_photos")
        .select("product_id")
        .in("product_id", ids);
      if (photoErr) {
        console.error("실사진 카운트 조회 실패:", photoErr);
        setPhotoCountMap(new Map());
      } else {
        const map = new Map<number, number>();
        (photoRows || []).forEach((r: { product_id: number }) => {
          map.set(r.product_id, (map.get(r.product_id) || 0) + 1);
        });
        setPhotoCountMap(map);
      }
    } else {
      setPhotoCountMap(new Map());
    }

    setLoading(false);
  };

  const handleSearch = () => {
    setSearchKeyword(searchInput);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedSubCategory("");
    setCurrentPage(1);
  };
  const handleSubCategoryChange = (sub: string) => {
    setSelectedSubCategory(sub);
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const startIndex = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">상품 실사진</h1>
          <p className="text-sm text-gray-500 mt-1">
            상품을 선택하면 해당 상품의 실사진을 등록·조회할 수 있습니다.
            <span className="ml-2 text-gray-400">· 총 {totalCount}개 상품 중 {startIndex}-{endIndex}번</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowRegisterHint(true);
            searchInputRef.current?.focus();
            searchInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-[var(--color-brand)] text-white rounded-full hover:bg-[var(--color-brand-dk)] font-medium shadow-sm transition whitespace-nowrap self-start sm:self-auto"
          title="등록할 상품을 검색해서 선택하세요"
        >
          <span className="text-base leading-none">+</span>
          실사진 등록
        </button>
      </div>

      {/* 등록 안내 배너 · 「+ 실사진 등록」 클릭 시 표시 */}
      {showRegisterHint && (
        <div className="bg-[var(--color-brand)]/10 border border-[var(--color-brand)]/30 text-gray-800 rounded-xl p-4 mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2 text-sm">
            <span className="text-lg leading-none">💡</span>
            <div>
              <p className="font-medium">실사진을 등록할 상품을 먼저 선택하세요.</p>
              <p className="text-xs text-gray-600 mt-0.5">
                아래 검색창에 상품명을 입력하거나 카드에서 상품을 클릭하면 해당 상품의 실사진 등록 화면으로 이동합니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowRegisterHint(false)}
            className="text-gray-400 hover:text-gray-700 text-lg leading-none flex-shrink-0"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-3">
          {/* 카테고리 · 최상위 */}
          <CategoryFilter
            language={language}
            categories={[{ id: 0, name_ja: "전체", name_ko: "전체", parent_id: null }, ...topCategories]}
            selected={selectedCategory}
            onChange={handleCategoryChange}
            label="카테고리"
            allLabel="전체"
          />

          {/* 하위 카테고리 */}
          {subCategoriesOfSelected.length > 0 && (
            <CategoryFilter
              language={language}
              categories={subCategoriesOfSelected}
              selected={selectedSubCategory}
              onChange={handleSubCategoryChange}
              label="└ 하위"
              allLabel="전체"
              indent
            />
          )}

          {/* 실사진 상태 필터 */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <span className="text-sm text-gray-600 font-medium whitespace-nowrap">실사진</span>
            <div className="inline-flex items-center bg-white rounded-full p-0.5 border border-gray-200 shadow-sm">
              {(
                [
                  { key: "all", label: "전체" },
                  { key: "has", label: "있음" },
                  { key: "none", label: "없음" },
                ] as { key: PhotoFilter; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => { setPhotoFilter(opt.key); setCurrentPage(1); }}
                  className={`px-3.5 py-1.5 text-sm rounded-full transition-all font-medium ${
                    photoFilter === opt.key
                      ? "bg-[var(--color-brand)] text-white shadow-sm"
                      : "text-gray-500 hover:text-[var(--color-brand-dk)]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 검색 + 페이지 사이즈 */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="상품명 검색..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9 pr-3 py-1.5 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40 focus:border-[var(--color-brand)] w-52 bg-white transition"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-4 py-1.5 text-sm bg-[var(--color-brand)] text-white rounded-full hover:bg-[var(--color-brand-dk)] font-medium shadow-sm transition"
              >
                검색
              </button>
              {searchKeyword && (
                <button
                  onClick={() => { setSearchKeyword(""); setSearchInput(""); }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-[var(--color-brand-dk)] transition"
                >
                  {language === "ko" ? "초기화" : "リセット"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">표시</span>
              <div className="inline-flex items-center bg-white rounded-full p-0.5 border border-gray-200 shadow-sm">
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <button
                    key={size}
                    onClick={() => { setPageSize(size); setCurrentPage(1); }}
                    className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
                      pageSize === size
                        ? "bg-[var(--color-brand)] text-white shadow-sm"
                        : "text-gray-500 hover:text-[var(--color-brand-dk)]"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">데이터를 불러오지 못했습니다.</span>
            <span className="ml-2 text-red-500">{fetchError}</span>
          </div>
          <button
            onClick={() => fetchProducts()}
            className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            재시도
          </button>
        </div>
      )}

      {/* Grid · 카드형 */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">로딩 중...</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          {photoFilter === "has" ? "실사진이 등록된 상품이 없습니다." :
           photoFilter === "none" ? "모든 상품에 실사진이 있습니다." :
           "조건에 맞는 상품이 없습니다."}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {products.map((p) => {
            const count = photoCountMap.get(p.id) || 0;
            return (
              <Link
                key={p.id}
                href={`/product-photos/${p.id}`}
                className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col"
              >
                <div className="relative aspect-square bg-gray-100 overflow-hidden">
                  {p.image ? (
                    <Image
                      src={p.image}
                      alt={pickName(p)}
                      fill
                      unoptimized
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-3xl">📷</div>
                  )}
                  {/* 실사진 개수 배지 */}
                  <div className="absolute top-2 right-2">
                    {count > 0 ? (
                      <span className="inline-flex items-center gap-1 bg-[var(--color-brand)] text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                        📸 {count}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-0.5 bg-gray-900/70 backdrop-blur text-white text-[10px] font-semibold px-2 py-1 rounded-full group-hover:bg-[var(--color-brand)] transition-colors">
                        <span className="text-xs leading-none">+</span> 등록
                      </span>
                    )}
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col">
                  <p
                    className="text-sm font-medium text-gray-900 line-clamp-2"
                    title={language === "ko" ? (p.name_ja || p.name || "") : (p.name_ko || "")}
                  >
                    {pickName(p)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1 truncate">
                    {pickCategory(p)}
                    {p.sub_category && <span className="ml-1 text-gray-400">/ {p.sub_category}</span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >{"<<"}</button>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >{"<"}</button>

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
                className={`px-3 py-2 text-sm rounded ${
                  currentPage === pageNum ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >{">"}</button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >{">>"}</button>
        </div>
      )}
    </div>
  );
}
