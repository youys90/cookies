"use client";

export default function OrdersPage() {
  // 주문 기능은 추후 구현 예정
  // orders 테이블 생성 및 연동 필요

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">주문 관리</h1>
        <p className="text-sm text-gray-500 mt-1">총 0건</p>
      </div>

      {/* Empty State */}
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-gray-500 mb-2">주문 내역이 없습니다</p>
        <p className="text-sm text-gray-400">주문 기능은 준비중입니다</p>
      </div>
    </div>
  );
}
