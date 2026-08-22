"use client";

// 매장 화면 UI 설정 컨텍스트 · 활성 프리셋 자동 로드
// - 서버 저장된 프리셋 · anon SELECT
// - ?preview=draft URL 파라미터 · sessionStorage.shopUiPreviewDraft에서 관리자 편집 중 config 불러옴
// - 값 없으면 기본값 사용

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CONFIG, mergeWithDefaults, type ShopUiConfig } from "@/lib/shopUiSchema";

interface Ctx {
  config: ShopUiConfig;
  loaded: boolean;
  isPreview: boolean;
  previewDevice: "desktop" | "mobile";
}

const ShopUiCtx = createContext<Ctx>({ config: DEFAULT_CONFIG, loaded: false, isPreview: false, previewDevice: "desktop" });

export function useShopUi() { return useContext(ShopUiCtx); }

export function ShopUiProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");

  useEffect(() => {
    // 미리보기 모드 우선
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get("preview");
      const device = params.get("device");
      const encoded = params.get("c");
      if (device === "mobile") setPreviewDevice("mobile");
      if (preview === "draft") {
        // 1) URL 파라미터 c (Base64) 우선 · adm과 origin이 달라 sessionStorage 불가 시
        if (encoded) {
          try {
            const json = decodeURIComponent(escape(atob(encoded)));
            const cfg = JSON.parse(json);
            setConfig(mergeWithDefaults(cfg));
            setIsPreview(true);
            setLoaded(true);
            return;
          } catch (e) {
            console.error("미리보기 config 디코딩 실패:", e);
          }
        }
        // 2) sessionStorage 폴백 (같은 origin에서 여는 경우)
        try {
          const raw = sessionStorage.getItem("shopUiPreviewDraft");
          if (raw) {
            const parsed = JSON.parse(raw);
            setConfig(mergeWithDefaults(parsed.config));
            if (parsed.device === "mobile") setPreviewDevice("mobile");
            setIsPreview(true);
            setLoaded(true);
            return;
          }
        } catch {}
      }
    }
    // 활성 프리셋 로드
    (async () => {
      const { data } = await supabase
        .from("shop_ui_presets")
        .select("config")
        .eq("is_active", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (data?.config) setConfig(mergeWithDefaults(data.config));
      setLoaded(true);
    })();
  }, []);

  // 문서 root에 CSS 변수 적용
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--shop-list-cols-d", String(config.productList.columnsDesktop));
    root.style.setProperty("--shop-list-cols-m", String(config.productList.columnsMobile));
    root.style.setProperty("--shop-list-gap", `${config.productList.gap}px`);
    root.style.setProperty("--shop-list-radius", `${config.productList.imageBorderRadius}px`);
    root.style.setProperty("--shop-cat-cols-d", String(config.categoryTabs.columnsDesktop));
    root.style.setProperty("--shop-cat-cols-m", String(config.categoryTabs.columnsMobile));
  }, [config]);

  return (
    <ShopUiCtx.Provider value={{ config, loaded, isPreview, previewDevice }}>
      {isPreview && (
        <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 px-4 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-full shadow-lg pointer-events-none">
          🔍 미리보기 모드 · {previewDevice === "mobile" ? "📱 모바일 (390px)" : "🖥 PC"}
        </div>
      )}
      {/* 모바일 미리보기 · 뷰포트 폭 강제 */}
      {isPreview && previewDevice === "mobile" ? (
        <div className="min-h-screen bg-gray-100 flex justify-center py-6">
          <div className="w-[390px] bg-white shadow-2xl overflow-hidden">
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </ShopUiCtx.Provider>
  );
}
