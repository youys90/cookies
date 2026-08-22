"use client";

// 「저장한 목록 불러오기」 · 재사용 컴포넌트
// - 임시 저장 버튼 옆에 배치
// - 이 페이지(pageKey)에서 저장한 임시저장만 필터링해서 팝업으로 표시
// - 항목 클릭 시 onLoad(draft.data) 콜백 실행
// 사장님 요구 (재차 확인) · 상품관리 일괄등록 스타일 · 모든 임시저장 페이지에 통일 적용

import { useState } from "react";
import { listDrafts, type Draft } from "@/lib/adminDrafts";

interface Props {
  /** 이 페이지의 고유 키 · 예: "bulk-new" · "customize" · "reviews-bulk-new" */
  pageKey: string;
  /** 항목 선택 시 · 저장된 data payload를 받음 */
  onLoad: (data: unknown, draftId: string) => void;
  /** 버튼 라벨 · 기본 "저장한 목록 불러오기" */
  label?: string;
  /** 툴팁 · 기본값 있음 */
  title?: string;
}

export default function DraftListButton({ pageKey, onLoad, label = "저장한 목록 불러오기", title }: Props) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const openList = () => {
    setDrafts(listDrafts(pageKey));
    setOpen(true);
  };

  const pick = (d: Draft) => {
    onLoad(d.data, d.id);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={openList}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border-2 border-gray-200 bg-white text-gray-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)] transition"
        title={title || "이 페이지에서 저장한 임시저장 목록을 불러옵니다"}
      >
        📂 {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">📂 저장한 목록 불러오기</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">이 페이지에서 임시저장한 목록만 표시돼요</p>
              </div>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M6 18L18 6" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <p>임시저장한 목록이 없어요</p>
                  <p className="text-[11px] mt-1">「💾 임시 저장」을 눌러 저장해두세요</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {drafts.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => pick(d)}
                      className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 transition"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">저장 시각: {new Date(d.updatedAt).toLocaleString("ko-KR")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
