"use client";

// 매장 화면 관리 · 실시간 인라인 미리보기
// - 실제 shop 페이지를 iframe으로 임베드 · 100% 정확한 렌더링
// - PC 모드: iframe을 1280px 폭으로 렌더 → CSS scale로 컨테이너에 맞춤 (모바일 반응형 오작동 방지)
// - 모바일 모드: iframe 390px 폭 (실제 폰 뷰포트)
// - config 변경 350ms debounce → iframe 리로드 (깜빡임 최소화)

import { useEffect, useMemo, useRef, useState } from "react";
import type { ShopUiConfig } from "@/lib/shopUiSchema";
import { getShopUrl } from "@/lib/shopUrl";

type MainSection = "promoBar" | "header" | "hero" | "benefits" | "categories" | "footer";

interface Props {
  config: ShopUiConfig;
  device: "desktop" | "mobile";
  page: "list" | "detail" | "mainTop";
  sampleProductId?: number | null;
  /** 메인 편집 시 스포트라이트 대상 · 부모가 관리 · shop iframe에도 postMessage로 전달 */
  section?: MainSection | null;
  /** shop iframe 안에서 사장님이 섹션 클릭 시 · 부모에 알림 */
  onSectionClick?: (s: MainSection) => void;
}

// shop URL · 런타임 자동 감지 (매장 PC 등 · 별도 설정 없이 동작)
const PC_VIEWPORT_WIDTH = 1280; // PC 표준 폭 · Tailwind lg: 이상 미디어쿼리 정상 발동
const PC_VIEWPORT_HEIGHT = 900;
const MOBILE_VIEWPORT_WIDTH = 390;
const MOBILE_VIEWPORT_HEIGHT = 844;

function encodeConfig(config: ShopUiConfig): string {
  try {
    const json = JSON.stringify(config);
    const bytes = new TextEncoder().encode(json);
    let bin = "";
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_");
  } catch {
    return "";
  }
}

export default function ShopPreview({ config, device, page, sampleProductId, section, onSectionClick }: Props) {
  const isMobile = device === "mobile";
  const [debouncedConfig, setDebouncedConfig] = useState<ShopUiConfig>(config);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedConfig(config), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [config]);

  const src = useMemo(() => {
    const encoded = encodeConfig(debouncedConfig);
    const path = page === "detail" && sampleProductId ? `/product/${sampleProductId}` : "/";
    const params = new URLSearchParams({
      preview: "draft",
      device,
      c: encoded,
      innerFrame: "1",
      previewPage: page, // shop이 어느 화면 편집 중인지 알고 · 관련 영역만 노출
    });
    // 메인 편집 미리보기 · 관리자가 편집한 한국어 원본 그대로 검수하도록 강제 한국어
    if (page === "mainTop") params.set("forceLang", "ko");
    if (section) params.set("previewSection", section);
    return `${getShopUrl()}${path}?${params.toString()}`;
  }, [debouncedConfig, device, page, sampleProductId, section]);

  // iframe · shop에서 섹션 클릭 시 postMessage 수신 · 부모 콜백 호출
  useEffect(() => {
    if (!onSectionClick) return;
    const onMsg = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "shop-section-click" && typeof e.data.section === "string") {
        const s = e.data.section as MainSection;
        onSectionClick(s);
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onSectionClick]);

  // 부모의 section이 바뀔 때 · iframe 안 shop에도 실시간 통보 (URL 재로드 없이)
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (!iframeRef.current) return;
    try {
      iframeRef.current.contentWindow?.postMessage({ type: "shop-set-section", section }, "*");
    } catch {}
  }, [section]);

  // PC 모드에서 · wrapper 폭 감지해 scale 자동 계산
  // 콜백 ref · device 전환 시 wrapper가 언마운트/재마운트되어도 · 새 DOM에 옵저버 재부착됨
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [wrapperWidth, setWrapperWidth] = useState(800);
  useEffect(() => {
    if (!wrapperEl) return;
    // 즉시 폭 측정 (옵저버 첫 콜백 전에도 값 세팅)
    setWrapperWidth(wrapperEl.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWrapperWidth(e.contentRect.width);
    });
    ro.observe(wrapperEl);
    return () => ro.disconnect();
  }, [wrapperEl]);

  if (isMobile) {
    // 모바일 · 실제 폰 뷰포트 그대로 (축소 없음 · 폭 390px 고정)
    return (
      <div className="bg-white rounded-xl shadow-lg overflow-hidden mx-auto w-[390px]">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <div className="ml-2 flex-1 text-[10px] text-gray-500 truncate">
            {page === "list" ? "cookiesshop.vercel.app" : `cookiesshop.vercel.app/product/${sampleProductId || "?"}`}
          </div>
          <div className="text-[9px] text-gray-400">📱 390px</div>
        </div>
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          width={MOBILE_VIEWPORT_WIDTH}
          height={MOBILE_VIEWPORT_HEIGHT}
          style={{ border: "none", display: "block" }}
          title="매장 화면 실시간 미리보기 (모바일)"
        />
      </div>
    );
  }

  // PC · 실제 PC 뷰포트 (1280×900) 로 렌더 후 · wrapper 폭에 맞춰 축소
  const scale = Math.min(1, wrapperWidth / PC_VIEWPORT_WIDTH);
  const displayedHeight = PC_VIEWPORT_HEIGHT * scale;

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden mx-auto w-full">
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <div className="ml-2 flex-1 text-[10px] text-gray-500 truncate">
          {page === "list" ? "cookiesshop.vercel.app" : `cookiesshop.vercel.app/product/${sampleProductId || "?"}`}
        </div>
        <div className="text-[9px] text-gray-400">🖥 PC · {PC_VIEWPORT_WIDTH}px ({Math.round(scale * 100)}% 축소 미리보기)</div>
      </div>
      <div
        ref={wrapperRef}
        style={{ height: displayedHeight, overflow: "hidden", position: "relative", width: "100%" }}
      >
        <iframe
          ref={iframeRef}
          key={src}
          src={src}
          width={PC_VIEWPORT_WIDTH}
          height={PC_VIEWPORT_HEIGHT}
          style={{
            border: "none",
            display: "block",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
          title="매장 화면 실시간 미리보기 (PC)"
        />
      </div>
    </div>
  );
}
