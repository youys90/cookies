"use client";

// 관리자 미리보기 iframe 안에서 · 사장님이 특정 영역 클릭하면 · 부모 (customize 페이지) 로 postMessage
// - shop 원본 링크는 편집 중 · 이동 안 되게 e.preventDefault
// - 사장님 요구 · 미리보기 클릭 → 우측 설정 패널 표시 (devtools inspector 스타일)

// [무력화 상태] useEffect import는 재활성화 시 필요 · 지금은 미사용
// import { useEffect } from "react";
import { useShopUi } from "@/contexts/ShopUiContext";

export default function SectionClickTracker() {
  // [2026-08 사장님 지시 · 무력화]
  // 라이브 미리보기 클릭 시 편집 패널이 갑자기 다른 화면으로 강제 전환되어 · 편집 흐름 깨짐
  // (예: 상품 목록 편집 중에 우측 미리보기의 카테고리 아이콘 클릭 시 「메인」으로 이동)
  // → 클릭 감지/postMessage 발동 로직 전체 무력화
  // → 배선(SectionClickTracker 컴포넌트 · data-section 태그 · 부모 리스너)은 남겨둠
  //    · 다음에 PPT식 인라인 편집기 붙일 때 다시 활성화 예정
  // 기존 로직은 참조용 주석 유지
  useShopUi(); // 훅 순서 유지 (의도적 no-op)
  return null;

  /*
  const { isInnerFrame } = useShopUi();
  useEffect(() => {
    if (!isInnerFrame) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const sectionEl = target.closest("[data-section]") as HTMLElement | null;
      if (!sectionEl) return;
      const section = sectionEl.getAttribute("data-section");
      if (!section) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        window.parent.postMessage({ type: "shop-section-click", section }, "*");
      } catch {}
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [isInnerFrame]);
  return null;
  */
}
