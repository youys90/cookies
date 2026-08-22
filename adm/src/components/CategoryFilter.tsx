"use client";

// 카테고리 필터 컴포넌트 · 크림디자인팀 v3
// 원칙: 개수 많아도 화면 안 잡아먹기 · 검색 · 명확한 선택 표시
//   - 12개 이하: pill 노출 (기존 UX 유지)
//   - 13개 이상: 드롭다운 (검색 + 스크롤 리스트)
// 관리자가 개발자가 아니어도 · 한 번에 이해 가능한 방식.

import { useEffect, useMemo, useRef, useState } from "react";

type Cat = { id: number; name_ja: string; name_ko: string };

interface Props {
  language: "ko" | "ja";
  categories: Cat[];
  selected: string; // name_ja 또는 "전체"("全体")
  onChange: (name_ja: string) => void;
  label: string;
  allLabel: string;
  indent?: boolean;
}

const PILL_THRESHOLD = 12;

export default function CategoryFilter({ language, categories, selected, onChange, label, allLabel, indent }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const useDropdown = categories.length > PILL_THRESHOLD;

  const pick = (c: Cat) => (language === "ko" ? (c.name_ko || c.name_ja) : (c.name_ja || c.name_ko));
  const tooltip = (c: Cat) => (language === "ko" ? c.name_ja : c.name_ko);

  const selectedCat = useMemo(() => categories.find((c) => c.name_ja === selected), [categories, selected]);
  const selectedLabel = selectedCat ? pick(selectedCat) : allLabel;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => {
      const ko = (c.name_ko || "").toLowerCase();
      const ja = (c.name_ja || "").toLowerCase();
      return ko.includes(q) || ja.includes(q);
    });
  }, [categories, query]);

  // 외부 클릭 시 닫기
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // 드롭다운 열릴 때 검색 자동 포커스
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // ESC 닫기
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={`flex items-start gap-2 ${indent ? "pl-4 border-l-2 border-gray-200" : ""}`}>
      <span className={`whitespace-nowrap pt-1.5 flex-shrink-0 ${indent ? "text-xs text-gray-400" : "text-sm text-gray-500"}`}>{label}</span>

      {useDropdown ? (
        // ─── 드롭다운 방식 (카테고리 13개 이상) ─────────────────
        <div ref={boxRef} className="relative flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected && selected !== "전체" && selected !== "全体" && (
                <span className="w-1.5 h-1.5 bg-gray-900 rounded-full flex-shrink-0" aria-hidden></span>
              )}
              <span className={`truncate ${selected && selected !== "전체" && selected !== "全体" ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                {selectedLabel}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0">({categories.length})</span>
            </span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-40 overflow-hidden">
              {/* 검색 */}
              <div className="p-2 border-b border-gray-100 bg-gray-50">
                <div className="relative">
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={language === "ko" ? "카테고리 검색..." : "カテゴリー検索..."}
                    className="w-full pl-8 pr-3 py-1.5 text-sm bg-white border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* 목록 */}
              <div className="max-h-72 overflow-y-auto" role="listbox">
                {filtered.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-gray-400">
                    {language === "ko" ? "검색 결과 없음" : "該当なし"}
                  </div>
                ) : (
                  filtered.map((cat) => {
                    const active = selected === cat.name_ja;
                    return (
                      <button
                        key={cat.id || "all"}
                        type="button"
                        onClick={() => { onChange(cat.name_ja); setOpen(false); setQuery(""); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition ${
                          active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-100"
                        }`}
                        role="option"
                        aria-selected={active}
                      >
                        <span className="flex-1 truncate">{pick(cat)}</span>
                        {tooltip(cat) !== pick(cat) && (
                          <span className={`text-[10px] truncate max-w-[40%] ${active ? "text-white/60" : "text-gray-400"}`}>{tooltip(cat)}</span>
                        )}
                        {active && (
                          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        // ─── Pill 방식 (12개 이하) ─────────────────────────────
        <div className="flex flex-wrap gap-1.5 flex-1">
          {categories.map((cat) => {
            const active = selected === cat.name_ja;
            const l = pick(cat);
            const t = tooltip(cat);
            return (
              <button
                key={cat.id || "all"}
                onClick={() => onChange(cat.name_ja)}
                className={`transition-colors whitespace-nowrap ${
                  indent
                    ? `px-2.5 py-0.5 text-xs rounded-full ${active ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"}`
                    : `px-3 py-1 text-sm rounded-full ${active ? "bg-gray-900 text-white shadow-sm" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`
                }`}
                title={t !== l ? t : undefined}
              >
                {l}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
