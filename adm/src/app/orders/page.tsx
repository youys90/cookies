"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface OrderItem {
  id: string;
  product_name: string;
  product_image: string | null;
  option_name: string | null;
  price: number;
  additional_price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_line: string;
  status: string;
  total_price: number;
  shipping_fee: number;
  memo: string | null;
  created_at: string;
  order_items: OrderItem[];
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-yellow-100 text-yellow-800" },
  confirmed: { label: "확인", color: "bg-blue-100 text-blue-800" },
  completed: { label: "완료", color: "bg-green-100 text-green-800" },
  cancelled: { label: "취소", color: "bg-red-100 text-red-800" },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        *,
        order_items (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("주문 조회 에러:", error);
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", orderId);

    if (error) {
      console.error("상태 업데이트 에러:", error);
      alert("상태 변경에 실패했습니다.");
    } else {
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return `₩${price.toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">주문 관리</h1>
          <p className="text-sm text-gray-500 mt-1">총 {orders.length}건</p>
        </div>
        <button
          onClick={fetchOrders}
          className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          새로고침
        </button>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 mb-2">주문 내역이 없습니다</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">고객명</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">LINE ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">금액</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일시</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{order.order_number}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{order.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{order.customer_line}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatPrice(order.total_price + order.shipping_fee)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusLabels[order.status]?.color || "bg-gray-100 text-gray-800"}`}>
                      {statusLabels[order.status]?.label || order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(order.created_at)}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      상세보기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 주문 상세 모달 */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">주문 상세</h2>
                  <p className="text-sm text-gray-500 mt-1">{selectedOrder.order_number}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 고객 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">고객 정보</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">이름:</span>
                    <span className="ml-2 text-gray-900">{selectedOrder.customer_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">LINE ID:</span>
                    <span className="ml-2 text-gray-900">{selectedOrder.customer_line}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">주문일시:</span>
                    <span className="ml-2 text-gray-900">{formatDate(selectedOrder.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">상태:</span>
                    <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${statusLabels[selectedOrder.status]?.color}`}>
                      {statusLabels[selectedOrder.status]?.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* 주문 상품 */}
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">주문 상품</h3>
                <div className="space-y-3">
                  {selectedOrder.order_items.map((item) => (
                    <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                      {item.product_image && (
                        <img src={item.product_image} alt={item.product_name} className="w-16 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{item.product_name}</p>
                        {item.option_name && (
                          <p className="text-xs text-gray-500">{item.option_name}</p>
                        )}
                        <p className="text-sm text-gray-700 mt-1">
                          {formatPrice(item.price + item.additional_price)} x {item.quantity}
                        </p>
                      </div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice((item.price + item.additional_price) * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 결제 정보 */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">결제 정보</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">상품 금액</span>
                    <span className="text-gray-900">{formatPrice(selectedOrder.total_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">배송비</span>
                    <span className="text-gray-900">{formatPrice(selectedOrder.shipping_fee)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 font-medium">
                    <span className="text-gray-700">총 결제금액</span>
                    <span className="text-gray-900">{formatPrice(selectedOrder.total_price + selectedOrder.shipping_fee)}</span>
                  </div>
                </div>
              </div>

              {/* 상태 변경 버튼 */}
              <div className="flex gap-2">
                <button
                  onClick={() => updateStatus(selectedOrder.id, "pending")}
                  className={`flex-1 py-2 text-sm rounded-lg ${selectedOrder.status === "pending" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  대기
                </button>
                <button
                  onClick={() => updateStatus(selectedOrder.id, "confirmed")}
                  className={`flex-1 py-2 text-sm rounded-lg ${selectedOrder.status === "confirmed" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  확인
                </button>
                <button
                  onClick={() => updateStatus(selectedOrder.id, "completed")}
                  className={`flex-1 py-2 text-sm rounded-lg ${selectedOrder.status === "completed" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  완료
                </button>
                <button
                  onClick={() => updateStatus(selectedOrder.id, "cancelled")}
                  className={`flex-1 py-2 text-sm rounded-lg ${selectedOrder.status === "cancelled" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
