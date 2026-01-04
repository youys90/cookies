"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { categories } from "@/data/products";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  name_ko?: string;
  price: number;
  original_price?: number;
  image: string;
  category: string;
  description?: string;
  stock?: number;
  is_active?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 50, 100];

export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [loading, setLoading] = useState(true);

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, currentPage, pageSize]);

  const fetchProducts = async () => {
    setLoading(true);

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    if (selectedCategory !== "전체") {
      query = query.eq('category', selectedCategory);
    }

    const from = (currentPage - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('상품 조회 실패:', error);
    } else {
      setProductList(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  const handleDelete = async (id: number) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        alert('삭제 실패: ' + error.message);
      } else {
        fetchProducts();
      }
    }
  };

  const toggleStatus = async (id: number, currentStatus: boolean) => {
    const newStatus = !currentStatus;

    const { error } = await supabase
      .from('products')
      .update({ is_active: newStatus })
      .eq('id', id);

    if (error) {
      alert('상태 변경 실패: ' + error.message);
      return;
    }

    setProductList((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, is_active: newStatus } : p
      )
    );
  };

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // 페이지네이션 계산
  const totalPages = Math.ceil(totalCount / pageSize);
  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalCount);

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
        <Link
          href="/products/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 transition-colors"
        >
          + 상품 등록
        </Link>
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
              <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 tracking-wider w-16">No.</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상품</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">카테고리</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">가격</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">재고</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상태</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {productList.map((product, index) => (
              <tr key={product.id} className="hover:bg-gray-50">
                <td className="px-4 py-4 text-center">
                  <span className="inline-flex items-center justify-center w-8 h-8 bg-gray-900 text-white text-xs rounded-full font-medium">
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
                      <p className="text-xs text-gray-500">{product.name_ko || ''}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{product.category}</span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{formatPrice(product.price)}</p>
                  {product.original_price && (
                    <p className="text-xs text-gray-400 line-through">{formatPrice(product.original_price)}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm ${(product.stock || 0) === 0 ? "text-red-600" : (product.stock || 0) <= 10 ? "text-yellow-600" : "text-gray-600"}`}>
                    {product.stock || 0}개
                  </span>
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
                      href={`/products/${product.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </Link>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
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
            {'<<'}
          </button>
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {'<'}
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
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
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
            {'>'}
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-300 disabled:cursor-not-allowed"
          >
            {'>>'}
          </button>
        </div>
      )}
    </div>
  );
}
