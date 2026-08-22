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

type ViewMode = "pill" | "dropdown";
const STORAGE_KEY = "adm.categoryFilterView";

export default function CategoryFilter({ language, categories, selected, onChange, label, allLabel, indent }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("pill"); // 기본 pill
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // localStorage에서 선호 뷰 로드 + 다른 인스턴스 변경 실시간 sync
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dropdown" || saved === "pill") setView(saved);
    } catch {}
    // custom event로 같은 탭 내 여러 CategoryFilter 인스턴스 sync
    const onSync = (e: Event) => {
      const detail = (e as CustomEvent<ViewMode>).detail;
      if (detail === "pill" || detail === "dropdown") setView(detail);
    };
    window.addEventListener("adm:category-view-change", onSync as EventListener);
    return () => window.removeEventListener("adm:category-view-change", onSync as EventListener);
  }, []);

  const changeView = (v: ViewMode) => {
    setView(v);
    try { localStorage.setItem(STORAGE_KEY, v); } catch {}
    if (v === "pill") setOpen(false);
    // 같은 페이지의 다른 CategoryFilter들도 동시 스왑
    window.dispatchEvent(new CustomEvent("adm:category-view-change", { detail: v }));
  };

  const useDropdown = view === "dropdown";

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
      <div className="flex items-center gap-2 pt-1 flex-shrink-0">
        <span className={`whitespace-nowrap font-medium ${indent ? "text-xs text-gray-400" : "text-sm text-gray-600"}`}>{label}</span>
        {/* 뷰 전환 토글 · 브랜드 컬러 활성 · 최상위(!indent)만 · 하위는 자동 sync */}
        {!indent && (
          <div className="inline-flex items-center bg-white rounded-full p-0.5 ml-1 border border-gray-200 shadow-sm" role="group" aria-label={language === "ko" ? "카테고리 보기 방식" : "カテゴリー表示方式"}>
            <button
              type="button"
              onClick={() => changeView("pill")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-[11px] font-semibold ${
                view === "pill"
                  ? "bg-[var(--color-brand)] text-white shadow-md"
                  : "text-gray-500 hover:text-[var(--color-brand-dk)] hover:bg-[var(--color-brand)]/5"
              }`}
              title="모든 카테고리를 한 눈에 · 개수 적을 때 편리"
              aria-pressed={view === "pill"}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 6h16M4 12h16M4 18h16" /></svg>
              <span>간편</span>
            </button>
            <button
              type="button"
              onClick={() => changeView("dropdown")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all text-[11px] font-semibold ${
                view === "dropdown"
                  ? "bg-[var(--color-brand)] text-white shadow-md"
                  : "text-gray-500 hover:text-[var(--color-brand-dk)] hover:bg-[var(--color-brand)]/5"
              }`}
              title="검색으로 빠르게 · 카테고리 많을 때 편리"
              aria-pressed={view === "dropdown"}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span>검색</span>
            </button>
          </div>
        )}
      </div>

      {useDropdown ? (
        // ─── 드롭다운 방식 · 브랜드 톤 ─────────────────
        <div ref={boxRef} className="relative flex-1 max-w-md">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`w-full flex items-center justify-between px-4 py-1.5 bg-white border rounded-full text-sm transition shadow-sm ${
              open ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/20" : "border-gray-200 hover:border-[var(--color-brand)]/60"
            }`}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className="flex items-center gap-2 min-w-0">
              {selected && selected !== "전체" && selected !== "全体" && (
                <span className="w-2 h-2 bg-[var(--color-brand)] rounded-full flex-shrink-0" aria-hidden></span>
              )}
              <span className={`truncate ${selected && selected !== "전체" && selected !== "全体" ? "text-gray-900 font-semibold" : "text-gray-500"}`}>
                {selectedLabel}
              </span>
              <span className="text-[10px] text-gray-400 flex-shrink-0 bg-gray-100 rounded-full px-1.5 py-0.5 font-medium">{categories.length}</span>
            </span>
            <svg className={`w-4 h-4 transition-transform flex-shrink-0 ${open ? "rotate-180 text-[var(--color-brand)]" : "text-gray-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {open && (
            <div className="absolute left-0 right-0 top-full mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl z-40 overflow-hidden">
              {/* 검색 · 브랜드 focus 링 */}
              <div className="p-3 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="카테고리 검색..."
                    className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40 focus:border-[var(--color-brand)] transition"
                  />
                </div>
              </div>

              {/* 목록 */}
              <div className="max-h-72 overflow-y-auto py-1" role="listbox">
                {filtered.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-gray-400">
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
                          active
                            ? "bg-[var(--color-brand)]/10 text-[var(--color-brand-dk)] font-semibold border-l-2 border-[var(--color-brand)]"
                            : "text-gray-700 hover:bg-gray-50 border-l-2 border-transparent"
                        }`}
                        role="option"
                        aria-selected={active}
                      >
                        <span className="flex-1 truncate">{pick(cat)}</span>
                        {tooltip(cat) !== pick(cat) && (
                          <span className={`text-[10px] truncate max-w-[40%] ${active ? "text-[var(--color-brand-dk)]/70" : "text-gray-400"}`}>{tooltip(cat)}</span>
                        )}
                        {active && (
                          <svg className="w-4 h-4 flex-shrink-0 text-[var(--color-brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
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
        // ─── Pill 방식 (12개 이하) · 브랜드 컬러 활성 ─────────────────
        <div className="flex flex-wrap gap-1.5 flex-1">
          {categories.map((cat) => {
            const active = selected === cat.name_ja;
            const l = pick(cat);
            const t = tooltip(cat);
            return (
              <button
                key={cat.id || "all"}
                onClick={() => onChange(cat.name_ja)}
                className={`transition-all whitespace-nowrap font-medium ${
                  indent
                    ? active
                      ? "px-3 py-1 text-xs rounded-full bg-[var(--color-brand)] text-white shadow-sm"
                      : "px-3 py-1 text-xs rounded-full bg-white text-gray-600 border border-gray-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)]"
                    : active
                      ? "px-3.5 py-1.5 text-sm rounded-full bg-[var(--color-brand)] text-white shadow-md ring-2 ring-[var(--color-brand)]/20"
                      : "px-3.5 py-1.5 text-sm rounded-full bg-gray-50 text-gray-700 border border-gray-200 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)] hover:bg-white"
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

