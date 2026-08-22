"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BulkActionBar from "@/components/BulkActionBar";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import InlineEditCell from "@/components/InlineEditCell";
import { exportProductsToXlsx } from "@/lib/xlsxTemplate";
import { useAdmLanguage } from "@/contexts/LanguageContext";
import CategoryFilter from "@/components/CategoryFilter";

interface Product {
  id: number;
  name: string;
  name_ko?: string;
  name_ja?: string;
  price: number;
  original_price?: number;
  image: string;
  images?: string[];
  category: string;
  category_ko?: string;
  category_ja?: string;
  sub_category?: string;
  sub_category_ko?: string;
  description?: string;
  description_ko?: string;
  description_ja?: string;
  stock?: number;
  is_active?: boolean;
  source?: string | null;
  created_at?: string;
  updated_at?: string;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];

// Excel 업로드 · 관리자 친화 한글 헤더만 · 일본어는 등록 시 자동 번역/매핑
// 이미지 · 파일에 포함 안 함 · 등록 후 개별 편집 or 일괄수정에서 첨부
const CSV_HEADER = [
  "상품명",
  "가격",
  "정가",
  "카테고리",
  "하위 카테고리",
  "상품 설명",
  "재고",
  "판매상태",
];

// 한글 헤더 → 임시 필드 매핑 · 업로드 시 사용 (일본어 필드는 별도 처리)
// 공백/괄호 표기 흔들림에도 매칭되게 정규화된 key 사용
export const CSV_HEADER_MAP: Record<string, string> = {
  "상품명": "name_ko",
  "가격": "price",
  "정가": "original_price",
  "카테고리": "category_ko",
  "하위카테고리": "sub_category_ko",
  "하위 카테고리": "sub_category_ko",
  "상품설명": "description_ko",
  "상품 설명": "description_ko",
  "재고": "stock",
  "판매상태": "is_active",
};

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { language, pickName, pickCategory } = useAdmLanguage();
  const [productList, setProductList] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("cat") || "전체");
  const [selectedSubCategory, setSelectedSubCategory] = useState(searchParams.get("sub") || "");
  const [imageFilter, setImageFilter] = useState<"all" | "missing" | "attached">((searchParams.get("img") as "all" | "missing" | "attached") || "all");
  // 보기 모드 · 간편(기존) vs 상세(등록방식/등록일 등 확장 컬럼) · LocalStorage 유지
  const [viewMode, setViewMode] = useState<"simple" | "detail">(() => {
    if (typeof window === "undefined") return "detail";
    return (localStorage.getItem("adm.productViewMode") as "simple" | "detail") || "detail";
  });
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("adm.productViewMode", viewMode);
  }, [viewMode]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // 관리자 = 한국인 · 한국어 표시. 필터링은 name_ja 문자열 기준 (products.category와 일치)
  const [categories, setCategories] = useState<Array<{ id: number; name_ja: string; name_ko: string; parent_id: number | null }>>([]);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [pageSize, setPageSize] = useState(Number(searchParams.get("size")) || 50);
  const [totalCount, setTotalCount] = useState(0);
  const [searchKeyword, setSearchKeyword] = useState(searchParams.get("search") || "");
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");

  // 다중 선택
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 모달
  const [showDelete, setShowDelete] = useState(false);
  const [pendingDeleteTargets, setPendingDeleteTargets] = useState<number[]>([]);
  // 이미지 라이트박스 (썸네일 클릭 → 상품의 모든 이미지 슬라이더 형태로 보기)
  const [lightbox, setLightbox] = useState<{ urls: string[]; alt: string; index: number } | null>(null);

  // 라이트박스 열기 헬퍼: images(배열)와 image(단일) 조합해서 유니크한 URL 목록 만듦
  const openLightbox = (product: Product) => {
    const arr = Array.isArray(product.images) ? (product.images as string[]).filter((u) => typeof u === "string" && u) : [];
    const combined = arr.length > 0 ? arr : (product.image ? [product.image] : []);
    if (combined.length === 0) return;
    setLightbox({ urls: combined, alt: product.name, index: 0 });
  };

  const lightboxPrev = () => setLightbox((cur) => cur ? { ...cur, index: (cur.index - 1 + cur.urls.length) % cur.urls.length } : cur);
  const lightboxNext = () => setLightbox((cur) => cur ? { ...cur, index: (cur.index + 1) % cur.urls.length } : cur);

  // 키보드: ESC 닫기 · ← → 넘기기
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowLeft") lightboxPrev();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault(); // 스페이스바 페이지 스크롤 방지
        lightboxNext();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  useEffect(() => {
    const page = Number(searchParams.get("page")) || 1;
    const size = Number(searchParams.get("size")) || 50;
    const cat = searchParams.get("cat") || "전체";
    const sub = searchParams.get("sub") || "";
    const search = searchParams.get("search") || "";

    setCurrentPage(page);
    setPageSize(size);
    setSelectedCategory(cat);
    setSelectedSubCategory(sub);
    setSearchKeyword(search);
    setSearchInput(search);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 50) params.set("size", String(pageSize));
    if (selectedCategory !== "전체") params.set("cat", selectedCategory);
    if (selectedSubCategory) params.set("sub", selectedSubCategory);
    if (searchKeyword) params.set("search", searchKeyword);

    const newUrl = params.toString() ? "/products?" + params.toString() : "/products";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedCategory, selectedSubCategory, searchKeyword]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, selectedSubCategory, currentPage, pageSize, searchKeyword, imageFilter]);

  // 카테고리 DB 조회 · 최상위 + 하위 전부 · 한국어 표시 (필터 값은 name_ja)
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

  // 최상위 카테고리만 (첫 줄에 노출)
  const topCategories = useMemo(() => categories.filter((c) => c.parent_id === null), [categories]);
  // 현재 선택된 최상위의 하위 카테고리 (두 번째 줄)
  const subCategoriesOfSelected = useMemo(() => {
    if (selectedCategory === "전체") return [];
    const parent = categories.find((c) => c.parent_id === null && c.name_ja === selectedCategory);
    if (!parent) return [];
    return categories.filter((c) => c.parent_id === parent.id);
  }, [categories, selectedCategory]);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);

    let query = supabase.from("products").select("*", { count: "exact" });

    if (selectedCategory !== "전체") {
      query = query.eq("category", selectedCategory);
      if (selectedSubCategory) {
        query = query.eq("sub_category", selectedSubCategory);
      }
    }

    if (searchKeyword) {
      query = query.or(
        "name.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%"
      );
    }

    // 이미지 필터 · 미첨부 = image NULL & images NULL · 첨부 = image NOT NULL
    if (imageFilter === "missing") {
      query = query.is("image", null);
    } else if (imageFilter === "attached") {
      query = query.not("image", "is", null);
    }

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) {
      console.error("상품 조회 실패:", error);
      setFetchError(error.message || "상품 목록을 불러오지 못했습니다.");
    } else {
      setProductList(data || []);
      setTotalCount(count || 0);
      // 페이지 갱신 시 이번 페이지에 없는 선택 정리
      setSelectedIds((prev) => {
        const nextIds = new Set(prev);
        const currentIds = new Set((data || []).map((p) => p.id));
        for (const id of Array.from(prev)) {
          if (!currentIds.has(id)) nextIds.delete(id);
        }
        return nextIds;
      });
    }
    setLoading(false);
  };

  const formatDateTime = (raw?: string | null) => {
    if (!raw) return "-";
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "-";
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  };

  const formatPrice = (price: number | string) => {
    const n = Number(price);
    return (Number.isFinite(n) ? n : 0).toLocaleString("ko-KR") + "원";
  };

  // ── 선택 ─────────────────────────────────────────
  const allChecked =
    productList.length > 0 && productList.every((p) => selectedIds.has(p.id));
  const someChecked =
    !allChecked && productList.some((p) => selectedIds.has(p.id));

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        productList.forEach((p) => next.delete(p.id));
      } else {
        productList.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // ── 단건 삭제 ────────────────────────────────────
  const handleDelete = (id: number) => {
    setPendingDeleteTargets([id]);
    setShowDelete(true);
  };

  // ── 벌크 삭제 ────────────────────────────────────
  const handleBulkDelete = () => {
    setPendingDeleteTargets(Array.from(selectedIds));
    setShowDelete(true);
  };

  const confirmDelete = async () => {
    if (pendingDeleteTargets.length === 0) return;
    const { error } = await supabase
      .from("products")
      .delete()
      .in("id", pendingDeleteTargets);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setShowDelete(false);
    setPendingDeleteTargets([]);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      pendingDeleteTargets.forEach((id) => next.delete(id));
      return next;
    });
    fetchProducts();
  };

  // ── 상태 변경 (단건·벌크 공용) ─────────────────
  const toggleStatus = async (id: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    const { error } = await supabase
      .from("products")
      .update({ is_active: newStatus })
      .eq("id", id);
    if (error) {
      alert("상태 변경 실패: " + error.message);
      return;
    }
    setProductList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: newStatus } : p))
    );
  };

  const handleBulkActive = async (active: boolean) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("products")
      .update({ is_active: active })
      .in("id", ids);
    if (error) {
      alert("상태 변경 실패: " + error.message);
      return;
    }
    setProductList((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, is_active: active } : p))
    );
  };

  const handleBulkCategory = async (category: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .from("products")
      .update({ category })
      .in("id", ids);
    if (error) {
      alert("카테고리 변경 실패: " + error.message);
      return;
    }
    setProductList((prev) =>
      prev.map((p) => (ids.includes(p.id) ? { ...p, category } : p))
    );
  };

  // ── 인라인 편집 저장 ─────────────────────────────
  const saveField = async (id: number, field: keyof Product, value: unknown) => {
    const { error } = await supabase
      .from("products")
      .update({ [field]: value })
      .eq("id", id);
    if (error) throw error;
    setProductList((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  // ── Excel 내보내기 · 「Excel로 일괄업로드」와 동일 양식 · 편집 후 재업로드 가능 ──
  const exportXlsx = async (rows: Product[]) => {
    // 카테고리 트리 (상위 → 하위) · 종속 드롭다운용
    const { data: catData } = await supabase.from("categories").select("id, name_ko, parent_id").order("id");
    const list = (catData || []) as Array<{ id: number; name_ko: string | null; parent_id: number | null }>;
    const tops = list.filter((c) => c.parent_id === null);
    const categoryTree = tops
      .filter((t) => t.name_ko)
      .map((t) => ({
        top: t.name_ko as string,
        subs: list.filter((c) => c.parent_id === t.id && c.name_ko).map((c) => c.name_ko as string),
      }));
    const exportRows = rows.map((p) => ({
      name_ko: p.name_ko || p.name || "",
      price: typeof p.price === "number" ? p.price : Number(p.price) || null,
      original_price: typeof p.original_price === "number" ? p.original_price : (p.original_price ? Number(p.original_price) : null),
      category_ko: p.category_ko || "",
      sub_category_ko: p.sub_category_ko || "",
      description_ko: p.description_ko || "",
      category: p.category || "",
      sub_category: p.sub_category || "",
    }));
    await exportProductsToXlsx(exportRows, { categoryTree });
  };

  // 전체 Excel 내보내기 · 현재 필터/검색 조건 유지 · 페이지네이션 무시 · 전체 조회
  const handleExportAll = async () => {
    let query = supabase.from("products").select("*");
    if (selectedCategory !== "전체") {
      query = query.eq("category", selectedCategory);
      if (selectedSubCategory) query = query.eq("sub_category", selectedSubCategory);
    }
    if (searchKeyword) {
      query = query.or(
        "name.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%"
      );
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(5000);
    if (error) {
      alert("엑셀 내려받기가 실패했어요.\n오류 내용: " + error.message);
      return;
    }
    await exportXlsx((data as Product[]) || []);
  };
  const handleExportSelected = () =>
    exportXlsx(productList.filter((p) => selectedIds.has(p.id)));

  // ── CSV 업로드 ───────────────────────────────────
  // ── 검색·카테고리·페이지 핸들러 ─────────────────
  const handleSearch = () => {
    setSearchKeyword(searchInput);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setSelectedSubCategory(""); // 최상위 변경 시 하위 초기화
    setCurrentPage(1);
    setSearchKeyword("");
    setSearchInput("");
  };

  const handleSubCategoryChange = (sub: string) => {
    setSelectedSubCategory(sub);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);
  const returnQuery =
    "page=" +
    currentPage +
    "&size=" +
    pageSize +
    "&cat=" +
    encodeURIComponent(selectedCategory) +
    (searchKeyword ? "&search=" + encodeURIComponent(searchKeyword) : "");

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            총 {totalCount}개 상품 중 {startIndex}-{endIndex}번
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportAll}
            className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
            title="현재 목록을 엑셀로 내려받아요 · 상품 일괄 등록 양식과 같아서 편집 후 다시 올릴 수 있어요"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" />
              <path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" />
            </svg>
            엑셀 내려받기
          </button>
          {/* 일괄등록 · 완성 후 전 환경 노출 (관리자 실무 편의) */}
          <Link
            href="/products/excel-import"
            className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition flex items-center gap-1.5"
            title="엑셀 파일(xlsx, csv)로 여러 상품을 한꺼번에 등록해요 · 상품 이미지도 함께 연결할 수 있어요"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" />
              <path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" />
            </svg>
            엑셀로 한꺼번에 등록
          </Link>
          <Link
            href="/products/bulk-new"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="여러 상품을 한 페이지에서 동시에 등록 (이미지 포함)"
          >
            📦 일괄 등록
          </Link>
          <Link
            href="/products/new"
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
          >
            + 상품 등록
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex flex-col gap-3">
          {/* 카테고리 필터 · 드롭다운 + 검색 (100+ 대응 · 크림디자인팀 v3) */}
          <CategoryFilter
            language={language}
            categories={[{ id: 0, name_ja: "全体", name_ko: "전체", parent_id: null }, ...topCategories]}
            selected={selectedCategory}
            onChange={handleCategoryChange}
            label="카테고리"
            allLabel="전체"
          />

          {/* 하위 카테고리 필터 · 최상위 선택 시 · 개수 적을 땐 pill · 많으면 드롭다운 자동 */}
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

          {/* 이미지 첨부 상태 필터 */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs font-medium text-gray-500 whitespace-nowrap">이미지</span>
            {[
              { v: "all" as const, ko: "전체" },
              { v: "missing" as const, ko: "미첨부", color: "red" },
              { v: "attached" as const, ko: "첨부됨", color: "emerald" },
            ].map((opt) => (
              <button
                key={opt.v}
                onClick={() => { setImageFilter(opt.v); setCurrentPage(1); }}
                className={`px-3 py-1 text-xs rounded-full border transition ${
                  imageFilter === opt.v
                    ? opt.color === "red"
                      ? "bg-red-500 text-white border-red-500"
                      : opt.color === "emerald"
                        ? "bg-emerald-500 text-white border-emerald-500"
                        : "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.ko}
              </button>
            ))}
            {imageFilter === "missing" && (
              <Link
                href="/products/excel-import"
                className="ml-2 text-xs text-[var(--color-brand-dk)] hover:text-[var(--color-brand)] underline"
              >
                → 엑셀 등록 화면에서 상품 이미지 연결하기
              </Link>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-1">
            {/* 검색 · 브랜드 focus 링 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
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

            {/* 보기 모드 · 간편 (기존 · 핵심 컬럼만) / 상세 (등록방식 · 등록일/수정일 포함) */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">보기</span>
              <div className="inline-flex items-center bg-white rounded-full p-0.5 border border-gray-200 shadow-sm" role="group" aria-label="보기 모드 전환">
                <button
                  onClick={() => setViewMode("simple")}
                  className={`px-3 py-1 text-xs rounded-full transition-all font-medium ${
                    viewMode === "simple"
                      ? "bg-[var(--color-brand)] text-white shadow-sm"
                      : "text-gray-500 hover:text-[var(--color-brand-dk)]"
                  }`}
                  title="간편 · 기본 컬럼만 표시"
                >
                  간편
                </button>
                <button
                  onClick={() => setViewMode("detail")}
                  className={`px-3 py-1 text-xs rounded-full transition-all font-medium flex items-center gap-1 ${
                    viewMode === "detail"
                      ? "bg-[var(--color-brand)] text-white shadow-sm"
                      : "text-gray-500 hover:text-[var(--color-brand-dk)]"
                  }`}
                  title="상세 · 등록방식/등록일/수정일 등 확장 컬럼 포함"
                >
                  상세
                </button>
              </div>
            </div>

            {/* 표시 개수 · 브랜드 활성 */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 whitespace-nowrap">표시</span>
              <div className="inline-flex items-center bg-white rounded-full p-0.5 border border-gray-200 shadow-sm">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
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

      {/* Fetch Error Banner */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-4 flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">상품 목록을 불러오지 못했습니다.</span>
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

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : productList.length === 0 ? (
          <div className="p-8 text-center text-gray-500">등록된 상품이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                    aria-label="현재 페이지 전체 선택"
                  />
                </th>
                <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 tracking-wider w-16">
                  No.
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">
                  상품
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">
                  카테고리
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">
                  가격
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">
                  재고
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">
                  상태
                </th>
                {viewMode === "detail" && (
                  <>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap">
                      등록방식
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider whitespace-nowrap">
                      등록일 / 수정일
                    </th>
                  </>
                )}
                <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 tracking-wider w-28 border-l border-gray-100">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {productList.map((product, index) => {
                const checked = selectedIds.has(product.id);
                return (
                  <tr
                    key={product.id}
                    className={`hover:bg-gray-50 ${checked ? "bg-yellow-50 hover:bg-yellow-100" : ""}`}
                  >
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(product.id)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        aria-label={`${product.name} 선택`}
                      />
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-gray-500">
                        {startIndex + index}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openLightbox(product); }}
                          className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 group cursor-zoom-in hover:ring-2 hover:ring-gray-400 transition"
                          title="클릭하면 크게 보기"
                          aria-label={`${product.name} 이미지 크게 보기`}
                        >
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            unoptimized
                            className="object-cover"
                          />
                          {/* hover 시 돋보기 아이콘 힌트 */}
                          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition text-white text-lg">🔍</span>
                        </button>
                        <div className="ml-4">
                          {/* 한 언어만 명확 노출 · 반대 언어는 툴팁으로 참고 */}
                          <p className="text-sm font-medium text-gray-900" title={language === "ko" ? (product.name_ja || product.name || "") : (product.name_ko || "")}>{pickName(product)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600" title={language === "ko" ? (product.category_ja || product.category) : (product.category_ko || "")}>{pickCategory(product)}</span>
                    </td>
                    <td className="px-6 py-4">
                      <InlineEditCell
                        value={product.price}
                        type="number"
                        min={0}
                        format={(v) => formatPrice(v)}
                        onSave={(v) => saveField(product.id, "price", Number(v))}
                      />
                      {product.original_price && (
                        <p className="text-xs text-gray-400 line-through mt-0.5">
                          {formatPrice(product.original_price)}
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <InlineEditCell
                        value={product.stock ?? 0}
                        type="number"
                        min={0}
                        suffix="개"
                        format={(v) => String(v)}
                        onSave={(v) => saveField(product.id, "stock", Number(v))}
                        className={
                          (product.stock || 0) === 0
                            ? "text-red-600"
                            : (product.stock || 0) <= 10
                              ? "text-yellow-600"
                              : "text-gray-600"
                        }
                      />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleStatus(product.id, product.is_active ?? true)}
                        className={`px-2 py-1 text-xs rounded-full ${
                          product.is_active !== false
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {product.is_active !== false ? "판매중" : "판매중지"}
                      </button>
                    </td>
                    {viewMode === "detail" && (
                      <>
                        {/* 등록방식 · 색상 배지 · 관리자 즉시 인지 */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {(() => {
                            const src = product.source || "-";
                            const badge = src === "일반" ? "bg-blue-50 text-blue-700 border-blue-200"
                              : src === "일괄" ? "bg-purple-50 text-purple-700 border-purple-200"
                              : src === "CSV" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-gray-50 text-gray-500 border-gray-200";
                            return (
                              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge}`}>
                                {src}
                              </span>
                            );
                          })()}
                        </td>
                        {/* 등록일 / 수정일 · YYYY-MM-DD HH:mm:ss */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-[11px] text-gray-500 leading-tight font-mono">
                            <div>등록 · {formatDateTime(product.created_at)}</div>
                            <div className="text-gray-400 mt-0.5">수정 · {formatDateTime(product.updated_at)}</div>
                          </div>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-4 text-center border-l border-gray-50">
                      <div className="flex items-center justify-center gap-1">
                        <Link
                          href={`/products/${product.id}?return=${encodeURIComponent(returnQuery)}`}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="편집"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </Link>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center mt-6 gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {"<<"}
          </button>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {"<"}
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                className={`px-3 py-2 text-sm rounded ${
                  currentPage === pageNum
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:bg-gray-100"
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
          >
            {">"}
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {">>"}
          </button>
        </div>
      )}

      {/* ── 벌크 액션 바 ──────────────────────────── */}
      <BulkActionBar
        count={selectedIds.size}
        categories={topCategories.map(c => c.name_ja)}
        onDelete={handleBulkDelete}
        onToggleActive={handleBulkActive}
        onChangeCategory={handleBulkCategory}
        onExportCsv={handleExportSelected}
        onBulkEdit={() => router.push(`/products/bulk-edit?ids=${Array.from(selectedIds).join(",")}`)}
        onClear={clearSelection}
      />

      {/* ── 삭제 확인 모달 ────────────────────────── */}
      <DeleteConfirmModal
        open={showDelete}
        count={pendingDeleteTargets.length}
        onClose={() => {
          setShowDelete(false);
          setPendingDeleteTargets([]);
        }}
        onConfirm={confirmDelete}
      />

      {/* ── 이미지 라이트박스 (썸네일 확대 · 다중 이미지 슬라이더) ───────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
        >
          {/* 상단 정보 바: 상품명 + 카운터 + 닫기 */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent z-[101]" onClick={(e) => e.stopPropagation()}>
            <div className="text-white">
              <p className="text-sm font-medium truncate max-w-[60vw]">{lightbox.alt}</p>
              <p className="text-[11px] text-white/60 mt-0.5">{lightbox.index + 1} / {lightbox.urls.length} · ESC · ← → · Space</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
              className="w-10 h-10 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center text-xl backdrop-blur transition"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {/* 좌측 화살표 · 이미지 하나면 숨김 */}
          {lightbox.urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
              className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-2xl backdrop-blur transition z-[101]"
              aria-label="이전 이미지"
            >
              ‹
            </button>
          )}

          {/* 우측 화살표 */}
          {lightbox.urls.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
              className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-2xl backdrop-blur transition z-[101]"
              aria-label="다음 이미지"
            >
              ›
            </button>
          )}

          {/* 메인 이미지 */}
          <div
            className="flex items-center justify-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lightbox.urls[lightbox.index]}
              src={lightbox.urls[lightbox.index]}
              alt={`${lightbox.alt} ${lightbox.index + 1}`}
              className="max-w-[85vw] max-h-[75vh] object-contain rounded shadow-2xl transition-opacity duration-150"
            />
          </div>

          {/* 하단 썸네일 스트립 · 이미지 2장 이상일 때만 */}
          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto py-2 px-4 bg-black/40 rounded-lg backdrop-blur" onClick={(e) => e.stopPropagation()}>
              {lightbox.urls.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setLightbox((cur) => cur ? { ...cur, index: i } : cur)}
                  className={`relative w-14 h-14 flex-shrink-0 rounded overflow-hidden transition ${i === lightbox.index ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}
                  aria-label={`${i + 1}번째 이미지로 이동`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
