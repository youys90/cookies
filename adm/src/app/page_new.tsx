"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface Product {
  id: number;
  name: string;
  category: string;
  stock?: number;
  is_active?: boolean;
}

export default function Dashboard() {
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [outOfStockCount, setOutOfStockCount] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const { count: total } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    const { count: active } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    const { count: outOfStock } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('stock', 0);

    const { data: lowStock } = await supabase
      .from('products')
      .select('id, name, category, stock, is_active')
      .lte('stock', 10)
      .order('stock', { ascending: true })
      .limit(5);

    setTotalCount(total || 0);
    setActiveCount(active || 0);
    setOutOfStockCount(outOfStock || 0);
    setLowStockProducts(lowStock || []);
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">Cookies 관리자 현황</p>
      </div>

      {loading ? (
        <div className="text-center text-gray-500">로딩 중...</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 상품</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{totalCount}</p>
                </div>
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">활성 {activeCount}개</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">품절 상품</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">{outOfStockCount}</p>
                </div>
                <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">재고 확인 필요</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">총 매출</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">-</p>
                </div>
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">주문 기능 준비중</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">대기 주문</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">-</p>
                </div>
                <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2">주문 기능 준비중</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-gray-900">재고 부족 상품</h2>
                <Link href="/products" className="text-sm text-blue-600 hover:text-blue-700">
                  전체보기 →
                </Link>
              </div>
            </div>
            <div className="p-6">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-gray-500 text-center">재고 부족 상품 없음</p>
              ) : (
                <div className="space-y-4">
                  {lowStockProducts.map((product) => (
                    <div key={product.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.category}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${(product.stock || 0) === 0 ? "text-red-600" : "text-yellow-600"}`}>
                          {product.stock || 0}개
                        </p>
                        <p className="text-xs text-gray-400">재고</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
