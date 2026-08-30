"use client";

// 매장 화면 UI 설정 컨텍스트 · 활성 프리셋 자동 로드
// - 서버 저장된 프리셋 · anon SELECT
// - ?preview=draft URL 파라미터 · sessionStorage.shopUiPreviewDraft에서 관리자 편집 중 config 불러옴
// - 값 없으면 기본값 사용

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { DEFAULT_CONFIG, mergeWithDefaults, type ShopUiConfig } from "@/lib/shopUiSchema";

/** 관리자 「메인」 편집 시 · 스포트라이트 대상 세부 영역 · adm에서 postMessage(shop-set-section)로 전달 */
export type PreviewSection = "promoBar" | "header" | "hero" | "benefits" | "categories" | "footer" | null;

interface Ctx {
  config: ShopUiConfig;
  loaded: boolean;
  isPreview: boolean;
  previewDevice: "desktop" | "mobile";
  /** 관리자 미리보기용 iframe에서 렌더되는 중 · 매장 이외 요소(개발 배너 · 언어 스위처) 숨김 */
  isInnerFrame: boolean;
  /** 미리보기에서 편집 중인 대상 · 관련 영역만 렌더 · 나머지 placeholder */
  previewPage: "list" | "detail" | "mainTop" | null;
  /** 관리자 「메인」 편집 세부 영역 · 스포트라이트 대상 · 해당 영역만 밝게, 다른 영역은 dim 처리 */
  previewSection: PreviewSection;
  /** 「큰 화면 편집」 모드 (adm bigEditor=1) · 편집용 클릭 후크 발동 조건 */
  isBigEditor: boolean;
}

const ShopUiCtx = createContext<Ctx>({ config: DEFAULT_CONFIG, loaded: false, isPreview: false, previewDevice: "desktop", isInnerFrame: false, previewPage: null, previewSection: null, isBigEditor: false });

export function useShopUi() { return useContext(ShopUiCtx); }

export function ShopUiProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [isInnerFrame, setIsInnerFrame] = useState(false);
  const [previewPage, setPreviewPage] = useState<"list" | "detail" | "mainTop" | null>(null);
  const [previewSection, setPreviewSection] = useState<PreviewSection>(null);
  const [isBigEditor, setIsBigEditor] = useState(false);

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
      // 「큰 화면 편집」 모드 · 클릭 차단 리스너 비활성 조건 · react-moveable 편집 클릭 통과용
      if (params.get("bigEditor") === "1") setIsBigEditor(true);
      if (pv === "list" || pv === "detail" || pv === "mainTop") setPreviewPage(pv);
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

  // 사장님 지시 · innerFrame(관리자 미리보기 iframe) 상태일 때 · 링크 이동/클릭 실행/form submit 만 차단
  // - hover · cursor · 스크롤 · 라이브 편집 실시간 반영 · 매장 원 시각 효과는 100% 유지
  // - Enter keydown 은 전역 차단 안 함 · 키보드 자체는 정상 · Enter 로 발동되는 실제 기능은:
  //   (1) 검색 form (page.tsx) · 리뷰 password form (StaffPasswordModal) · 리뷰 작성 form (ReviewWriteModal)
  //       → 브라우저 기본 동작으로 submit 이벤트 발동 → 아래 `submit` capture 로 차단됨
  //   (2) submit 안 거치고 Enter 직접 실행하는 곳 (ReviewWriteModal:313 주문조회 · reviews/page.tsx:586 비번확인)
  //       → 모두 모달 안 · 모달을 여는 버튼 클릭이 아래 `click` capture 로 차단되어 애초에 접근 불가
  //   → 따라서 submit + click capture 만으로 실제 기능 실행이 전부 차단됨
  // - 「큰 화면 편집」 모드 (isBigEditor=true) 에서는 · react-moveable 편집 클릭 통과 필요 · 리스너 등록 안 함
  // - 실 매장 방문자 (isInnerFrame=false) → 리스너 등록 안 함 · 원 매장 동작 100%
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isInnerFrame || isBigEditor) return;
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    const onSubmit = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [isInnerFrame, isBigEditor]);

  // adm의 postMessage `shop-set-section` 수신 → 스포트라이트 대상 영역 갱신
  // - innerFrame=1 (관리자 미리보기 iframe) 일 때만 의미 있음 · 실 매장 방문자에는 message 안 옴
  // - shop-section-click 발동 안 함 (사장님 원 요구 아님 · 라이브 화면은 순수 표시)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = (e: MessageEvent) => {
      const d = e.data as { type?: unknown; section?: unknown } | null;
      if (!d || typeof d !== "object" || d.type !== "shop-set-section") return;
      const s = d.section;
      if (
        s === null ||
        s === "promoBar" ||
        s === "header" ||
        s === "hero" ||
        s === "benefits" ||
        s === "categories" ||
        s === "footer"
      ) {
        setPreviewSection(s as PreviewSection);
      }
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, []);

  // previewSection 변경 시 · 대응 영역으로 자동 스크롤 (사장님이 편집 중인 영역이 화면 밖에 있으면 안 보임)
  // - data-section="{key}" 요소를 찾아 scrollIntoView
  // - innerFrame + previewSection이 있어야 실행 (실 매장 방문자에서 오작동 방지)
  useEffect(() => {
    if (!isInnerFrame || !previewSection) return;
    if (typeof document === "undefined") return;
    const el = document.querySelector(`[data-section="${previewSection}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [previewSection, isInnerFrame]);

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
    <ShopUiCtx.Provider value={{ config, loaded, isPreview, previewDevice, isInnerFrame, previewPage, previewSection, isBigEditor }}>
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
