"use client";

import { useState } from "react";
import { orders as initialOrders, products, Order } from "@/data/products";

export default function OrdersPage() {
  const [orderList, setOrderList] = useState<Order[]>(initialOrders);

  const formatPrice = (price: number) => {
    return price.toLocaleString("ko-KR") + "원";
  };

  const getProductName = (productId: number) => {
    return products.find((p) => p.id === productId)?.name || "알 수 없음";
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      shipped: "bg-purple-100 text-purple-800",
      delivered: "bg-green-100 text-green-800",
    };
    const labels: Record<string, string> = {
      pending: "대기",
      confirmed: "확인",
      shipped: "배송중",
      delivered: "완료",
    };
    return (
      <span className={`px-2 py-1 text-xs rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const updateStatus = (orderId: string, newStatus: Order["status"]) => {
    setOrderList((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">주문 관리</h1>
        <p className="text-sm text-gray-500 mt-1">총 {orderList.length}건</p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">주문번호</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">날짜</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">고객</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상품</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">금액</th>
              <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">상태</th>
              <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 tracking-wider">상태변경</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orderList.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-gray-900">{order.id}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600">{order.date}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-900">{order.customer}</span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600">
                    {order.products.map((p, idx) => (
                      <span key={idx}>
                        {getProductName(p.productId)} x{p.quantity}
                        {idx < order.products.length - 1 && ", "}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium text-gray-900">{formatPrice(order.total)}</span>
                </td>
                <td className="px-6 py-4">
                  {getStatusBadge(order.status)}
                </td>
                <td className="px-6 py-4 text-right">
                  <select
                    value={order.status}
                    onChange={(e) => updateStatus(order.id, e.target.value as Order["status"])}
                    className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-gray-400"
                  >
                    <option value="pending">대기</option>
                    <option value="confirmed">확인</option>
                    <option value="shipped">배송중</option>
                    <option value="delivered">완료</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
