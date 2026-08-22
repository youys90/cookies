"use client";
// 벌크 액션 바 - 목록 하단 sticky. 선택된 항목에 일괄 액션.

interface BulkActionBarProps {
  count: number;
  categories?: string[];
  onDelete: () => void;
  onToggleActive: (active: boolean) => void;
  onChangeCategory?: (category: string) => void;
  onExportCsv?: () => void;
  onBulkEdit?: () => void;
  onClear: () => void;
  /** 활성 토글 버튼 라벨 커스터마이즈 · 기본 상품용 (판매중/판매중지) */
  toggleActiveLabels?: { on: string; off: string };
  toggleActiveTitles?: { on: string; off: string };
}

export default function BulkActionBar({
  count,
  categories,
  onDelete,
  onToggleActive,
  onChangeCategory,
  onExportCsv,
  onBulkEdit,
  onClear,
  toggleActiveLabels,
  toggleActiveTitles,
}: BulkActionBarProps) {
  if (count === 0) return null;
  const onLabel = toggleActiveLabels?.on ?? "판매중 ↑";
  const offLabel = toggleActiveLabels?.off ?? "판매중지 ↓";
  const onTitle = toggleActiveTitles?.on ?? "선택 항목 판매중으로";
  const offTitle = toggleActiveTitles?.off ?? "선택 항목 판매중지로";

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-800 flex items-center gap-1 px-3 py-2 max-w-[95vw] overflow-x-auto">
      <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
        <span className="text-sm">
          <span className="font-medium text-white">{count}개</span> 선택됨
        </span>
      </div>

      <button
        onClick={() => onToggleActive(true)}
        className="px-3 py-1.5 text-xs rounded hover:bg-gray-800 transition"
        title={onTitle}
      >
        {onLabel}
      </button>
      <button
        onClick={() => onToggleActive(false)}
        className="px-3 py-1.5 text-xs rounded hover:bg-gray-800 transition"
        title={offTitle}
      >
        {offLabel}
      </button>

      {/* 카테고리 변경 · 실수 시 되돌리기 어려워 제거 · 개별 편집 or 일괄 수정에서만 가능 */}

      {onBulkEdit && (
        <button
          onClick={onBulkEdit}
          className="px-3 py-1.5 text-xs rounded bg-amber-500 hover:bg-amber-600 transition font-medium"
          title="선택 항목 일괄 수정"
        >
          ✏️ 일괄 수정
        </button>
      )}

      {onExportCsv && (
        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 text-xs rounded hover:bg-gray-800 transition flex items-center gap-1"
          title="선택한 상품을 엑셀 파일로 내려받아요 · 다시 올릴 수 있어요"
        >
          <svg viewBox="0 0 24 24" className="w-3 h-3"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
          상품 목록 엑셀 다운로드
        </button>
      )}

      <button
        onClick={onDelete}
        className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 transition"
      >
        삭제
      </button>

      <div className="pl-2 border-l border-gray-700 ml-1">
        <button
          onClick={onClear}
          className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-800 transition"
          title="선택 해제"
          aria-label="선택 해제"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 6l12 12M6 18L18 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
