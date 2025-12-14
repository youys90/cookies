"use client";

import { useState, useEffect } from "react";

// 개발 DB 프로젝트 ID (cookies-dev)
const DEV_PROJECT_ID = "eftuvzzadxxtxzpgfqom";

export default function DevBanner() {
  const [isDev, setIsDev] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 환경변수에서 Supabase URL 확인
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

    // 개발 DB URL인지 확인
    if (supabaseUrl.includes(DEV_PROJECT_ID)) {
      setIsDev(true);
    }
  }, []);

  // 운영 환경이면 아무것도 표시 안 함
  if (!isDev) return null;

  return (
    <>
      {/* 상단 고정 배너 */}
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-orange-500 text-white text-center py-1 text-xs font-bold tracking-wider">
        ⚠️ 개발 서버 - 테스트 환경 ⚠️
      </div>

      {/* 콘텐츠 여백 (배너 높이만큼) */}
      <div className="h-6" />

      {/* 좌측 하단 플로팅 배지 (닫기 가능) */}
      {isVisible && (
        <div className="fixed bottom-4 left-4 z-[9999] bg-orange-500 text-white px-3 py-2 rounded-lg shadow-lg flex items-center space-x-2">
          <span className="text-sm font-bold">🔧 개발</span>
          <button
            onClick={() => setIsVisible(false)}
            className="text-white/70 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* 페이지 테두리 (항상 보이는 시각적 구분) */}
      <div className="fixed inset-0 pointer-events-none z-[9998] border-4 border-orange-500" />
    </>
  );
}
