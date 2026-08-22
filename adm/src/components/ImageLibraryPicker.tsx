"use client";

// 이미지 라이브러리에서 선택 · 재사용 컴포넌트
// - Storage `product-images/products/` 조회
// - 그리드 + 검색 · 다중 선택
// - 확인 시 · 선택된 URL 목록 콜백

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface StorageFile {
  name: string;
  path: string;
  publicUrl: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (urls: string[]) => void;
  multi?: boolean; // 다중 선택 허용 (기본 true)
}

export default function ImageLibraryPicker({ open, onClose, onSelect, multi = true }: Props) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPicked(new Set());
    (async () => {
      setLoading(true);
      const collected: StorageFile[] = [];
      let offset = 0;
      const limit = 1000;
      while (true) {
        const { data, error } = await supabase.storage
          .from("product-images")
          .list("products", { limit, offset, sortBy: { column: "created_at", order: "desc" } });
        if (error || !data || data.length === 0) break;
        for (const f of data) {
          if (!f.name) continue;
          const path = `products/${f.name}`;
          const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
          collected.push({ name: f.name, path, publicUrl: pub.publicUrl });
        }
        if (data.length < limit) break;
        offset += limit;
      }
      setFiles(collected);
      setLoading(false);
    })();
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, query]);

  const togglePick = (url: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else {
        if (!multi) next.clear();
        next.add(url);
      }
      return next;
    });
  };

  const confirm = () => {
    if (picked.size === 0) { onClose(); return; }
    onSelect(Array.from(picked));
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-5xl w-full max-h-[85vh] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🗂️ 이미지 라이브러리에서 선택</h3>
            <p className="text-xs text-gray-500 mt-0.5">이미 업로드된 이미지를 재사용합니다 · {multi ? "여러 개 선택 가능" : "1개만 선택"}</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 flex-shrink-0">✕</button>
        </div>

        {/* 검색 */}
        <div className="p-3 border-b border-gray-100 bg-gray-50">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="파일명 검색..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40 bg-white"
            />
          </div>
          <p className="text-xs text-gray-500 mt-2">{filtered.length}건 · 선택 {picked.size}건</p>
        </div>

        {/* 그리드 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="text-center py-20 text-gray-500">로딩 중...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">이미지 없음</div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2">
              {filtered.map((f) => {
                const active = picked.has(f.publicUrl);
                return (
                  <button
                    key={f.path}
                    type="button"
                    onClick={() => togglePick(f.publicUrl)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${active ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30" : "border-gray-200 hover:border-gray-400"}`}
                  >
                    <Image src={f.publicUrl} alt={f.name} fill unoptimized className="object-cover" />
                    {active && (
                      <>
                        <div className="absolute inset-0 bg-[var(--color-brand)]/20"></div>
                        <div className="absolute top-1 right-1 w-6 h-6 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      </>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1 py-0.5 truncate">{f.name}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 액션 */}
        <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-white">취소</button>
          <button onClick={confirm} disabled={picked.size === 0} className="px-4 py-1.5 text-sm bg-[var(--color-brand)] hover:bg-[var(--color-brand-dk)] text-white rounded-lg font-medium disabled:opacity-40 shadow-sm">
            {picked.size > 0 ? `${picked.size}개 선택 · 적용` : "선택 없음"}
          </button>
        </div>
      </div>
    </div>
  );
}
