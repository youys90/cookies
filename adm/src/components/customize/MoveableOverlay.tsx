"use client";

// PPT식 편집기 · 「큰 화면 편집」 모드용 react-moveable 오버레이
// - BigPreviewEditor 상단 툴바에서 hero 이미지 선택 시 · target 지정
// - config에 저장된 width/height (없으면 기본값)를 초기 크기로 · 사장님 드래그로 조절
// - onResize · onResizeEnd → updateField로 config.mainTop.hero.images[n].width/height 반영
// - dynamic import + ssr:false (Turbopack ESM 호환 확보 · react-moveable 3년 미배포 리스크 대응)
// - shop 원 코드 무침습 · shop postMessage 미사용 · adm 안에서만 편집 인터랙션

import { useState } from "react";
import dynamic from "next/dynamic";
import type { ShopUiConfig } from "@/lib/shopUiSchema";

// react-moveable · ssr:false + dynamic · 서버 렌더 시 로드 안 함 · 초기 번들 방어
const Moveable = dynamic(() => import("react-moveable"), { ssr: false });

/** BigPreviewEditor에서 선택된 편집 대상 · null이면 편집 대기 (렌더 안 함) */
export type MoveableTarget =
  | { kind: "hero-image"; index: number }
  | null;

interface Props {
  target: MoveableTarget;
  /** iframe scale (ShopPreview renderOverlay에서 전달) · 오버레이 좌표 곱셈용 */
  scale: number;
  /** 현재 편집 중 config · onResizeEnd에서 hero.images 갱신할 때 이전 상태 참조 */
  config: ShopUiConfig;
  /** 좌측 폼과 동일한 세터 · onResizeEnd에서 hero images에 width/height 반영 */
  updateField: (section: string, key: string, value: unknown) => void;
  /** 편집 종료 (호출부에서 target=null 처리) */
  onDeselect: () => void;
}

// MVP 1단계 · 기본 위치/크기 (shop 실측이 없을 때) · 사장님이 리사이즈하면 이후는 저장된 값 사용
// 좌표는 shop 원본 (unscaled) 기준 · MoveableOverlay가 scale 곱셈해서 배치
const DEFAULT_HERO_LAYOUT: Record<number, { x: number; y: number; w: number; h: number }> = {
  0: { x: 40, y: 200, w: 800, h: 560 },
  1: { x: 860, y: 200, w: 360, h: 270 },
  2: { x: 860, y: 490, w: 360, h: 270 },
  3: { x: 860, y: 780, w: 360, h: 200 },
  4: { x: 40, y: 780, w: 400, h: 200 },
};

export default function MoveableOverlay({ target, scale, config, updateField, onDeselect }: Props) {
  // 콜백 ref 패턴 · useState로 DOM 노드 보관 (React 19 · ref during render 회피)
  const [targetEl, setTargetEl] = useState<HTMLDivElement | null>(null);
  // 실시간 시각 반영용 · onResize 중 크기 · target 인덱스와 함께 저장 (target 변경 시 자동 무시)
  const [liveSize, setLiveSize] = useState<{ idx: number; w: number; h: number } | null>(null);

  if (!target) return null;

  // 초기 크기 · config에 저장된 width/height 있으면 사용 · 없으면 DEFAULT_HERO_LAYOUT 폴백
  const idx = target.index;
  const img = config.mainTop?.hero?.images?.[idx];
  if (!img) return null;
  const fallback = DEFAULT_HERO_LAYOUT[idx] ?? DEFAULT_HERO_LAYOUT[0];
  const initShopW = img.width && img.width > 0 ? img.width : fallback.w;
  const initShopH = img.height && img.height > 0 ? img.height : fallback.h;
  // liveSize 인덱스가 다르면 무시 (다른 target으로 이동한 경우 stale 데이터 사용 방지)
  const staleSafe = liveSize?.idx === idx ? liveSize : null;
  const shopW = staleSafe?.w ?? initShopW;
  const shopH = staleSafe?.h ?? initShopH;

  // 오버레이 좌표계 = shop 좌표계 * scale
  const box = {
    left: fallback.x * scale,
    top: fallback.y * scale,
    width: shopW * scale,
    height: shopH * scale,
  };

  return (
    <>
      {/* 배경 · target 밖 클릭 시 편집 종료 · zIndex 20 (오버레이의 클릭 삼킴 zIndex 10보다 위) */}
      <div
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onDeselect();
        }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 20,
          background: "transparent",
        }}
      >
        {/* moveable target · 실제 리사이즈 대상 div (visual outline) */}
        <div
          ref={setTargetEl}
          style={{
            position: "absolute",
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
            outline: "2px solid rgba(59, 130, 246, 0.9)",
            outlineOffset: "-1px",
            boxShadow: "0 0 0 4px rgba(59, 130, 246, 0.15)",
            pointerEvents: "auto",
            background: "transparent",
            cursor: "move",
          }}
        />
        {/* react-moveable · target DOM 노드 상태에 잡힌 뒤 (콜백 ref) 렌더 */}
        {targetEl && (
          <Moveable
            target={targetEl}
            resizable
            draggable={false}
            rotatable={false}
            keepRatio={false}
            throttleResize={0}
            renderDirections={["nw", "n", "ne", "e", "se", "s", "sw", "w"]}
            edge={false}
            zoom={1}
            origin={false}
            onResize={(e) => {
              // 실시간 시각 반영 · overlay 좌표 → shop 좌표 (÷scale)
              const wOverlay = e.width;
              const hOverlay = e.height;
              setLiveSize({
                idx,
                w: Math.max(1, Math.round(wOverlay / scale)),
                h: Math.max(1, Math.round(hOverlay / scale)),
              });
              e.target.style.width = `${wOverlay}px`;
              e.target.style.height = `${hOverlay}px`;
            }}
            onResizeEnd={(e) => {
              const el = e.target as HTMLElement;
              const r = el.getBoundingClientRect();
              const wShop = Math.max(1, Math.round(r.width / scale));
              const hShop = Math.max(1, Math.round(r.height / scale));
              const imgs = config.mainTop.hero.images;
              if (idx >= imgs.length) return;
              const next = imgs.map((im, i) =>
                i === idx ? { ...im, width: wShop, height: hShop } : im
              );
              updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
            }}
          />
        )}
      </div>
    </>
  );
}
