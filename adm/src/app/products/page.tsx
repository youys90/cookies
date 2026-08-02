"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BulkActionBar from "@/components/BulkActionBar";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import InlineEditCell from "@/components/InlineEditCell";
import CsvImportModal from "@/components/CsvImportModal";
import type { CsvImportResult } from "@/components/CsvImportModal";
import { generateCsv, downloadCsv } from "@/lib/csv";

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
  description?: string;
  description_ko?: string;
  description_ja?: string;
  stock?: number;
  is_active?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];

// CSV 템플릿 컬럼 (등록·내보내기 공용)
const CSV_HEADER = [
  "name",
  "name_ko",
  "name_ja",
  "price",
  "original_price",
  "category",
  "sub_category",
  "description",
  "description_ko",
  "description_ja",
  "image",
  "stock",
  "is_active",
];

const CSV_SAMPLE: Record<string, string> = {
  name: "サンプル商品",
  name_ko: "샘플 상품",
  name_ja: "サンプル商品",
  price: "10000",
  original_price: "12000",
  category: "アクセサリー",
  sub_category: "ピアス",
  description: "商品説明",
  description_ko: "상품 설명",
  description_ja: "商品説明",
  image: "https://example.com/image.jpg",
  stock: "10",
  is_active: "true",
};

export default function ProductsPage() {
  const searchParams = useSearchParams();
  const [productList, setProductList] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("cat") || "전체");
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

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
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [pendingDeleteTargets, setPendingDeleteTargets] = useState<number[]>([]);

  useEffect(() => {
    const page = Number(searchParams.get("page")) || 1;
    const size = Number(searchParams.get("size")) || 50;
    const cat = searchParams.get("cat") || "전체";
    const search = searchParams.get("search") || "";

    setCurrentPage(page);
    setPageSize(size);
    setSelectedCategory(cat);
    setSearchKeyword(search);
    setSearchInput(search);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (currentPage !== 1) params.set("page", String(currentPage));
    if (pageSize !== 50) params.set("size", String(pageSize));
    if (selectedCategory !== "전체") params.set("cat", selectedCategory);
    if (searchKeyword) params.set("search", searchKeyword);

    const newUrl = params.toString() ? "/products?" + params.toString() : "/products";
    if (window.location.pathname + window.location.search !== newUrl) {
      window.history.replaceState(null, "", newUrl);
    }
  }, [currentPage, pageSize, selectedCategory, searchKeyword]);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, currentPage, pageSize, searchKeyword]);

  // 카테고리 DB 조회 (지시 15/19: adm은 categories 테이블 관리 체계)
  useEffect(() => {
    const fetchCategories = async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("name_ja, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("카테고리 조회 실패:", error);
        return;
      }
      const names = (data || [])
        .map((c: { name_ja: string | null }) => c.name_ja)
        .filter((n): n is string => !!n);
      setCategories(names);
    };
    fetchCategories();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    setFetchError(null);

    let query = supabase.from("products").select("*", { count: "exact" });

    if (selectedCategory !== "전체") {
      query = query.eq("category", selectedCategory);
    }

    if (searchKeyword) {
      query = query.or(
        "name.ilike.%" + searchKeyword + "%,name_ko.ilike.%" + searchKeyword + "%"
      );
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

  // ── CSV 다운로드 ─────────────────────────────────
  const columns = useMemo(
    () =>
      CSV_HEADER.map((k) => ({
        key: k,
        label: k,
        toCell: (row: Product) => {
          const v = (row as unknown as Record<string, unknown>)[k];
          return v === undefined || v === null ? "" : String(v);
        },
      })),
    []
  );

  const exportCsv = (rows: Product[]) => {
    const csv = generateCsv(rows, columns);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `products_${stamp}.csv`);
  };

  const handleExportAll = () => exportCsv(productList);
  const handleExportSelected = () =>
    exportCsv(productList.filter((p) => selectedIds.has(p.id)));

  // ── CSV 업로드 ───────────────────────────────────
  const handleImport = async (
    rows: Record<string, string>[]
  ): Promise<CsvImportResult> => {
    const ok: number[] = [];
    const failed: { row: number; reason: string }[] = [];

    const chunk = 25;
    for (let i = 0; i < rows.length; i += chunk) {
      const slice = rows.slice(i, i + chunk).map((r) => {
        const rec: Record<string, unknown> = {};
        for (const k of CSV_HEADER) {
          const raw = r[k];
          if (raw === undefined || raw === "") continue;
          if (k === "price" || k === "original_price" || k === "stock") {
            const n = Number(raw);
            if (!Number.isNaN(n)) rec[k] = n;
          } else if (k === "is_active") {
            rec[k] = /^(true|1|yes|y|판매중)$/i.test(raw);
          } else {
            rec[k] = raw;
          }
        }
        // name 필수
        if (!rec.name) rec.name = r.name_ja || r.name_ko || "";
        if (!rec.image) rec.image = "https://placehold.co/400x400";
        if (!rec.price) rec.price = 0;
        return rec;
      });

      try {
        const { data, error } = await supabase
          .from("products")
          .insert(slice)
          .select("id");
        if (error) {
          slice.forEach((_, j) => failed.push({ row: i + j + 2, reason: error.message }));
        } else {
          (data || []).forEach((d) => ok.push(d.id));
        }
      } catch (e) {
        slice.forEach((_, j) =>
          failed.push({ row: i + j + 2, reason: String(e) })
        );
      }
    }

    if (ok.length > 0) fetchProducts();
    return { ok: ok.length, failed };
  };

  // ── 검색·카테고리·페이지 핸들러 ─────────────────
  const handleSearch = () => {
    setSearchKeyword(searchInput);
    setCurrentPage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
    setSearchKeyword("");
    setSearchInput("");
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
            className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="현재 목록을 CSV로 내보내기"
          >
            📤 CSV 내보내기
          </button>
          <button
            onClick={() => setShowCsvImport(true)}
            className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="CSV로 대량 등록"
          >
            📥 CSV 일괄등록
          </button>
          <Link
            href="/products/bulk-new"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            title="여러 상품을 한 페이지에서 동시에 등록"
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
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">카테고리:</span>
            {["전체", ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategoryChange(cat)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  selectedCategory === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="상품명 검색..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 w-48"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              검색
            </button>
            {searchKeyword && (
              <button
                onClick={() => {
                  setSearchKeyword("");
                  setSearchInput("");
                }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
              >
                초기화
              </button>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-auto">
            <span className="text-sm text-gray-500">표시:</span>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <button
                key={size}
                onClick={() => handlePageSizeChange(size)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  pageSize === size
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {size}개씩
              </button>
            ))}
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
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 tracking-wider">
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
                        <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.name_ko || ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">{product.category}</span>
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
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href={`/products/${product.id}?return=${encodeURIComponent(returnQuery)}`}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
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
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
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
        categories={categories}
        onDelete={handleBulkDelete}
        onToggleActive={handleBulkActive}
        onChangeCategory={handleBulkCategory}
        onExportCsv={handleExportSelected}
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

      {/* ── CSV 업로드 모달 ───────────────────────── */}
      <CsvImportModal
        open={showCsvImport}
        onClose={() => setShowCsvImport(false)}
        onImport={handleImport}
        templateHeader={CSV_HEADER}
        templateSample={CSV_SAMPLE}
        title="상품 CSV 일괄 등록"
      />
    </div>
  );
}
