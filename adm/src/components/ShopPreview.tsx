"use client";

// 매장 화면 관리 · 실시간 인라인 미리보기
// - 실제 shop 페이지를 iframe으로 임베드 · 100% 정확한 렌더링
// - PC 모드: iframe을 1280px 폭으로 렌더 → CSS scale로 컨테이너에 맞춤 (모바일 반응형 오작동 방지)
// - 모바일 모드: iframe 390px 폭 (실제 폰 뷰포트)
// - config 변경 350ms debounce → iframe 리로드 (깜빡임 최소화)

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ShopUiConfig } from "@/lib/shopUiSchema";
import { getShopUrl } from "@/lib/shopUrl";
import { isCookiesEditClick, type CookiesEditClickRect } from "@/lib/editorPostMessage";

/** 관리자가 편집 중인 「메인」 세부 영역 · shop 스포트라이트 대상 · null이면 스포트라이트 안 함 */
export type PreviewSection = "promoBar" | "header" | "hero" | "benefits" | "categories" | "footer" | null;

interface Props {
  config: ShopUiConfig;
  device: "desktop" | "mobile";
  page: "list" | "detail" | "mainTop";
  sampleProductId?: number | null;
  /** 편집기 오버레이 슬롯 · iframe wrapper 안에 렌더 (scale 자동 전달) · react-moveable 등 절대 좌표 요소 배치용 */
  renderOverlay?: (info: { scale: number }) => ReactNode;
  /** 「메인」 편집 시 · 현재 편집 중인 세부 영역 (스포트라이트 대상) · shop에 postMessage로 전달 */
  section?: PreviewSection;
  /** 「큰 화면 편집」 모드 · shop 링크 이동/클릭 차단 리스너 비활성 (react-moveable 편집 클릭 통과) */
  bigEditor?: boolean;
  /** 「큰 화면 편집」 · shop hero 이미지 클릭 시 · adm이 편집 대상 지정 (target + rect) */
  onElementClick?: (payload: { key: string; index: number; rect: CookiesEditClickRect }) => void;
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

export default function ShopPreview({ config, device, page, sampleProductId, renderOverlay, section, bigEditor, onElementClick }: Props) {
  const isMobile = device === "mobile";
  const [debouncedConfig, setDebouncedConfig] = useState<ShopUiConfig>(config);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 미리보기 iframe · overlay div의 wheel 리스너에서 iframe 안 window에 scrollBy 발동용
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedConfig(config), 350);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [config]);

  // section 변경 시 · shop iframe에 postMessage `shop-set-section` 전달
  // - shop이 스포트라이트 CSS (.shop-section-selected / .shop-section-dimmed)를 적용
  // - iframe load 이후에 보내야 함 · onLoad 시점 + section change 시점 두 곳에서 발동
  const postSection = () => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "shop-set-section", section: section ?? null },
        "*"
      );
    } catch {}
  };
  useEffect(() => {
    postSection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // shop → adm postMessage 수신 · 「큰 화면 편집」 시 shop hero 이미지 클릭 → target 지정
  // - bigEditor 활성 + onElementClick 콜백 있을 때만 등록
  // - event.source가 이 iframe인지 검증 · 다른 iframe/window 메시지 무시
  // - key 문자열 (mainTop.hero.images.{i}) → index 추출 · 콜백 전달
  useEffect(() => {
    if (!bigEditor || !onElementClick) return;
    if (typeof window === "undefined") return;
    const handler = (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;
      if (!iframeWin || event.source !== iframeWin) return; // 다른 iframe 격리
      if (!isCookiesEditClick(event.data)) return;
      const m = /^mainTop\.hero\.images\.(\d+)$/.exec(event.data.key);
      if (!m) return; // 알려진 key 형식이 아니면 무시 (MVP: hero만 대응)
      const index = Number(m[1]);
      if (!Number.isFinite(index) || index < 0) return;
      onElementClick({ key: event.data.key, index, rect: event.data.rect });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [bigEditor, onElementClick]);

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
    // 「큰 화면 편집」 모드 · shop 클릭 차단 리스너 비활성 · react-moveable 편집 클릭 통과
    if (bigEditor) params.set("bigEditor", "1");
    return `${getShopUrl()}${path}?${params.toString()}`;
  }, [debouncedConfig, device, page, sampleProductId, bigEditor]);

  // PC 모드에서 · wrapper 폭 감지해 scale 자동 계산
  // 콜백 ref · device 전환 시 wrapper가 언마운트/재마운트되어도 · 새 DOM에 옵저버 재부착됨
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  // 초기값 · 첫 렌더에 iframe 안 보이지 않도록 최소한의 폭 확보
  const [wrapperWidth, setWrapperWidth] = useState(800);
  useEffect(() => {
    if (!wrapperEl) return;
    // 즉시 폭 측정 · 0이면 무시하고 다음 프레임에 다시 측정 (레이아웃 대기)
    const measure = () => {
      const w = wrapperEl.getBoundingClientRect().width;
      // 0 방어 · width가 0이면 유지 (다음 프레임에 다시 시도)
      if (w > 0) setWrapperWidth(w);
      else requestAnimationFrame(measure);
    };
    measure();
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (w > 0) setWrapperWidth(w);
      }
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
        <div style={{ position: "relative", width: MOBILE_VIEWPORT_WIDTH, height: MOBILE_VIEWPORT_HEIGHT }}>
          <iframe
            ref={iframeRef}
            key={src}
            src={src}
            width={MOBILE_VIEWPORT_WIDTH}
            height={MOBILE_VIEWPORT_HEIGHT}
            style={{ border: "none", display: "block" }}
            title="매장 화면 실시간 미리보기 (모바일)"
            onLoad={postSection}
          />
          {/* 원 shop hover · cursor · 스크롤 100% 통과 · 링크 이동/클릭 실행은 shop 안 리스너(ShopUiContext)가 innerFrame 조건으로 preventDefault */}
          {/* 편집기 오버레이 슬롯 · 모바일은 scale=1 (실제 뷰포트 그대로) */}
          {renderOverlay && renderOverlay({ scale: 1 })}
        </div>
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
        ref={setWrapperEl}
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
          onLoad={postSection}
        />
        {/* 원 shop hover · cursor · 스크롤 100% 통과 · 링크 이동/클릭 실행은 shop 안 리스너(ShopUiContext)가 innerFrame 조건으로 preventDefault */}
        {/* 편집기 오버레이 슬롯 · PC iframe 스케일 반영 · react-moveable target 배치용 */}
        {renderOverlay && renderOverlay({ scale })}
      </div>
    </div>
  );
}
