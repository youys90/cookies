"use client";

// 관리자 미리보기 iframe 안에서 · 사장님이 특정 영역 클릭하면 · 부모 (customize 페이지) 로 postMessage
// - shop 원본 링크는 편집 중 · 이동 안 되게 e.preventDefault
// - 사장님 요구 · 미리보기 클릭 → 우측 설정 패널 표시 (devtools inspector 스타일)

import { useEffect } from "react";
import { useShopUi } from "@/contexts/ShopUiContext";

export default function SectionClickTracker() {
  const { isInnerFrame } = useShopUi();

  useEffect(() => {
    if (!isInnerFrame) return; // 실제 매장에선 아무것도 안 함
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const sectionEl = target.closest("[data-section]") as HTMLElement | null;
      if (!sectionEl) return;
      const section = sectionEl.getAttribute("data-section");
      if (!section) return;
      // 원본 이동/제출 막고 · 부모로 알림
      e.preventDefault();
      e.stopPropagation();
      try {
        window.parent.postMessage({ type: "shop-section-click", section }, "*");
      } catch {}
    };
    // capture=true · Link 등의 기본 동작보다 먼저 잡음
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [isInnerFrame]);

  return null;
}
