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
  /** 관리자 미리보기용 iframe에서 렌더되는 중 · 헤더/히어로/공지 등 상단 요소 숨김 */
  isInnerFrame: boolean;
  /** 미리보기에서 편집 중인 대상 · 관련 영역만 강조 · 나머지 placeholder */
  previewPage: "list" | "detail" | "mainTop" | null;
  /** 스포트라이트 · 편집 중인 세부 영역 (메인일 때만 유효) · 이 영역만 밝게 · 나머지 어둡게 */
  previewSection: "promoBar" | "header" | "hero" | "benefits" | "categories" | "footer" | null;
}

const ShopUiCtx = createContext<Ctx>({ config: DEFAULT_CONFIG, loaded: false, isPreview: false, previewDevice: "desktop", isInnerFrame: false, previewPage: null, previewSection: null });

export function useShopUi() { return useContext(ShopUiCtx); }

export function ShopUiProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isInnerFrame, setIsInnerFrame] = useState(false);
  const [previewPage, setPreviewPage] = useState<"list" | "detail" | "mainTop" | null>(null);
  const [previewSection, setPreviewSection] = useState<Ctx["previewSection"]>(null);

  useEffect(() => {
    // 미리보기 모드 우선
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const preview = params.get("preview");
      const device = params.get("device");
      const encoded = params.get("c");
      const inner = params.get("innerFrame");
      const pv = params.get("previewPage");
      if (device === "mobile") setPreviewDevice("mobile");
      if (inner === "1") setIsInnerFrame(true);
      if (pv === "list" || pv === "detail" || pv === "mainTop") setPreviewPage(pv);
      const ps = params.get("previewSection");
      if (ps === "promoBar" || ps === "header" || ps === "hero" || ps === "benefits" || ps === "categories" || ps === "footer") setPreviewSection(ps);
      // 부모(customize) 로부터 실시간 · 섹션 변경 메시지 수신
      const onMsg = (e: MessageEvent) => {
        if (!e.data || typeof e.data !== "object") return;
        if (e.data.type === "shop-set-section") {
          const s = e.data.section;
          if (s === "promoBar" || s === "header" || s === "hero" || s === "benefits" || s === "categories" || s === "footer" || s === null) {
            setPreviewSection(s);
          }
        }
      };
      window.addEventListener("message", onMsg);
      // 정리는 이 useEffect가 다시 안 도니 · 컴포넌트 언마운트에 자동 정리됨
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

  // 스포트라이트 · 선택된 섹션으로 자동 스크롤 (관리자 미리보기 iframe에서만)
  useEffect(() => {
    if (!isInnerFrame || !previewSection || typeof document === "undefined") return;
    // 살짝 지연 · DOM 갱신 대기
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-section="${previewSection}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(t);
  }, [previewSection, isInnerFrame]);

  return (
    <ShopUiCtx.Provider value={{ config, loaded, isPreview, previewDevice, isInnerFrame, previewPage, previewSection }}>
      {isPreview && !isInnerFrame && (
        <>
          {/* 상단 스티키 배너 · 눈에 확 띄는 미리보기 표시 (실제 매장과 오해 방지) */}
          <div className="sticky top-0 z-[100] bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-2xl border-b-4 border-orange-700 animate-pulse-slow">
            <div className="max-w-6xl mx-auto flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2 font-black text-base">
                <span className="text-xl animate-bounce">🔍</span>
                <span className="tracking-widest">MIRIBOGI · 미리보기 · PREVIEW</span>
                <span className="text-amber-100">·</span>
                <span>{previewDevice === "mobile" ? "📱 모바일 (390px)" : "🖥 PC"}</span>
              </div>
              <div className="text-xs font-bold bg-white/20 backdrop-blur border border-white/40 rounded-full px-3 py-1">
                ⚠ 편집 중 화면 · 실제 매장 아님
              </div>
            </div>
          </div>
          {/* 화면 테두리 · 미리보기 상태를 지속 시각화 */}
          <div className="fixed inset-0 pointer-events-none z-[9999] border-4 border-amber-500 animate-pulse-slow" style={{ boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.7)" }} />
          {/* 좌측 하단 플로팅 뱃지 · 사장님 요청 · 「미리보기 화면 입니다」 서브 라벨 */}
          <div className="fixed bottom-4 left-4 z-[9999] bg-amber-500 text-white px-3 py-2 rounded-lg shadow-2xl flex items-center gap-2 border-2 border-white">
            <span className="text-sm font-black">🔍 미리보기</span>
            <span className="text-[10px] opacity-90">미리보기 화면 입니다</span>
          </div>
        </>
      )}
      {/* 모바일 미리보기 · 실제 매장은 원래대로 렌더 · 폭만 안내 */}
      {isPreview && !isInnerFrame && previewDevice === "mobile" && (
        <div className="fixed top-11 left-1/2 -translate-x-1/2 z-40 px-3 py-1 bg-blue-500 text-white text-[10px] font-medium rounded-full shadow pointer-events-none">
          📱 진짜 모바일 화면으로 보려면 · 브라우저 창을 좁게 조정하거나 · 개발자 도구 (F12) → 모바일 뷰
        </div>
      )}
      {children}
    </ShopUiCtx.Provider>
  );
}
