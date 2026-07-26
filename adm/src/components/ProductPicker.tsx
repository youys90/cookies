"use client";
// 상품 검색·다중 선택 모달
// 사용처: adm 리뷰 등록/수정 폼에서 관련 상품 지정

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface ProductLite {
  id: number;
  name: string;
  name_ja?: string | null;
  image: string;
  category?: string | null;
}

interface ProductPickerProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (products: ProductLite[]) => void;
  initialSelectedIds?: number[];
  maxSelect?: number;
}

export default function ProductPicker({
  open,
  onClose,
  onConfirm,
  initialSelectedIds = [],
  maxSelect = 5,
}: ProductPickerProps) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ProductLite[]>([]);
  const [selected, setSelected] = useState<Map<number, ProductLite>>(new Map());
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초기 선택 상태 복원 (수정 모드용)
  useEffect(() => {
    if (!open) return;
    if (initialSelectedIds.length === 0) {
      setSelected(new Map());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, name_ja, image, category")
        .in("id", initialSelectedIds);
      const m = new Map<number, ProductLite>();
      (data || []).forEach((p) => m.set(p.id as number, p as ProductLite));
      setSelected(m);
    })();
  }, [open, initialSelectedIds.join(",")]);

  // 검색 (디바운스 300ms)
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      let query = supabase
        .from("products")
        .select("id, name, name_ja, image, category")
        .order("created_at", { ascending: false })
        .limit(30);
      if (q.trim()) {
        const kw = q.trim();
        query = query.or(`name.ilike.%${kw}%,name_ja.ilike.%${kw}%,name_ko.ilike.%${kw}%`);
      }
      const { data } = await query;
      setResults((data as ProductLite[]) || []);
      setLoading(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, open]);

  if (!open) return null;

  const toggle = (p: ProductLite) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(p.id)) {
        next.delete(p.id);
      } else {
        if (next.size >= maxSelect) {
          alert(`최대 ${maxSelect}개까지 선택 가능합니다.`);
          return prev;
        }
        next.set(p.id, p);
      }
      return next;
    });
  };

  const confirm = () => {
    onConfirm(Array.from(selected.values()));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">관련 상품 선택</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              최대 {maxSelect}개 · 선택 <span className="font-medium text-gray-900">{selected.size}</span>개
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            aria-label="close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        {/* 검색 */}
        <div className="px-6 pt-4">
          <div className="relative">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="상품명(한/일) 검색…"
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
          </div>
        </div>

        {/* 선택된 상품 태그 */}
        {selected.size > 0 && (
          <div className="px-6 pt-3 flex flex-wrap gap-1.5">
            {Array.from(selected.values()).map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 pl-1 pr-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs"
              >
                <span className="relative w-5 h-5 bg-white rounded overflow-hidden">
                  <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                </span>
                <span className="max-w-[140px] truncate">{p.name_ja || p.name}</span>
                <button onClick={() => toggle(p)} className="text-blue-500 hover:text-blue-800 leading-none">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* 결과 리스트 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="text-center py-8 text-sm text-gray-400">검색 중…</p>
          ) : results.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">결과 없음</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.map((p) => {
                const on = selected.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => toggle(p)}
                      className={`w-full flex items-center gap-3 px-2 py-2 rounded hover:bg-gray-50 transition text-left ${
                        on ? "bg-blue-50 hover:bg-blue-100" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => {}}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 pointer-events-none"
                      />
                      <div className="relative w-10 h-10 bg-gray-100 rounded overflow-hidden">
                        <Image src={p.image} alt={p.name} fill className="object-cover" unoptimized />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900 truncate">{p.name_ja || p.name}</p>
                        {p.category && (
                          <p className="text-xs text-gray-500 truncate">
                            {p.category} · #{p.id}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
            취소
          </button>
          <button
            onClick={confirm}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800"
          >
            선택 완료 ({selected.size}개)
          </button>
        </div>
      </div>
    </div>
  );
}
