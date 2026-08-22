"use client";

// 모바일 미리보기 전용 페이지 · iframe 안에 실제 shop을 폭 390px로 담아
// 진짜 모바일 뷰포트로 렌더링됨 · Tailwind md:* 등 미디어쿼리 정확히 작동

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function MobilePreviewInner() {
  const sp = useSearchParams();
  const c = sp.get("c") || "";
  const targetPath = sp.get("path") || "/";
  const inner = new URLSearchParams({
    preview: "draft",
    device: "mobile",
    c,
  });
  // 「미리보기 (새 탭)」 은 실제 매장 그대로 보여야 함 · innerFrame 파라미터 안 붙임 (헤더/마키/공지 다 노출)
  const src = `${targetPath}?${inner.toString()}`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start py-6 gap-3">
      <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
        <span className="px-3 py-1 bg-amber-500 text-white rounded-full shadow">
          📱 모바일 미리보기 · 뷰포트 390px
        </span>
        <span className="text-gray-500">진짜 폰과 동일한 화면</span>
      </div>
      <iframe
        src={src}
        width={390}
        height={844}
        className="border border-gray-300 bg-white shadow-2xl rounded-2xl"
      />
      <p className="text-[11px] text-gray-500 max-w-md text-center">
        관리자에서 편집한 값이 iframe 안에 실시간 반영됩니다.<br />
        실제 매장 (URL에 preview 없이 접속) 에는 저장 후에만 반영돼요.
      </p>
    </div>
  );
}

export default function MobilePreviewPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-400">불러오는 중...</div>}>
      <MobilePreviewInner />
    </Suspense>
  );
}
