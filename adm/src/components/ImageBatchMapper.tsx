"use client";

// 재사용 가능한 · 이미지 → 타깃 일괄 매핑 UI
// - 좌: 이미지 풀 (업로드 · 라이브러리 · 다중 선택)
// - 우: 타깃 목록 (검색 · 필터 · 카드 클릭으로 매핑)
// - 하: 미저장 변경사항 요약 + 일괄 저장 · 되돌리기
//
// 사용처:
// - /products/image-mapping (CSV 등록 후 이미지 매핑)
// - 향후 · 카테고리 이미지 매핑 등에도 재사용 가능
//
// Target 스키마는 제네릭이 아닌 필수 필드 규격을 요구:
// { id, label, subLabel?, thumbnails, filterBadge? }

import { useMemo, useState } from "react";
import Image from "next/image";

export interface MapperTarget {
  id: number | string;
  label: string;
  subLabel?: string;
  thumbnails: string[]; // 이미 매핑된 이미지들
  filterBadge?: string; // 필터 셀렉트에 사용될 카테고리 값 (예: 등록방식)
  meta?: Record<string, unknown>; // 자유 확장
}

export interface FilterOption {
  label: string;
  value: string;
  predicate: (t: MapperTarget) => boolean;
}

interface Props {
  targets: MapperTarget[];
  /** 이미지 풀에 미리 채워둘 URL 목록 (라이브러리 · 스토리지 등) */
  initialPool?: string[];
  /** 새 파일을 스토리지에 업로드하고 publicUrl을 반환하는 콜백 */
  uploadFiles?: (files: File[]) => Promise<string[]>;
  /** 타깃별 매핑 이미지 URL을 저장하는 콜백 (일괄 저장) */
  onSave: (mappings: { targetId: number | string; imageUrls: string[] }[]) => Promise<{ ok: number; failed: number }>;
  /** 우측 필터 옵션들 (기본 = 전체 · 이미지 없음) */
  filters?: FilterOption[];
  /** 헤더 · 안내용 */
  title?: string;
  emptyMessage?: string;
}

interface PoolItem { url: string; label?: string }

interface Draft {
  [targetId: string]: string[]; // 이 타깃에 새로 매핑될 URL들 (기존 thumbnails에 추가됨)
}

const DEFAULT_FILTERS: FilterOption[] = [
  { label: "전체", value: "all", predicate: () => true },
  { label: "이미지 없음", value: "no-image", predicate: (t) => t.thumbnails.length === 0 },
  { label: "이미지 있음", value: "has-image", predicate: (t) => t.thumbnails.length > 0 },
];

export default function ImageBatchMapper({
  targets,
  initialPool = [],
  uploadFiles,
  onSave,
  filters,
  title = "이미지 매핑",
  emptyMessage = "매핑할 대상이 없습니다.",
}: Props) {
  const [pool, setPool] = useState<PoolItem[]>(() => initialPool.map((u) => ({ url: u })));
  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<Draft>({});
  const [query, setQuery] = useState("");
  const [filterVal, setFilterVal] = useState<string>("no-image");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>("");
  const [badgeFilter, setBadgeFilter] = useState<string>("all"); // filterBadge 커스텀 필터

  const activeFilters = filters ?? DEFAULT_FILTERS;

  // 등록방식 등 filterBadge 값 유니크 목록 (커스텀 필터)
  const badgeOptions = useMemo(() => {
    const s = new Set<string>();
    targets.forEach((t) => { if (t.filterBadge) s.add(t.filterBadge); });
    return Array.from(s);
  }, [targets]);

  const filteredTargets = useMemo(() => {
    const pred = activeFilters.find((f) => f.value === filterVal)?.predicate ?? (() => true);
    const q = query.trim().toLowerCase();
    return targets
      .filter((t) => pred(t))
      .filter((t) => (badgeFilter === "all" ? true : t.filterBadge === badgeFilter))
      .filter((t) => !q || t.label.toLowerCase().includes(q) || (t.subLabel?.toLowerCase() ?? "").includes(q));
  }, [targets, filterVal, badgeFilter, query, activeFilters]);

  const togglePick = (url: string) => {
    setSelectedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const selectAllPool = () => setSelectedUrls(new Set(pool.map((p) => p.url)));
  const clearSelection = () => setSelectedUrls(new Set());

  const applySelectedToTarget = (targetId: number | string) => {
    if (selectedUrls.size === 0) {
      setSaveMsg("먼저 좌측에서 이미지를 선택하세요");
      setTimeout(() => setSaveMsg(""), 2500);
      return;
    }
    setDraft((prev) => {
      const key = String(targetId);
      const already = new Set([...(prev[key] ?? [])]);
      selectedUrls.forEach((u) => already.add(u));
      return { ...prev, [key]: Array.from(already) };
    });
    clearSelection();
  };

  const revertTargetDraft = (targetId: number | string) => {
    setDraft((prev) => {
      const next = { ...prev };
      delete next[String(targetId)];
      return next;
    });
  };

  const removeFromTargetDraft = (targetId: number | string, url: string) => {
    setDraft((prev) => {
      const key = String(targetId);
      const arr = (prev[key] ?? []).filter((u) => u !== url);
      const next = { ...prev };
      if (arr.length === 0) delete next[key];
      else next[key] = arr;
      return next;
    });
  };

  const handleUploadClick = () => {
    if (!uploadFiles) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = async () => {
      if (!input.files || input.files.length === 0) return;
      setUploading(true);
      try {
        const urls = await uploadFiles(Array.from(input.files));
        setPool((prev) => [...urls.map((u) => ({ url: u })), ...prev]);
      } catch (e) {
        console.error(e);
        alert("업로드 실패: " + String(e));
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const draftedCount = useMemo(() => {
    return Object.values(draft).reduce((sum, arr) => sum + arr.length, 0);
  }, [draft]);

  const draftedTargetCount = Object.keys(draft).length;

  const save = async () => {
    if (draftedTargetCount === 0) return;
    setSaving(true);
    setSaveMsg("");
    const mappings = Object.entries(draft).map(([targetId, urls]) => {
      const orig = targets.find((t) => String(t.id) === targetId);
      const combined = [...(orig?.thumbnails ?? []), ...urls];
      return { targetId, imageUrls: combined };
    });
    try {
      const result = await onSave(mappings);
      setSaveMsg(`저장 완료 · 성공 ${result.ok}건${result.failed ? ` · 실패 ${result.failed}건` : ""}`);
      if (result.failed === 0) {
        setDraft({});
      }
    } catch (e) {
      setSaveMsg("저장 실패: " + String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-gray-50 rounded-2xl border border-gray-200 overflow-hidden">
      {/* 헤더 */}
      <div className="px-5 py-3 bg-white border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <span className="text-xs text-gray-500">
            대상 <b className="text-gray-700">{targets.length}</b>건 · 이미지 풀 <b className="text-gray-700">{pool.length}</b>장
            {draftedCount > 0 && <> · <span className="text-amber-700 font-medium">미저장 {draftedCount}건</span></>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-xs text-gray-600 pr-1">{saveMsg}</span>}
          {draftedTargetCount > 0 && (
            <button
              onClick={() => setDraft({})}
              disabled={saving}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
            >
              모두 되돌리기
            </button>
          )}
          <button
            onClick={save}
            disabled={saving || draftedTargetCount === 0}
            className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 font-medium"
          >
            {saving ? "저장 중..." : `일괄 저장 (${draftedTargetCount}건 · ${draftedCount}장)`}
          </button>
        </div>
      </div>

      {/* 본문 · 2단 그리드 */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] overflow-hidden">
        {/* ── 좌 · 이미지 풀 ─────────────────────────── */}
        <div className="border-r border-gray-200 flex flex-col overflow-hidden bg-white">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {uploadFiles && (
              <button
                onClick={handleUploadClick}
                disabled={uploading}
                className="px-3 py-1.5 text-xs bg-[var(--color-brand)] text-white rounded-md hover:bg-[var(--color-brand-dk)] font-medium disabled:opacity-50 flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                {uploading ? "업로드 중..." : "이미지 업로드"}
              </button>
            )}
            <span className="text-[10px] text-gray-400 self-center">💾 이 세션에만 유지 · 새로고침 시 초기화</span>
            <div className="flex-1"></div>
            <div className="text-[11px] text-gray-500 flex items-center gap-2">
              선택 <b className="text-gray-700">{selectedUrls.size}</b> / {pool.length}
              {selectedUrls.size > 0 ? (
                <button onClick={clearSelection} className="text-gray-500 hover:text-gray-800 underline">해제</button>
              ) : pool.length > 0 ? (
                <button onClick={selectAllPool} className="text-gray-500 hover:text-gray-800 underline">전체</button>
              ) : null}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {pool.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">
                <p className="mb-1">이미지 풀이 비어있습니다</p>
                <p className="text-[11px]">↑ 위 「업로드」 또는 「라이브러리」로 이미지를 담아주세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                {pool.map((p) => {
                  const active = selectedUrls.has(p.url);
                  return (
                    <button
                      key={p.url}
                      type="button"
                      onClick={() => togglePick(p.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${active ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30" : "border-gray-200 hover:border-gray-400"}`}
                    >
                      <Image src={p.url} alt="" fill unoptimized className="object-cover" />
                      {active && (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 leading-relaxed">
            💡 이미지 여러 개 선택 → 우측 상품 카드 클릭 → 해당 상품에 일괄 매핑
          </div>
        </div>

        {/* ── 우 · 타깃 목록 ─────────────────────────── */}
        <div className="flex flex-col overflow-hidden bg-white">
          <div className="p-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            {activeFilters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilterVal(f.value)}
                className={`px-3 py-1.5 text-xs rounded-md border transition ${filterVal === f.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
              >
                {f.label}
              </button>
            ))}
            {badgeOptions.length > 0 && (
              <select
                value={badgeFilter}
                onChange={(e) => setBadgeFilter(e.target.value)}
                className="text-xs px-2 py-1.5 border border-gray-200 rounded-md bg-white"
                title="추가 필터"
              >
                <option value="all">등록방식 · 전체</option>
                {badgeOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="검색..."
              className="ml-auto text-xs px-3 py-1.5 border border-gray-200 rounded-md bg-white w-40 focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/30"
            />
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {filteredTargets.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">{emptyMessage}</div>
            ) : (
              <div className="space-y-2">
                {filteredTargets.map((t) => {
                  const drafted = draft[String(t.id)] ?? [];
                  const originalCount = t.thumbnails.length;
                  const isDrafted = drafted.length > 0;
                  return (
                    <div
                      key={t.id}
                      className={`rounded-lg border transition ${isDrafted
                        ? "border-amber-300 bg-amber-50/50"
                        : originalCount === 0
                          ? "border-red-200 bg-red-50/30"
                          : "border-gray-200 bg-white"
                        }`}
                    >
                      <button
                        type="button"
                        onClick={() => applySelectedToTarget(t.id)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-black/[0.02] transition text-left"
                        title="선택한 이미지들을 이 상품에 매핑"
                      >
                        {/* 썸네일 스택 */}
                        <div className="flex -space-x-2 flex-shrink-0">
                          {t.thumbnails.slice(0, 3).map((u) => (
                            <div key={u} className="relative w-11 h-11 rounded-md border-2 border-white shadow-sm overflow-hidden bg-gray-100">
                              <Image src={u} alt="" fill unoptimized className="object-cover" />
                            </div>
                          ))}
                          {drafted.slice(0, Math.max(0, 3 - t.thumbnails.length)).map((u) => (
                            <div key={u} className="relative w-11 h-11 rounded-md border-2 border-amber-300 shadow-sm overflow-hidden bg-amber-50">
                              <Image src={u} alt="" fill unoptimized className="object-cover" />
                              <span className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] px-0.5 rounded-bl leading-tight">NEW</span>
                            </div>
                          ))}
                          {t.thumbnails.length === 0 && drafted.length === 0 && (
                            <div className="w-11 h-11 rounded-md border-2 border-dashed border-red-300 bg-red-50 flex items-center justify-center">
                              <span className="text-red-400 text-lg">📷</span>
                            </div>
                          )}
                        </div>

                        {/* 텍스트 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-gray-900 truncate">{t.label}</p>
                            {t.filterBadge && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full flex-shrink-0">{t.filterBadge}</span>
                            )}
                            {originalCount === 0 && !isDrafted && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-medium flex-shrink-0">이미지 없음</span>
                            )}
                            {isDrafted && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-amber-500 text-white rounded-full font-medium flex-shrink-0">+{drafted.length}장</span>
                            )}
                          </div>
                          {t.subLabel && <p className="text-[11px] text-gray-500 truncate mt-0.5">{t.subLabel}</p>}
                        </div>

                        {/* 카운트 */}
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">저장됨</p>
                          <p className="text-sm font-semibold text-gray-700">
                            {originalCount}
                            {isDrafted && <span className="text-amber-600"> → {originalCount + drafted.length}</span>}
                          </p>
                        </div>
                      </button>

                      {/* 드래프트 이미지 상세 · 확장 */}
                      {isDrafted && (
                        <div className="px-3 pb-3 border-t border-amber-100 pt-2 flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-amber-700 font-medium">추가 예정:</span>
                          {drafted.map((u) => (
                            <div key={u} className="relative w-7 h-7 rounded border border-amber-200 overflow-hidden group">
                              <Image src={u} alt="" fill unoptimized className="object-cover" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeFromTargetDraft(t.id, u); }}
                                className="absolute inset-0 bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                title="제거"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); revertTargetDraft(t.id); }}
                            className="ml-auto text-[10px] text-gray-500 hover:text-gray-700 underline"
                          >
                            되돌리기
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
