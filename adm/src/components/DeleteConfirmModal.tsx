"use client";
// 삭제 확인 모달 - 대량 삭제 안전장치
// 큰 규모 삭제(N≥10)는 "삭제" 입력 후에만 확정

import { useEffect, useState } from "react";

interface DeleteConfirmModalProps {
  open: boolean;
  count: number;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: string;
  description?: string;
}

const CONFIRM_KEYWORD = "삭제";

export default function DeleteConfirmModal({
  open,
  count,
  onClose,
  onConfirm,
  title,
  description,
}: DeleteConfirmModalProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  const needsKeyword = count >= 10;
  const canConfirm = !needsKeyword || typed.trim() === CONFIRM_KEYWORD;

  const handleConfirm = async () => {
    if (!canConfirm || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01M4.93 19h14.14a2 2 0 001.72-3L13.72 4a2 2 0 00-3.44 0L3.21 16a2 2 0 001.72 3z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">{title || "삭제 확인"}</h3>
            <p className="text-sm text-gray-500 mt-0.5">되돌릴 수 없습니다</p>
          </div>
        </div>

        <p className="text-sm text-gray-700 leading-relaxed mb-5">
          {description ? (
            description
          ) : (
            <>
              선택한 <span className="font-medium text-gray-900">{count}개</span> 항목을 영구 삭제합니다.
              <br />
              연결된 옵션·이미지 참조도 함께 삭제될 수 있습니다.
            </>
          )}
        </p>

        {needsKeyword && (
          <div className="mb-5">
            <label className="block text-xs text-gray-500 mb-2">
              확인을 위해 <span className="font-medium text-gray-900">&quot;{CONFIRM_KEYWORD}&quot;</span>를 입력하세요
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              placeholder={CONFIRM_KEYWORD}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm || busy}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-500 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy ? "삭제 중..." : `${count}개 삭제`}
          </button>
        </div>
      </div>
    </div>
  );
}
