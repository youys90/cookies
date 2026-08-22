"use client";

// 관리자 임시저장 목록 · 다음 메일 「임시보관함」과 동일 컨셉
// - 페이지별로 사장님이 저장해둔 임시저장 모두 확인
// - 만료 임박 시 · 경고 표시
// - 클릭 시 해당 페이지로 이동해 이어서 편집

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listDrafts, deleteDraft, daysUntilExpire, RETENTION_DAYS, type Draft } from "@/lib/adminDrafts";

const PAGE_PATH: Record<string, string> = {
  "bulk-new": "/products/bulk-new",
  "customize": "/customize",
  "excel-import": "/products/excel-import",
  "review-import": "/reviews/import",
  "product-new": "/products/new",
  "product-edit": "/products", // id는 draft.data에서 꺼내야
};

const PAGE_ICON: Record<string, string> = {
  "bulk-new": "🆕",
  "customize": "🎨",
  "excel-import": "📥",
  "review-import": "⭐",
  "product-new": "📦",
  "product-edit": "✏️",
};

export default function DraftsPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [filterPage, setFilterPage] = useState<string>("all");

  const load = useCallback(() => {
    setRows(listDrafts());
  }, []);

  useEffect(() => { load(); }, [load]);

  const pageKeys = Array.from(new Set(rows.map((r) => r.pageKey)));
  const filtered = filterPage === "all" ? rows : rows.filter((r) => r.pageKey === filterPage);

  const remove = (id: string, title: string) => {
    if (!confirm(`「${title}」 임시저장을 지웁니다.\n\n이 작업은 되돌릴 수 없어요.`)) return;
    deleteDraft(id);
    load();
  };

  const openDraft = (d: Draft) => {
    const base = PAGE_PATH[d.pageKey] || "/";
    // draft id를 URL 파라미터로 · 페이지 진입 시 자동 로드
    window.location.href = `${base}?draft=${d.id}`;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">💾 임시저장 목록</h1>
        <p className="text-sm text-gray-500 mt-1">
          작업 중이던 화면들을 여기에 모아뒀어요. 클릭하면 이어서 편집할 수 있어요.
        </p>
      </div>

      {/* 만료 안내 */}
      <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
        ⏰ 임시저장은 마지막 저장으로부터 <b>{RETENTION_DAYS}일</b>이 지나면 자동으로 삭제돼요. 지우고 싶지 않으면 이어서 편집·저장해두세요.
      </div>

      {/* 페이지 필터 */}
      {pageKeys.length > 1 && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-gray-500 mr-1">화면별:</span>
          <button
            onClick={() => setFilterPage("all")}
            className={`px-2.5 py-1 text-xs rounded border ${filterPage === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}
          >
            전체
          </button>
          {pageKeys.map((k) => (
            <button
              key={k}
              onClick={() => setFilterPage(k)}
              className={`px-2.5 py-1 text-xs rounded border flex items-center gap-1 ${filterPage === k ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200"}`}
            >
              <span>{PAGE_ICON[k] || "📄"}</span>
              {rows.find((r) => r.pageKey === k)?.pageLabel || k}
            </button>
          ))}
        </div>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <p>임시저장한 화면이 없어요</p>
          <p className="text-[11px] mt-1">각 편집 화면에서 「💾 임시저장」 을 누르시면 여기에 담겨요</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {filtered.map((d, idx) => {
            const left = daysUntilExpire(d);
            return (
              <div
                key={d.id}
                className={`p-4 flex items-center gap-3 flex-wrap ${idx > 0 ? "border-t border-gray-100" : ""}`}
              >
                <span className="text-2xl">{PAGE_ICON[d.pageKey] || "📄"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{d.pageLabel}</span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    마지막 저장: {new Date(d.updatedAt).toLocaleString("ko-KR")}
                    <span className={`ml-2 font-semibold ${left <= 3 ? "text-red-600" : left <= 7 ? "text-amber-600" : "text-gray-500"}`}>
                      · 자동 삭제까지 {left}일
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openDraft(d)}
                    className="px-3 py-1.5 text-xs bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] font-medium"
                  >
                    ✎ 이어서 편집
                  </button>
                  <button
                    onClick={() => remove(d.id, d.title)}
                    className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    🗑 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">← 대시보드</Link>
      </div>
    </div>
  );
}
