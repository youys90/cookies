"use client";

// PPT식 편집기 · 「큰 화면 편집」 모드 컨테이너
// - 상단 툴바 · 「내 매장 편집」 · 편집 대상 hero 이미지 선택 (사장님 원 UX: 매장 화면 안에서 편집)
// - 중앙 ShopPreview (전체 폭 · disableOverlay=false · 스포트라이트 적용)
// - 오른쪽 사이드 · MoveableOverlay 리사이즈 대상 지정 · react-moveable 드래그로 크기 조절
// - shop 원 코드 무침습 · 편집 UI는 adm 안에서만 · 저장 시 config.mainTop.hero.images[n].width/height 반영

import { useState } from "react";
import ShopPreview, { type PreviewSection } from "@/components/ShopPreview";
import MoveableOverlay from "@/components/customize/MoveableOverlay";
import type { ShopUiConfig } from "@/lib/shopUiSchema";
import type { CookiesEditClickRect } from "@/lib/editorPostMessage";

interface Props {
  config: ShopUiConfig;
  device: "desktop" | "mobile";
  page: "list" | "detail" | "mainTop";
  sampleProductId?: number | null;
  updateField: (section: string, key: string, value: unknown) => void;
  /** 스포트라이트 · shop iframe에 어느 세부 영역 편집 중인지 알림 (「메인」 편집일 때만 유효) */
  section?: PreviewSection;
}

/** 「큰 화면 편집」에서 편집 대상 hero 이미지 선택 상태 · 초기 null (편집 대기) */
type SelectedTarget =
  | { kind: "hero-image"; index: number }
  | null;

export default function BigPreviewEditor({ config, device, page, sampleProductId, updateField, section }: Props) {
  const [target, setTarget] = useState<SelectedTarget>(null);
  // shop → adm postMessage 로 넘어온 · shop iframe 안 rect (getBoundingClientRect · shop 뷰포트 상대)
  // - MoveableOverlay가 DEFAULT_HERO_LAYOUT 하드코딩 대신 실 좌표 사용
  // - 툴바 썸네일로 target 지정된 경우 → null 유지 → MoveableOverlay는 fallback (하위호환)
  const [selectedRect, setSelectedRect] = useState<CookiesEditClickRect | null>(null);

  // hero 이미지 리스트 · 사장님이 대상 선택하는 툴바 항목
  const heroImages = config.mainTop?.hero?.images || [];

  return (
    <div className="space-y-3">
      {/* 상단 툴바 · 사장님 친화 · 「내 매장 편집」 컨셉 · 편집 대상 선택 */}
      <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-[var(--color-brand)]/8 via-white to-[var(--color-brand)]/8 border-2 border-[var(--color-brand)]/40 rounded-2xl px-4 py-3 shadow-sm flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xl">🖌</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">직접 편집</p>
            <p className="text-[11px] text-gray-500 truncate">
              {target
                ? "가장자리 손잡이를 드래그해서 크기를 조절해요"
                : "크기를 조절할 사진을 선택하세요"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {target && (
            <button
              type="button"
              onClick={() => { setTarget(null); setSelectedRect(null); }}
              className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              title="편집 종료 · 선택 해제"
            >
              ✓ 편집 종료
            </button>
          )}
          <span className="hidden md:inline-flex px-2.5 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full">
            💾 저장하면 바로 적용돼요
          </span>
        </div>
      </div>

      {/* 편집 대상 선택 · hero 이미지 썸네일 (MVP 1단계) */}
      {page === "mainTop" && heroImages.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
          <p className="text-[11px] font-bold text-gray-700 mb-2">✏ 크기 조절할 사진 선택</p>
          <div className="flex items-center gap-2 flex-wrap">
            {heroImages.map((im, i) => {
              const active = target?.kind === "hero-image" && target.index === i;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => { setTarget({ kind: "hero-image", index: i }); setSelectedRect(null); }}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition text-left ${
                    active
                      ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10"
                      : "border-gray-200 bg-white hover:bg-gray-50"
                  }`}
                >
                  {im.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={im.url}
                      alt={im.alt || `사진 ${i + 1}`}
                      className="w-10 h-10 object-cover rounded border border-gray-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ) : (
                    <span className="w-10 h-10 flex items-center justify-center rounded border border-gray-200 text-[10px] text-gray-300">빈</span>
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${active ? "text-[var(--color-brand-dk)]" : "text-gray-900"}`}>사진 #{i + 1}</p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {im.width && im.height ? `${im.width}×${im.height}px` : "기본 크기"}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 중앙 · ShopPreview + MoveableOverlay 슬롯 (같은 iframe wrapper 안에 배치)
          · bigEditor=true → shop 안 click/submit 차단 리스너 비활성 · react-moveable 편집 클릭 통과
          · MoveableOverlay는 renderOverlay 슬롯을 통해 iframe wrapper 위에 절대 좌표 배치
          · shop 원 링크 이동 방지: MoveableOverlay 배경 zIndex 20이 target 있을 때 · target 없을 때는 iframe 내부 preventDefault 있어야 하지만 현재 bigEditor=1 이라 shop 리스너 비활성 · MVP 1단계 · target 없이 shop 링크 클릭 시 iframe 내부 이동 발생 가능 · 사장님이 대상 선택 후 편집 흐름을 전제 */}
      <ShopPreview
        config={config}
        device={device}
        page={page}
        sampleProductId={sampleProductId}
        section={section}
        bigEditor
        onElementClick={({ index, rect }) => {
          setTarget({ kind: "hero-image", index });
          setSelectedRect(rect);
        }}
        renderOverlay={({ scale }) => (
          <MoveableOverlay
            target={target}
            scale={scale}
            config={config}
            updateField={updateField}
            onDeselect={() => { setTarget(null); setSelectedRect(null); }}
            overrideRect={selectedRect}
          />
        )}
      />
    </div>
  );
}
