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
            // 모던 UTF-8 안전 Base64 디코딩
            const bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
            const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
            const json = new TextDecoder().decode(bytes);
            const cfg = JSON.parse(json);
            setConfig(mergeWithDefaults(cfg));
            setIsPreview(true);
            setLoaded(true);
            console.log("[shop preview] URL c 파라미터로 config 로드 성공", cfg);
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
        <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-white shadow-lg">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 py-2">
            <div className="flex items-center gap-2 font-bold text-sm">
              <span className="animate-pulse">🔍</span>
              <span>미리보기 모드</span>
              <span className="text-amber-100">·</span>
              <span>{previewDevice === "mobile" ? "📱 모바일 (390px)" : "🖥 PC"}</span>
            </div>
            <div className="text-[11px] text-amber-100">
              편집 중 화면입니다 · 실제 매장에는 아직 반영되지 않았어요
            </div>
          </div>
        </div>
      )}
      {/* 모바일 미리보기 · 실제 매장은 원래대로 렌더 · 폭만 안내 */}
      {isPreview && previewDevice === "mobile" && (
        <div className="fixed top-11 left-1/2 -translate-x-1/2 z-40 px-3 py-1 bg-blue-500 text-white text-[10px] font-medium rounded-full shadow pointer-events-none">
          📱 진짜 모바일 화면으로 보려면 · 브라우저 창을 좁게 조정하거나 · 개발자 도구 (F12) → 모바일 뷰
        </div>
      )}
      {children}
    </ShopUiCtx.Provider>
  );
}
