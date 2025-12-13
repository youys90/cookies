"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { products as initialProducts, categories, Product } from "@/data/products";

export default function ProductsPage() {
  const [productList, setProductList] = useState<Product[]>(initialProducts);
  const [selectedCategory, setSelectedCategory] = useState("전체");

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  const filteredProducts = selectedCategory === "전체"
    ? productList
    : productList.filter((p) => p.category === selectedCategory);

  const handleDelete = (id: number) => {
    if (confirm("정말 삭제하시겠습니까?")) {
      setProductList((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const toggleStatus = (id: number) => {
    setProductList((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "active" ? "inactive" : "active" }
          : p
      )
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">상품 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {productList.length}개 상품</p>
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
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">카테고리:</span>
          {["전체", ...categories].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
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
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상품</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">카테고리</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">가격</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">재고</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상태</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 tracking-wider">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50">
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
                      <p className="text-xs text-gray-500">{product.nameEn}</p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{product.category}</span>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">{formatPrice(product.price)}</p>
                  {product.originalPrice && (
                    <p className="text-xs text-gray-400 line-through">{formatPrice(product.originalPrice)}</p>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm ${(product.stock || 0) === 0 ? "text-red-600" : (product.stock || 0) <= 10 ? "text-yellow-600" : "text-gray-600"}`}>
                    {product.stock || 0}개
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => toggleStatus(product.id)}
                    className={`px-2 py-1 text-xs rounded-full ${
                      product.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {product.status === "active" ? "판매중" : "판매중지"}
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
      </div>
    </div>
  );
}
