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
import FormActionBar from "@/components/FormActionBar";

interface PoolItem {
  url: string;
  name: string;
  uploading?: boolean;
}

interface RowOption {
  option_name: string;
  additional_price: number;
  stock: number;
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
  imageUrls: string[]; // 매핑된 이미지들 · 사진 순서 = 매장 노출 순서
  options: RowOption[]; // 개별 상품 옵션 (등록/수정 화면과 동일)
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
      alert("파일을 읽지 못했어요. 엑셀 양식이 맞는지 확인해주세요.\n\n오류 내용: " + String(e));
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
        imageUrls: [] as string[],
        options: [] as RowOption[],
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

  // 사진 순서 변경 · 드래그 앤 드롭 (bulk-new와 동일 스타일)
  const [rowImgDrag, setRowImgDrag] = useState<{ rowKey: string | null; from: number | null; over: number | null }>({ rowKey: null, from: null, over: null });
  const moveRowImage = (rowKey: string, from: number, to: number) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== rowKey) return r;
      const a = [...r.imageUrls];
      const [moved] = a.splice(from, 1);
      a.splice(to, 0, moved);
      return { ...r, imageUrls: a };
    }));
  };

  // 개별 행에 직접 사진 업로드 · 세션 풀을 거치지 않음 (풀도 함께 저장)
  const uploadDirectToRow = async (rowKey: string, files: File[]) => {
    const uploaded: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) { console.error("업로드 실패:", error); continue; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      uploaded.push(pub.publicUrl);
      // 세션 풀에도 추가 (다른 행에서 재사용 가능)
      setPool((prev) => [{ url: pub.publicUrl, name: file.name }, ...prev]);
    }
    if (uploaded.length > 0) {
      setRows((prev) => prev.map((r) => r.key === rowKey ? { ...r, imageUrls: [...r.imageUrls, ...uploaded] } : r));
    }
  };

  // 옵션 편집
  const addRowOption = (rowKey: string) => {
    setRows((prev) => prev.map((r) => r.key === rowKey
      ? { ...r, options: [...r.options, { option_name: "", additional_price: 0, stock: 99 }] }
      : r));
  };
  const updateRowOption = (rowKey: string, idx: number, patch: Partial<RowOption>) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== rowKey) return r;
      const next = [...r.options];
      next[idx] = { ...next[idx], ...patch };
      return { ...r, options: next };
    }));
  };
  const removeRowOption = (rowKey: string, idx: number) => {
    setRows((prev) => prev.map((r) => r.key === rowKey
      ? { ...r, options: r.options.filter((_, i) => i !== idx) }
      : r));
  };

  // ── 템플릿 다운로드 · 카테고리 트리 (상위→하위 종속 드롭다운) ──
  const downloadTemplate = async () => {
    setDownloadingTpl(true);
    try {
      // categories는 id/name_ko/parent_id를 포함해야 트리 구성 가능
      const { data: full } = await supabase.from("categories").select("id, name_ko, parent_id").order("id");
      const list = (full || []) as Array<{ id: number; name_ko: string; parent_id: number | null }>;
      const tops = list.filter((c) => c.parent_id === null && c.name_ko);
      const categoryTree = tops.map((t) => ({
        top: t.name_ko,
        subs: list.filter((c) => c.parent_id === t.id && c.name_ko).map((c) => c.name_ko),
      }));
      await downloadProductTemplate({ categoryTree });
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
  // 사진은 온라인쇼핑몰 필수 · imageUrls 없으면 등록 대상에서 제외
  const validCount = rows.filter((r) => r.name_ko && r.price !== null && r.category_ko && r.imageUrls.length > 0).length;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setPhase("등록 준비 중이에요...");
    let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      setPhase(`${i + 1} / ${rows.length} · ${r.name_ko.slice(0, 20)}`);
      // 검증
      if (!r.name_ko) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "상품명이 비어있어요" } : x)); continue; }
      if (r.price === null) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "가격이 비어있어요" } : x)); continue; }
      if (!r.category_ko) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "카테고리가 비어있어요" } : x)); continue; }
      if (r.imageUrls.length === 0) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: "사진이 없어요 · 왼쪽에서 담아 이 상품에 연결해주세요" } : x)); continue; }
      const topCat = catMaps.top.get(r.category_ko);
      if (!topCat) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: `카테고리 「${r.category_ko}」는 카테고리 관리에 없는 이름이에요` } : x)); continue; }
      let subCat: CategoryEntry | undefined;
      if (r.sub_category_ko) {
        subCat = catMaps.sub.get(r.sub_category_ko);
        if (!subCat) { setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: `하위 「${r.sub_category_ko}」는 카테고리 관리에 없는 이름이에요` } : x)); continue; }
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
        stock: 2147483647, // 재고 UI 미노출 · 큰 값 고정
        category: topCat.name_ja,
        category_ja: topCat.name_ja,
        category_ko: topCat.name_ko,
        sub_category: subCat ? subCat.name_ja : null,
        description_ko: r.description_ko || null,
        description_ja: descJa || null,
        is_active: true,
        image: r.imageUrls[0],
        images: r.imageUrls,
        source: "CSV",
      };
      const { data, error } = await supabase.from("products").insert(record).select("id").single();
      if (error) {
        setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "failed", error: error.message } : x));
      } else {
        // 옵션이 있으면 함께 저장 · 실패해도 상품 등록은 성공으로 처리 (한 번 더 편집 가능)
        if (r.options.length > 0 && data?.id) {
          const optionsPayload = r.options
            .filter((o) => o.option_name.trim())
            .map((o, idx) => ({
              product_id: data.id,
              option_name: o.option_name.trim(),
              additional_price: o.additional_price || 0,
              stock: o.stock || 0,
              is_active: true,
              source: "CSV",
              sort_order: idx,
            }));
          if (optionsPayload.length > 0) {
            const { error: optError } = await supabase.from("product_options").insert(optionsPayload);
            if (optError) console.error(`옵션 저장 실패 (상품 ${data.id}):`, optError.message);
          }
        }
        ok++;
        setRows((prev) => prev.map((x) => x.key === r.key ? { ...x, status: "success", productId: data?.id } : x));
      }
    }
    setPhase(`끝났어요 · ${ok}개 등록 완료 (전체 ${rows.length}개)`);
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
            <h1 className="text-2xl font-bold text-gray-900">엑셀로 상품 한꺼번에 등록하기</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            상품 이미지와 작성한 엑셀 파일을 올려주세요. 내용을 확인한 뒤 상품을 한꺼번에 등록할 수 있습니다.
          </p>
        </div>
        {phase && <div className="text-xs text-gray-600 self-center">{phase}</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-4 h-[calc(100vh-160px)]">
        {/* ── 좌 · 이미지 풀 ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center justify-between mb-1.5">
              <h2 className="text-sm font-semibold text-gray-900">📸 상품 이미지</h2>
              <span className="text-[10px] text-gray-400">이 화면을 벗어나면 다시 올려야 해요</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => imgInputRef.current?.click()}
                className="px-3 py-1.5 text-xs bg-[var(--color-brand)] text-white rounded-md hover:bg-[var(--color-brand-dk)] font-medium flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                + 상품 이미지 올리기
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
                선택한 이미지 <b className="text-gray-700">{picked.size}개</b> (총 {pool.length}개)
                {picked.size > 0 ? (
                  <button onClick={clearPicked} className="ml-2 text-gray-500 hover:text-gray-800 underline">해제하기</button>
                ) : pool.length > 0 ? (
                  <button onClick={pickAll} className="ml-2 text-gray-500 hover:text-gray-800 underline">전체 선택</button>
                ) : null}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {pool.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">
                <p className="mb-1">등록할 상품 이미지를 올려주세요</p>
                <p className="text-[11px]">여러 장을 한꺼번에 올릴 수 있어요</p>
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
                        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-[10px]">올리는 중...</div>
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
            💡 이미지를 여러 개 선택한 후 오른쪽 상품 카드를 누르면 · 그 상품에 사진이 연결돼요
          </div>
        </div>

        {/* ── 우 · 엑셀 목록 ────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">📊 상품 엑셀 파일</h2>

            {/* ① 엑셀 양식 내려받기 */}
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">①</span>
              <button
                onClick={downloadTemplate}
                disabled={downloadingTpl}
                className="flex-1 px-3 py-2 text-xs bg-white border border-[var(--color-brand)]/40 text-[var(--color-brand-dk)] rounded-md hover:bg-[var(--color-brand)]/5 font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
                {downloadingTpl ? "양식을 만드는 중이에요..." : "엑셀 양식 내려받기 (상품 정보를 입력할 수 있어요)"}
              </button>
            </div>

            {/* ② 작성한 엑셀 파일 올리기 */}
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">②</span>
              <button
                onClick={() => excelInputRef.current?.click()}
                className="flex-1 px-3 py-2 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 font-medium"
              >
                {rows.length > 0 ? `📄 ${fileName} · 상품 ${rows.length}개 · 다시 선택` : "📄 작성한 엑셀 파일 올리기 (xlsx, csv)"}
              </button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                onChange={(e) => handleExcelInputChange(e.target.files)}
                className="hidden"
              />
              {rows.length > 0 && (
                <button onClick={clearRows} className="text-[11px] text-gray-500 hover:text-gray-700 underline">비우기</button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {rows.length === 0 ? (
              <div className="text-center py-24 text-gray-400 text-sm">
                <p className="mb-1">아직 엑셀 파일을 올리지 않았어요</p>
                <p className="text-[11px]">위 ①에서 양식을 내려받아 작성한 뒤 · ②에서 올려주세요</p>
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
                        title="선택한 이미지를 이 상품에 사진 연결하기"
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
                            <p className="text-sm font-medium text-gray-900 truncate">{r.name_ko || "(상품명이 비어있어요)"}</p>
                            {r.imageUrls.length > 0 && (
                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">📷 {r.imageUrls.length}장</span>
                            )}
                            {r.status === "success" && <span className="text-[9px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">✓ 등록 완료</span>}
                            {r.status === "uploading" && <span className="text-[9px] px-1.5 py-0.5 bg-blue-500 text-white rounded-full">등록하고 있어요</span>}
                            {r.status === "failed" && <span className="text-[9px] px-1.5 py-0.5 bg-red-500 text-white rounded-full">등록하지 못했어요</span>}
                            {!valid && r.status === "idle" && <span className="text-[9px] px-1.5 py-0.5 bg-amber-500 text-white rounded-full">확인이 필요해요</span>}
                          </div>
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            {r.category_ko || "카테고리가 비어있어요"}{r.sub_category_ko ? ` · ${r.sub_category_ko}` : ""}
                            {r.price !== null ? ` · ¥${r.price.toLocaleString()}` : " · 가격이 비어있어요"}
                          </p>
                          {r.error && <p className="text-[10.5px] text-red-600 mt-0.5">{r.error}</p>}
                          {(missingCat || missingSub) && !r.error && (
                            <p className="text-[10.5px] text-amber-700 mt-0.5">
                              {missingCat && `카테고리 「${r.category_ko}」는 카테고리 관리에 없는 이름이에요`}
                              {missingSub && ` · 하위 「${r.sub_category_ko}」는 카테고리 관리에 없는 이름이에요`}
                            </p>
                          )}
                        </div>
                      </button>

                      {r.status !== "success" && (
                        <div className="px-3 pb-3 border-t border-gray-100 pt-3 space-y-3">
                          {/* 사진 그리드 · 드래그 재정렬 · 개별 업로드 (bulk-new 수준) */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">📷 사진 · 첫 번째가 메인</p>
                              <label className="cursor-pointer text-[10px] text-[var(--color-brand-dk)] hover:underline">
                                + 이 상품에 사진 올리기
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files) uploadDirectToRow(r.key, Array.from(e.target.files));
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {r.imageUrls.map((u, i) => {
                                const isDragging = rowImgDrag.rowKey === r.key && rowImgDrag.from === i;
                                const isOver = rowImgDrag.rowKey === r.key && rowImgDrag.over === i && rowImgDrag.from !== i;
                                return (
                                  <div
                                    key={u}
                                    className={`relative group transition-transform ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                                    draggable
                                    onDragStart={() => setRowImgDrag({ rowKey: r.key, from: i, over: null })}
                                    onDragOver={(e) => { e.preventDefault(); if (rowImgDrag.rowKey === r.key && rowImgDrag.from !== null && rowImgDrag.from !== i && rowImgDrag.over !== i) setRowImgDrag({ ...rowImgDrag, over: i }); }}
                                    onDragLeave={() => rowImgDrag.over === i && setRowImgDrag({ ...rowImgDrag, over: null })}
                                    onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (rowImgDrag.rowKey === r.key && rowImgDrag.from !== null && rowImgDrag.from !== i) moveRowImage(r.key, rowImgDrag.from, i); setRowImgDrag({ rowKey: null, from: null, over: null }); }}
                                    onDragEnd={() => setRowImgDrag({ rowKey: null, from: null, over: null })}
                                  >
                                    <div className={`relative w-12 h-12 rounded overflow-hidden border-2 cursor-move transition-all ${
                                      isOver ? "border-blue-500 ring-2 ring-blue-200 shadow" :
                                      i === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                                    }`}>
                                      <Image src={u} alt="" fill unoptimized className="object-cover" />
                                      <div className="absolute top-0 right-0 w-4 h-4 bg-gray-900/85 text-white text-[8px] font-bold rounded-bl flex items-center justify-center">
                                        {i + 1}
                                      </div>
                                      {i === 0 && (
                                        <span className="absolute top-0 left-0 bg-blue-500 text-white text-[8px] font-bold px-1 rounded-br">M</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); removeImgFromRow(r.key, u); }}
                                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                                      title="이 사진 빼기"
                                    >✕</button>
                                  </div>
                                );
                              })}
                              {r.imageUrls.length === 0 && (
                                <p className="text-[10.5px] text-gray-400 italic">사진이 없어요 · 위 「+ 이 상품에 사진 올리기」 or 왼쪽에서 골라주세요</p>
                              )}
                            </div>
                          </div>

                          {/* 옵션 · 색상/사이즈 등 (개별 등록/수정과 동일 · 여러 개 가능) */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">🎨 옵션 (색상 등)</p>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); addRowOption(r.key); }}
                                className="text-[10px] text-[var(--color-brand-dk)] hover:underline"
                              >
                                + 옵션 추가
                              </button>
                            </div>
                            {r.options.length === 0 ? (
                              <p className="text-[10.5px] text-gray-400 italic">옵션 없음 · 필요하시면 「+ 옵션 추가」</p>
                            ) : (
                              <div className="space-y-1.5">
                                {r.options.map((opt, oi) => (
                                  <div key={oi} className="flex items-center gap-1.5 bg-gray-50 rounded p-1.5">
                                    <input
                                      type="text"
                                      value={opt.option_name}
                                      onChange={(e) => updateRowOption(r.key, oi, { option_name: e.target.value })}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="옵션명 (예 · 골드)"
                                      className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded"
                                    />
                                    <span className="text-[10px] text-gray-500">+₩</span>
                                    <input
                                      type="number"
                                      value={opt.additional_price}
                                      onChange={(e) => updateRowOption(r.key, oi, { additional_price: Number(e.target.value) })}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="추가가격"
                                      className="w-24 px-2 py-1 text-xs border border-gray-200 rounded"
                                    />
                                    <span className="text-[10px] text-gray-500">재고</span>
                                    <input
                                      type="number"
                                      value={opt.stock}
                                      onChange={(e) => updateRowOption(r.key, oi, { stock: Number(e.target.value) })}
                                      onClick={(e) => e.stopPropagation()}
                                      placeholder="재고"
                                      className="w-16 px-2 py-1 text-xs border border-gray-200 rounded"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); removeRowOption(r.key, oi); }}
                                      className="text-red-500 hover:bg-red-50 rounded px-1"
                                      title="이 옵션 삭제"
                                    >✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
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

      {/* 표준 하단 sticky 액션 바 */}
      <FormActionBar
        cancelHref="/products"
        cancelLabel="취소"
        status={rows.length > 0 ? <span>총 <b className="text-gray-700">{rows.length}개</b> 중 등록 가능 <b className="text-gray-900">{validCount}개</b> (사진 · 상품명 · 가격 · 카테고리 필수)</span> : "엑셀 파일을 올려주세요"}
        primary={{
          label: busy ? "등록하고 있어요..." : `상품 ${validCount}개 등록하기`,
          onClick: handleSubmit,
          disabled: !canSubmit || validCount === 0,
        }}
      />
    </div>
  );
}
