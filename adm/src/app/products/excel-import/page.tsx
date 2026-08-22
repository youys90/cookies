"use client";

// 엑셀 일괄 업로드 + 이미지 매핑 통합 페이지
// - 좌: 이미지 풀 (세션 스코프 · 업로드 즉시 스토리지 저장)
// - 우: 엑셀 목록 (템플릿 다운로드 · 파일 업로드 · 파싱 · 카드별 이미지 매핑)
// - 하단: 상단 진행/등록 액션 바
//
// 등록 시:
// - 카테고리(한국어) → DB 매핑 → name_ja/category
// - 상품명·설명(한국어) → 자동 번역 → name_ja/description_ja

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import { downloadProductTemplate, parseXlsxToObjects } from "@/lib/xlsxTemplate";
import { parseCsvToObjects } from "@/lib/csv";
import { CSV_HEADER_MAP } from "../page";

interface PoolItem {
  url: string;
  name: string;
  uploading?: boolean;
}

interface ParsedRow {
  raw: Record<string, string>;
  key: string; // 유니크 (등록 후 리스트 재계산 시 안정)
  name_ko: string;
  price: number | null;
  original_price: number | null;
  category_ko: string;
  sub_category_ko: string;
  description_ko: string;
  stock: number | null;
  is_active: boolean;
  imageUrls: string[]; // 좌측에서 매핑된 이미지들
  status: "idle" | "uploading" | "success" | "failed";
  error?: string;
  productId?: number;
}

interface CategoryEntry {
  name_ja: string;
  name_ko: string;
  parent_id: number | null;
}

export default function ExcelImportPage() {
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<string>("");
  const [categories, setCategories] = useState<CategoryEntry[]>([]);
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("categories").select("name_ja, name_ko, parent_id").order("id");
      setCategories(((data as CategoryEntry[]) ?? []).filter((c) => c.name_ko));
    })();
  }, []);

  // 카테고리 매핑 캐시
  const catMaps = useMemo(() => {
    const top = new Map<string, CategoryEntry>();
    const sub = new Map<string, CategoryEntry>();
    for (const c of categories) {
      if (c.parent_id === null) top.set(c.name_ko, c);
      else sub.set(c.name_ko, c);
    }
    return { top, sub };
  }, [categories]);

  // ── 좌 · 이미지 업로드 ──────────────────────────────
  const uploadImages = useCallback(async (files: File[]) => {
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const placeholder: PoolItem = { url: `pending://${path}`, name: file.name, uploading: true };
      setPool((prev) => [placeholder, ...prev]);
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        console.error("upload fail:", error);
        setPool((prev) => prev.filter((p) => p.url !== placeholder.url));
        continue;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      setPool((prev) => prev.map((p) => (p.url === placeholder.url ? { url: pub.publicUrl, name: file.name } : p)));
    }
  }, []);

  const handleImageInputChange = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadImages(Array.from(files));
  };

  const togglePick = (url: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };
  const clearPicked = () => setPicked(new Set());
  const pickAll = () => setPicked(new Set(pool.filter((p) => !p.uploading).map((p) => p.url)));

  // ── 우 · 엑셀 파싱 ─────────────────────────────────
  const parseFile = async (file: File) => {
    setFileName(file.name);
    const nm = file.name.toLowerCase();
    let parsed: Record<string, string>[] = [];
    try {
      if (nm.endsWith(".xlsx") || nm.endsWith(".xls")) parsed = await parseXlsxToObjects(file);
      else parsed = parseCsvToObjects(await file.text());
    } catch (e) {
      alert("파일 파싱 실패: " + String(e));
      return;
    }

    // 한글 헤더 → ParsedRow · 정규화 (공백/괄호 무시)
    const norm = (s: string) => s.replace(/\s+/g, "").replace(/[()（）]/g, "");
    const mappedRows: ParsedRow[] = parsed.map((r, idx) => {
      const rec: Record<string, string> = {};
      // 한글 헤더 → 임시 key
      for (const [label, key] of Object.entries(CSV_HEADER_MAP)) {
        // 완전 일치 + 정규화 매칭
        const exact = r[label];
        let val: string | undefined = exact;
        if (val === undefined) {
          const nl = norm(label);
          for (const k of Object.keys(r)) {
            if (norm(k) === nl) { val = r[k]; break; }
          }
        }
        if (val !== undefined) rec[key] = String(val).trim();
      }
      const num = (v: string | undefined): number | null => {
        if (!v) return null;
        const n = Number(v.replace(/[,\s]/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      return {
        raw: r,
        key: `row_${idx}_${Date.now()}`,
        name_ko: rec.name_ko || "",
        price: num(rec.price),
        original_price: num(rec.original_price),
        category_ko: rec.category_ko || "",
        sub_category_ko: rec.sub_category_ko || "",
        description_ko: rec.description_ko || "",
        stock: num(rec.stock),
        is_active: !rec.is_active ? true : /^(true|1|yes|y|판매중|공개|active|판매)$/i.test(rec.is_active),
        imageUrls: [] as string[],
        status: "idle" as const,
      };
    }).filter((r) => r.name_ko); // 상품명 없는 행은 스킵
    setRows(mappedRows);
  };

  const handleExcelInputChange = (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    parseFile(f);
  };

  const clearRows = () => {
    setRows([]);
    setFileName("");
  };

  // ── 매핑 · 좌측 선택 → 우측 행 클릭 ─────────────────
  const applyPickedToRow = (rowKey: string) => {
    if (picked.size === 0) return;
    setRows((prev) => prev.map((r) => {
      if (r.key !== rowKey) return r;
      const merged = Array.from(new Set([...r.imageUrls, ...Array.from(picked)]));
      return { ...r, imageUrls: merged };
    }));
    clearPicked();
  };

  const removeImgFromRow = (rowKey: string, url: string) => {
    setRows((prev) => prev.map((r) => r.key === rowKey ? { ...r, imageUrls: r.imageUrls.filter((u) => u !== url) } : r));
  };

  // ── 템플릿 다운로드 ────────────────────────────────
  const downloadTemplate = async () => {
    setDownloadingTpl(true);
    try {
      const topCategories = categories.filter((c) => c.parent_id === null).map((c) => c.name_ko);
      const subCategories = categories.filter((c) => c.parent_id !== null).map((c) => c.name_ko);
      await downloadProductTemplate({ topCategories, subCategories });
    } finally {
      setDownloadingTpl(false);
    }
  };

  // ── 등록 ─────────────────────────────────────────
  const translateCache = useRef(new Map<string, string>());
  const doTranslate = async (ko: string): Promise<string> => {
    const key = ko.trim();
    if (!key) return "";
    const cache = translateCache.current;
    if (cache.has(key)) return cache.get(key)!;
    try {
      const ja = await translateKoJa(key, "ko", "ja");
      cache.set(key, ja);
      return ja;
    } catch {
      cache.set(key, key);
      return key;
    }
  };

  const canSubmit = rows.length > 0 && !busy;
  const validCount = rows.filter((r) => r.name_ko && r.price !== null && r.category_ko).length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setPhase("등록 준비 중...");
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setPhase(`${i + 1} / ${rows.length} · ${r.name_ko.slice(0, 20)}`);
      // 검증
      if (!r.name_ko) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "상품명 누락" } : x)); continue; }
      if (r.price === null) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "가격 누락" } : x)); continue; }
      if (!r.category_ko) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "카테고리 누락" } : x)); continue; }
      const topCat = catMaps.top.get(r.category_ko);
      if (!topCat) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: `카테고리 「${r.category_ko}」 매핑 실패` } : x)); continue; }
      let subCat: CategoryEntry | undefined;
      if (r.sub_category_ko) {
        subCat = catMaps.sub.get(r.sub_category_ko);
        if (!subCat) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: `하위 「${r.sub_category_ko}」 매핑 실패` } : x)); continue; }
      }

      setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "uploading" } : x));

      // 번역
      const nameJa = await doTranslate(r.name_ko);
      const descJa = r.description_ko ? await doTranslate(r.description_ko) : "";

      const record: Record<string, unknown> = {
        name: r.name_ko,
        name_ko: r.name_ko,
        name_ja: nameJa || r.name_ko,
        price: r.price,
        original_price: r.original_price,
        stock: r.stock,
        category: topCat.name_ja,
        category_ja: topCat.name_ja,
        category_ko: topCat.name_ko,
        sub_category: subCat ? subCat.name_ja : null,
        description_ko: r.description_ko || null,
        description_ja: descJa || null,
        is_active: r.is_active,
        image: r.imageUrls[0] || "https://placehold.co/600x600/e5e7eb/9ca3af?text=No+Image",
        images: r.imageUrls.length > 0 ? r.imageUrls : null,
        source: "CSV",
      };
      const { data, error } = await supabase.from("products").insert(record).select("id").single();
      if (error) {
        setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: error.message } : x));
      } else {
        ok++;
        setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "success", productId: data?.id } : x));
      }
    }
    setPhase(`완료 · 성공 ${ok}건 / 전체 ${rows.length}건`);
    setBusy(false);
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">
            <Link href="/products" className="hover:text-gray-700">← 상품 관리</Link>
          </div>
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
            <h1 className="text-2xl font-bold text-gray-900">Excel로 일괄업로드</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            좌 · 이미지 풀에 올려두고 → 우 · 엑셀 목록의 상품 카드를 클릭해 매핑 → 「등록」
          </p>
        </div>
        <div className="flex items-center gap-3">
          {phase && <span className="text-xs text-gray-600">{phase}</span>}
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || validCount === 0}
            className="px-5 py-2.5 text-sm bg-[var(--color-brand)] hover:bg-[var(--color-brand-dk)] text-white rounded-lg font-semibold disabled:opacity-40 shadow-sm"
          >
            {busy ? "등록 중..." : `${validCount}건 등록`}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 h-[calc(100vh-160px)]">
        {/* ── 좌 · 이미지 풀 ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-sm font-semibold text-gray-900">📸 이미지 풀</h2>
              <span className="text-[10px] text-gray-400">💾 이 세션에만 유지</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => imgInputRef.current?.click()}
                className="px-3 py-1.5 text-xs bg-[var(--color-brand)] text-white rounded-md hover:bg-[var(--color-brand-dk)] font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                이미지 업로드
              </button>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleImageInputChange(e.target.files)}
                className="hidden"
              />
              <div className="ml-auto text-[11px] text-gray-500">
                선택 <b className="text-gray-700">{picked.size}</b> / {pool.length}
                {picked.size > 0 ? (
                  <button onClick={clearPicked} className="ml-2 text-gray-500 hover:text-gray-800 underline">해제</button>
                ) : pool.length > 0 ? (
                  <button onClick={pickAll} className="ml-2 text-gray-500 hover:text-gray-800 underline">전체</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pool.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">
                <p className="mb-1">이미지 풀이 비어있습니다</p>
                <p className="text-[11px]">↑ 위 「이미지 업로드」로 사진들을 담아주세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-2">
                {pool.map((p) => {
                  const active = picked.has(p.url);
                  return (
                    <button
                      key={p.url}
                      type="button"
                      disabled={p.uploading}
                      onClick={() => togglePick(p.url)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition ${p.uploading ? "border-gray-100 bg-gray-50" : active ? "border-[var(--color-brand)] ring-2 ring-[var(--color-brand)]/30" : "border-gray-200 hover:border-gray-400"}`}
                      title={p.name}
                    >
                      {p.uploading ? (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px]">업로드 중...</div>
                      ) : (
                        <>
                          <Image src={p.url} alt={p.name} fill unoptimized className="object-cover" />
                          {active && (
                            <div className="absolute top-1 right-1 w-6 h-6 bg-[var(--color-brand)] text-white rounded-full flex items-center justify-center shadow">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            </div>
                          )}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500">
            💡 이미지 여러 개 체크 → 우측 상품 카드 클릭 = 매핑
          </div>
        </div>

        {/* ── 우 · 엑셀 목록 ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">📊 Excel 목록</h2>

            {/* 스텝 1 · 템플릿 다운로드 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">1</span>
              <button
                onClick={downloadTemplate}
                disabled={downloadingTpl}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[var(--color-brand)]/40 text-[var(--color-brand-dk)] rounded-md hover:bg-[var(--color-brand)]/5 font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
                {downloadingTpl ? "생성 중..." : "XLSX 템플릿 다운로드 (드롭다운 · 안내시트 포함)"}
              </button>
            </div>

            {/* 스텝 2 · 파일 선택 */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">2</span>
              <button
                onClick={() => excelInputRef.current?.click()}
                className="flex-1 px-3 py-2 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium"
              >
                {rows.length > 0 ? `📄 ${fileName} (${rows.length}행) · 다시 선택` : "📄 xlsx / csv 파일 선택"}
              </button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                onChange={(e) => handleExcelInputChange(e.target.files)}
                className="hidden"
              />
              {rows.length > 0 && (
                <button onClick={clearRows} className="text-[11px] text-gray-500 hover:text-gray-700 underline">초기화</button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {rows.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">
                <p className="mb-1">엑셀 파일을 업로드하세요</p>
                <p className="text-[11px]">↑ 위 스텝 1로 템플릿 다운 → 채운 뒤 → 스텝 2로 업로드</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map((r, idx) => {
                  const missingCat = r.category_ko && !catMaps.top.has(r.category_ko);
                  const missingSub = r.sub_category_ko && !catMaps.sub.has(r.sub_category_ko);
                  const valid = r.name_ko && r.price !== null && r.category_ko && !missingCat && !missingSub;
                  return (
                    <div
                      key={r.key}
                      className={`rounded-lg border transition ${r.status === "success"
                        ? "border-emerald-300 bg-emerald-50/40"
                        : r.status === "failed"
                          ? "border-red-300 bg-red-50/40"
                          : r.status === "uploading"
                            ? "border-blue-300 bg-blue-50/40"
                            : !valid
                              ? "border-amber-300 bg-amber-50/30"
                              : "border-gray-200 bg-white"
                        }`}
                    >
                      <button
                        type="button"
                        disabled={busy || r.status === "success"}
                        onClick={() => applyPickedToRow(r.key)}
                        className="w-full p-3 flex items-center gap-3 hover:bg-black/[0.02] transition text-left disabled:opacity-70 disabled:cursor-default"
                        title="선택한 이미지를 이 상품에 매핑"
                      >
                        <span className="text-[11px] text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}</span>
                        {/* 썸네일 스택 */}
                        <div className="flex -space-x-2 flex-shrink-0">
                          {r.imageUrls.length > 0 ? (
                            r.imageUrls.slice(0, 3).map((u) => (
                              <div key={u} className="relative w-12 h-12 rounded-md border-2 border-white shadow-sm overflow-hidden bg-gray-100">
                                <Image src={u} alt="" fill unoptimized className="object-cover" />
                              </div>
                            ))
                          ) : (
                            <div className="w-12 h-12 rounded-md border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-lg">📷</div>
                          )}
                          {r.imageUrls.length > 3 && (
                            <div className="w-12 h-12 rounded-md border-2 border-white bg-gray-900/80 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">+{r.imageUrls.length - 3}</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.name_ko || "(상품명 없음)"}</p>
                            {r.imageUrls.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">📷 {r.imageUrls.length}</span>
                            )}
                            {r.status === "success" && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">✓ 등록됨</span>}
                            {r.status === "uploading" && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500 text-white rounded-full">등록 중...</span>}
                            {r.status === "failed" && <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded-full">✗ 실패</span>}
                            {!valid && r.status === "idle" && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500 text-white rounded-full">! 검토 필요</span>}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {r.category_ko || "카테고리 없음"}{r.sub_category_ko ? ` · ${r.sub_category_ko}` : ""}
                            {r.price !== null ? ` · ¥${r.price.toLocaleString()}` : " · 가격 없음"}
                            {r.stock !== null ? ` · 재고 ${r.stock}` : ""}
                          </p>
                          {r.error && <p className="text-[10.5px] text-red-600 mt-0.5">{r.error}</p>}
                          {(missingCat || missingSub) && !r.error && (
                            <p className="text-[10.5px] text-amber-700 mt-0.5">
                              {missingCat && `카테고리 「${r.category_ko}」 DB에 없음`}
                              {missingSub && ` · 하위 「${r.sub_category_ko}」 DB에 없음`}
                            </p>
                          )}
                        </div>
                      </button>

                      {r.imageUrls.length > 0 && r.status !== "success" && (
                        <div className="px-3 pb-2 flex items-center gap-1 flex-wrap border-t border-gray-100 pt-2">
                          {r.imageUrls.map((u) => (
                            <div key={u} className="relative w-8 h-8 rounded border border-gray-200 overflow-hidden group">
                              <Image src={u} alt="" fill unoptimized className="object-cover" />
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); removeImgFromRow(r.key, u); }}
                                className="absolute inset-0 bg-black/60 text-white text-[10px] opacity-0 group-hover:opacity-100 flex items-center justify-center"
                                title="이 상품에서 제거"
                              >✕</button>
                            </div>
                          ))}
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
