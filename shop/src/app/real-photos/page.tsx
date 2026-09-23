"use client";

// 실사진 (REAL PHOTOS) · 사용자용 목록 페이지 · P-02 (2026-09-24)
// - product_photos 에 사진이 등록된 상품만 노출 (실사진 없는 상품 제외)
// - 사장님 지시: 시스템 설명 문구 넣지 X · 미니멀 흑백 shop 톤 유지
// - 카드 = 상품 대표사진 (products.image) + 상품명(언어별) + 실사진 개수 (N点 / N장)
// - 검색: name/name_ja/name_ko ilike · shop 메인 검색 로직 재사용
// - 페이지네이션: shop 메인 스타일 준용
// - 관리자 필드 (storage_path · caption · sort_order 값 · snapshot · id 등) 사용자에 노출 X
//   · 여기서는 개수만 사용 · 상품 상세 페이지에서 image_url + sort_order (정렬용)만 사용

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useLanguage } from "@/contexts/LanguageContext";

interface ProductRow {
  id: number;
  name: string;
  name_ja?: string | null;
  name_ko?: string | null;
  image: string;
  category?: string | null;
  category_ja?: string | null;
  category_ko?: string | null;
  is_active?: boolean;
}

interface ProductWithCount extends ProductRow {
  photoCount: number;
}

const PAGE_SIZE = 24;

export default function RealPhotosListPage() {
  const { language } = useLanguage();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ProductWithCount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  // URL 동기화 (shop 메인 패턴 준용)
  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (searchKeyword) params.set("search", searchKeyword);
    const newUrl = params.toString() ? "/real-photos?" + params.toString() : "/real-photos";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, searchKeyword]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    // 1) product_photos 에 등록된 상품 id · 중복 제거 · null 제외 (P-03 orphan 방어)
    //    - client-side distinct: RLS 하에 select 로 얻은 product_id 를 Set 화
    //    - 대량화되면 서버 함수로 이관 가능 · 지금은 자료실 규모 감안 클라 처리
    const { data: photoRows, error: photoErr } = await supabase
      .from("product_photos")
      .select("product_id")
      .not("product_id", "is", null);
    if (photoErr) {
      console.error("실사진 조회 실패:", photoErr);
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    const productIds = Array.from(
      new Set(
        (photoRows || [])
          .map((r) => r.product_id as number | null)
          .filter((v): v is number => typeof v === "number")
      )
    );

    if (productIds.length === 0) {
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    // 2) 판매 활성 상품만 (관리자에서 숨긴 상품은 실사진 있어도 노출 X)
    let query = supabase
      .from("products")
      .select("id, name, name_ja, name_ko, image, category, category_ja, category_ko, is_active", { count: "exact" })
      .in("id", productIds)
      .eq("is_active", true);

    if (searchKeyword) {
      query = query.or(
        "name.ilike.%" + searchKeyword + "%,name_ja.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%"
      );
    }

    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: prodRows, error: prodErr, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);
    if (prodErr) {
      console.error("상품 조회 실패:", prodErr);
      setItems([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }

    // 3) 각 상품별 실사진 개수 집계 (표시 카운트만)
    // - photoRows 는 이미 조회된 상태 · 다시 조회하지 않고 로컬 집계
    const countByProduct = new Map<number, number>();
    (photoRows || []).forEach((r) => {
      const pid = r.product_id as number | null;
      if (typeof pid !== "number") return;
      countByProduct.set(pid, (countByProduct.get(pid) || 0) + 1);
    });
    const withCount: ProductWithCount[] = ((prodRows || []) as ProductRow[]).map((p) => ({
      ...p,
      photoCount: countByProduct.get(p.id) || 0,
    }));

    setItems(withCount);
    setTotalCount(count || 0);
    setLoading(false);
  }, [currentPage, searchKeyword]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const getName = (p: ProductRow) =>
    language === "ja" ? p.name_ja || p.name : p.name_ko || p.name;
  const getCategory = (p: ProductRow) =>
    language === "ja" ? p.category_ja || p.category || "" : p.category_ko || p.category || "";

  const photoCountLabel = (n: number) =>
    language === "ja" ? `${n}点` : `${n}장`;

  return (
    <div className="bg-white text-[var(--color-text)]">
      <section className="max-w-[1600px] mx-auto px-4 md:px-6 lg:px-8 py-8 md:py-12 lg:py-14">
        {/* 헤더 · 미니멀 · 시스템 설명 문구 X (사장님 명시) */}
        <div className="text-center mb-7 lg:mb-9">
          <h1 className="text-[11px] tracking-[0.25em] text-[var(--color-text)]">REAL PHOTOS</h1>
          <p className="text-[10px] text-[var(--color-text-mute)] mt-1.5">
            {language === "ja" ? "実写真" : "실사진"}
            {totalCount > 0 && <span className="ml-1">· {totalCount}</span>}
          </p>
        </div>

        {/* 검색 · shop 메인과 동일 UI */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearchKeyword(searchInput);
            setCurrentPage(1);
          }}
          className="mb-6 flex justify-center"
        >
          <div className="relative w-full max-w-[480px]">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={language === "ko" ? "상품명 검색" : "商品名で検索"}
              className="w-full pl-4 pr-24 py-2.5 bg-white border border-[var(--color-line)] text-[12px] text-[var(--color-text)] placeholder:text-[var(--color-text-mute)] focus:outline-none focus:border-[var(--color-text)] rounded-none"
            />
            <button
              type="submit"
              className="absolute right-0 top-0 bottom-0 px-5 bg-[var(--color-text)] text-white text-[11px] tracking-[0.25em]"
            >
              SEARCH
            </button>
          </div>
        </form>

        {/* 그리드 · 모바일 2열 · desktop 4열 (shop-product-grid 재사용 · min-w-0 자연 계승) */}
        {loading ? (
          <div className="text-center text-[var(--color-text-soft)] py-20 text-[12px] tracking-widest">LOADING...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-[var(--color-text-soft)] py-20 text-[12px] tracking-widest">
            {searchKeyword ? "NO RESULTS" : "NO PHOTOS"}
          </div>
        ) : (
          <div className="shop-product-grid">
            {items.map((p) => (
              <Link
                key={p.id}
                href={`/real-photos/${p.id}`}
                className="group block min-w-0"
                aria-label={getName(p)}
              >
                <div className="relative aspect-square overflow-hidden bg-gray-50 flex items-center justify-center">
                  {p.image && (
                    <Image
                      src={p.image}
                      alt={getName(p)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 768px) 50vw, 25vw"
                    />
                  )}
                  {/* 실사진 개수 배지 · 우하단 · 은은한 다크톤 */}
                  <span className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] tracking-[0.1em] px-2 py-1 rounded-full backdrop-blur-sm">
                    <span aria-hidden="true">◉</span>
                    <span className="ml-1 tabular-nums">{photoCountLabel(p.photoCount)}</span>
                  </span>
                </div>
                {/* 카드 하단 · 카테고리(작게) + 상품명 (2행 clamp) · min-w-0 자연 계승 · 가격 노출 X */}
                <div className="mt-3 md:mt-4 px-0.5 space-y-1 min-w-0">
                  {getCategory(p) && (
                    <p className="text-[11px] text-gray-500 tracking-widest uppercase truncate">
                      {getCategory(p)}
                    </p>
                  )}
                  <h3 className="text-[13px] md:text-sm font-medium text-gray-900 group-hover:text-gray-600 line-clamp-2 min-h-[2.6em]">
                    {getName(p)}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* 페이지네이션 (shop 메인 스타일) */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center mt-14 gap-3 text-[11px] text-[var(--color-text-soft)] tracking-widest">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="hover:text-[var(--color-text)] disabled:opacity-30"
            >
              {"<<"}
            </button>
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="hover:text-[var(--color-text)] disabled:opacity-30"
            >
              PREV
            </button>
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
                  className={`px-1.5 ${
                    currentPage === pageNum
                      ? "text-[var(--color-text)] font-medium underline underline-offset-4"
                      : "hover:text-[var(--color-text)]"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="hover:text-[var(--color-text)] disabled:opacity-30"
            >
              NEXT
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="hover:text-[var(--color-text)] disabled:opacity-30"
            >
              {">>"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
