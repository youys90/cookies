"use client";

// 관리자 임시저장 버튼 · 공통 컴포넌트
// - 명확하게 「버튼」임을 인지 (앰버 계열 · 큼직한 pill · 그림자 · hover 효과)
// - 마지막 저장 시각 · 뱃지로 우측 노출
// - 방금 저장됨 · 짧은 애니메이션
// - 사장님 요청: 목록 링크 미노출 · 헷갈리기만 함 · 임시저장 목록은 좌측 사이드바 「임시저장」 메뉴로

import { useEffect, useState } from "react";

interface Props {
  onSave: () => void;
  lastSavedAt: Date | null;
  disabled?: boolean;
  /** 최근 수동 저장 트리거 카운터 · 애니메이션용 */
  savedTick?: number;
}

export default function DraftSaveButton({ onSave, lastSavedAt, disabled, savedTick = 0 }: Props) {
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (savedTick > 0) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 1500);
      return () => clearTimeout(t);
    }
  }, [savedTick]);

  return (
    <div className="inline-flex items-center gap-1.5 flex-wrap">
      {/* 메인 버튼 · 앰버 pill · 명확히 「버튼」 */}
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 border-2 disabled:opacity-40 disabled:cursor-not-allowed ${
          flash
            ? "bg-emerald-500 text-white border-emerald-600 animate-pulse"
            : "bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
        }`}
        title="현재 편집 상태를 즉시 임시 저장 · 나중에 이어서 작업 가능"
      >
        <span className="text-base">{flash ? "✓" : "💾"}</span>
        <span>{flash ? "저장했어요" : "임시 저장"}</span>
      </button>

      {/* 상태 뱃지 · 최근 임시저장 시각 (자동 저장 없음 · 수동 저장 시에만 갱신) */}
      {lastSavedAt && (
        <div className="inline-flex items-center gap-1 px-2.5 py-1 bg-white/70 border border-gray-200 rounded-full text-[11px] text-gray-500 backdrop-blur">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>방금 임시 저장됨 · <span className="font-mono">{lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></span>
        </div>
      )}
    </div>
  );
}
