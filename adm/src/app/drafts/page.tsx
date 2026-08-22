"use client";

// 관리자 임시저장 목록 · 상품관리 스타일 참고 (필터 pill · 테이블 · 체크박스 · BulkActionBar)
// - 페이지별로 사장님이 저장해둔 임시저장 확인
// - 만료 임박 시 · 경고 표시
// - 일괄 삭제 · 체크박스 선택 후 하단 액션바로 삭제

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { listDrafts, deleteDraft, deleteManyDrafts, daysUntilExpire, RETENTION_DAYS, type Draft } from "@/lib/adminDrafts";

const PAGE_PATH: Record<string, string> = {
  "bulk-new": "/products/bulk-new",
  "bulk-edit": "/products/bulk-edit",
  "customize": "/customize",
  "excel-import": "/products/excel-import",
  "review-import": "/reviews/import",
  "review-bulk-new": "/reviews/bulk-new",
  "review-bulk-edit": "/reviews/bulk-edit",
  "product-new": "/products/new",
  "product-edit": "/products",
};

const PAGE_ICON: Record<string, string> = {
  "bulk-new": "🆕",
  "bulk-edit": "✏️",
  "customize": "🎨",
  "excel-import": "📥",
  "review-import": "⭐",
  "review-bulk-new": "⭐",
  "review-bulk-edit": "⭐",
  "product-new": "📦",
  "product-edit": "✏️",
};

const TAB_GROUPS: Array<{ key: string; label: string; icon: string; pageKeys: string[] }> = [
  { key: "all", label: "전체", icon: "📚", pageKeys: [] },
  { key: "products", label: "상품 관리", icon: "🛍", pageKeys: ["bulk-new", "excel-import", "product-new", "product-edit", "bulk-edit"] },
  { key: "customize", label: "매장 화면 관리", icon: "🎨", pageKeys: ["customize"] },
  { key: "reviews", label: "리뷰 관리", icon: "⭐", pageKeys: ["review-import", "review-bulk-new", "review-bulk-edit"] },
];

export default function DraftsPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setRows(listDrafts());
    setSelectedIds(new Set());
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabWithCount = useMemo(() =>
    TAB_GROUPS.map((t) => ({
      ...t,
      count: t.key === "all" ? rows.length : rows.filter((r) => t.pageKeys.includes(r.pageKey)).length,
    })), [rows]);

  const filtered = useMemo(() =>
    activeTab === "all"
      ? rows
      : rows.filter((r) => {
          const t = TAB_GROUPS.find((x) => x.key === activeTab);
          return t?.pageKeys.includes(r.pageKey);
        }), [rows, activeTab]);

  const allChecked = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const someChecked = filtered.some((r) => selectedIds.has(r.id)) && !allChecked;

  const toggleAll = () => {
    if (allChecked) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.delete(r.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filtered.forEach((r) => next.add(r.id));
        return next;
      });
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const remove = (id: string, title: string) => {
    if (!confirm(`「${title}」 임시저장을 지웁니다.\n\n이 작업은 되돌릴 수 없어요.`)) return;
    deleteDraft(id);
    load();
  };

  const bulkRemove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`선택한 ${ids.length}건의 임시저장을 지웁니다.\n\n이 작업은 되돌릴 수 없어요.`)) return;
    deleteManyDrafts(ids);
    load();
  };

  const openDraft = (d: Draft) => {
    const base = PAGE_PATH[d.pageKey] || "/";
    if (d.pageKey === "bulk-edit") {
      const data = d.data as { ids?: number[] } | undefined;
      const ids = Array.isArray(data?.ids) ? data.ids.join(",") : "";
      if (!ids) {
        alert("이 임시저장은 상품 정보가 남아있지 않아 이어서 편집할 수 없어요.");
        return;
      }
      window.location.href = `${base}?ids=${ids}&draft=${d.id}`;
      return;
    }
    window.location.href = `${base}?draft=${d.id}`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto pb-24">
      {/* Header · 상품관리 스타일 */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-light tracking-wide text-gray-900">💾 임시저장 목록</h1>
          <p className="text-sm text-gray-500 mt-1">
            작업 중이던 화면들이 여기에 모여요. 이어서 편집하거나 · 필요없으면 삭제할 수 있어요.
          </p>
        </div>
        <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-3 py-1.5">
          ⏰ 마지막 저장으로부터 <b>{RETENTION_DAYS}일</b> 후 자동 삭제
        </div>
      </div>

      {/* Filters · 상품관리 스타일 흰 카드 · pill */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-500 whitespace-nowrap">메뉴</span>
          {tabWithCount.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1 text-xs rounded-full border transition font-medium ${
                activeTab === t.key
                  ? "bg-[var(--color-brand)] text-white border-[var(--color-brand)] shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              }`}
            >
              <span className="mr-1">{t.icon}</span>
              {t.label}
              <span className={`ml-1.5 ${activeTab === t.key ? "opacity-90" : "opacity-60"}`}>({t.count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table · 상품관리 스타일 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-gray-400 text-sm">
            <p>임시저장한 화면이 없어요</p>
            <p className="text-[11px] mt-1">각 편집 화면에서 「💾 임시저장」을 누르시면 여기에 담겨요</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 text-center w-12">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = someChecked; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                    aria-label="현재 필터 전체 선택"
                  />
                </th>
                <th className="px-4 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">화면</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">임시저장 이름</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">마지막 저장</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 tracking-wider">자동 삭제까지</th>
                <th className="px-4 py-4 text-center text-xs font-medium text-gray-500 tracking-wider w-56 border-l border-gray-100">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((d) => {
                const left = daysUntilExpire(d);
                const checked = selectedIds.has(d.id);
                return (
                  <tr key={d.id} className={`hover:bg-gray-50 ${checked ? "bg-yellow-50 hover:bg-yellow-100" : ""}`}>
                    <td className="px-4 py-4 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleOne(d.id)}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900 cursor-pointer"
                        aria-label={`${d.title} 선택`}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{PAGE_ICON[d.pageKey] || "📄"}</span>
                        <span className="text-[11px] px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-medium whitespace-nowrap">{d.pageLabel}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">{d.title}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap font-mono">
                      {new Date(d.updatedAt).toLocaleString("ko-KR")}
                    </td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">
                      <span className={`font-semibold ${left <= 3 ? "text-red-600" : left <= 7 ? "text-amber-600" : "text-gray-500"}`}>
                        {left}일
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center border-l border-gray-100">
                      <div className="flex items-center justify-center gap-1.5">
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
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4">
        <Link href="/" className="text-xs text-gray-500 hover:text-gray-700">← 대시보드</Link>
      </div>

      {/* BulkActionBar · 상품관리 스타일 · 선택 시 하단 sticky */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-800 flex items-center gap-1 px-3 py-2 max-w-[95vw] overflow-x-auto">
          <div className="flex items-center gap-2 pr-3 border-r border-gray-700">
            <span className="text-sm">
              <span className="font-medium text-white">{selectedIds.size}개</span> 선택됨
            </span>
          </div>
          <button
            onClick={bulkRemove}
            className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500 transition"
          >
            🗑 선택 삭제
          </button>
          <div className="pl-2 border-l border-gray-700 ml-1">
            <button
              onClick={() => setSelectedIds(new Set())}
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
      )}
    </div>
  );
}
