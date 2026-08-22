"use client";
// 여러 상품을 한 페이지에서 동시에 등록 (판석이형/YYS 제안)
// 각 행: 이미지 드래그&드롭 + 상품명 + 카테고리 + 가격 + 재고
// [일괄 등록] 버튼 → 각 행 순차 저장 + 성공/실패 리포트

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";

const categoriesJa = [
  "アクセサリー",
  "ヘアアクセサリー",
  "冬物アイテム",
  "キーリング",
  "メガネ／サングラス",
  "ファッション雑貨",
  "その他（ETC）",
  "➡ Premium High-Quality ✨",
];
const categoriesKo = [
  "악세사리",
  "헤어",
  "겨울상품",
  "키링",
  "안경/선글라스",
  "패션잡화",
  "기타",
  "➡ Premium High-Quality ✨",
];

interface Row {
  key: number;
  images: { file: File | null; preview: string; url?: string }[];
  nameJa: string;
  nameKo: string;
  categoryJa: string;
  subCategoryJa: string;
  price: string;
  originalPrice: string;
  stock: string;
  descriptionJa: string;
  descriptionKo: string;
  isActive: boolean;
  status?: "pending" | "uploading" | "ok" | "error";
  error?: string;
}

const INITIAL_ROWS = 5;

function makeRow(key: number): Row {
  return {
    key,
    images: [],
    nameJa: "",
    nameKo: "",
    categoryJa: categoriesJa[0],
    subCategoryJa: "",
    price: "",
    originalPrice: "",
    stock: "",
    descriptionJa: "",
    descriptionKo: "",
    isActive: true,
    status: "pending",
  };
}

export default function BulkNewProductsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => makeRow(i)));
  const [uploading, setUploading] = useState(false);
  const nextKeyRef = useRef(INITIAL_ROWS);
  const [dragOverKey, setDragOverKey] = useState<number | null>(null);

  // 카테고리 실시간 로드 (라이브 데이터) · 최상위 + 하위 모두
  const [liveCategories, setLiveCategories] = useState<Array<{ id: number; name_ja: string; name_ko: string; parent_id: number | null }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ja, name_ko, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setLiveCategories(((data as Array<{ id: number; name_ja: string; name_ko: string | null; parent_id: number | null }> ) || []).map((c) => ({
        id: c.id,
        name_ja: c.name_ja,
        name_ko: c.name_ko || c.name_ja,
        parent_id: c.parent_id,
      })));
    })();
  }, []);
  const topCats = useMemo(() => liveCategories.filter((c) => c.parent_id === null), [liveCategories]);
  const subCatsFor = (parentJa: string) => {
    const parent = liveCategories.find((c) => c.parent_id === null && c.name_ja === parentJa);
    if (!parent) return [];
    return liveCategories.filter((c) => c.parent_id === parent.id);
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeRow(nextKeyRef.current++)]);
  };

  // 일괄 자동 번역 · JP → KO or KO → JP · 빈 필드만 채움
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string>("");
  const bulkTranslate = async () => {
    if (translating) return;
    setTranslating(true);
    setTranslateMsg("");
    let done = 0;
    let skipped = 0;
    const targets = rows.filter((r) => (r.nameJa && !r.nameKo) || (r.nameKo && !r.nameJa) || (r.descriptionJa && !r.descriptionKo) || (r.descriptionKo && !r.descriptionJa));
    if (targets.length === 0) {
      setTranslating(false);
      setTranslateMsg("번역할 항목이 없습니다 (양쪽 다 입력됐거나 · 둘 다 비어있음)");
      setTimeout(() => setTranslateMsg(""), 3000);
      return;
    }
    for (const r of targets) {
      try {
        const patch: Partial<Row> = {};
        if (r.nameJa && !r.nameKo) patch.nameKo = await translateKoJa(r.nameJa, "ja", "ko");
        else if (r.nameKo && !r.nameJa) patch.nameJa = await translateKoJa(r.nameKo, "ko", "ja");
        if (r.descriptionJa && !r.descriptionKo) patch.descriptionKo = await translateKoJa(r.descriptionJa, "ja", "ko");
        else if (r.descriptionKo && !r.descriptionJa) patch.descriptionJa = await translateKoJa(r.descriptionKo, "ko", "ja");
        if (Object.keys(patch).length > 0) {
          updateRow(r.key, patch);
          done++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
    setTranslating(false);
    setTranslateMsg(`번역 완료 · 성공 ${done}건${skipped ? ` · 스킵 ${skipped}건` : ""}`);
    setTimeout(() => setTranslateMsg(""), 4000);
  };

  const removeRow = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  const addImagesToRow = (key: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    const readers = arr.map(
      (file) =>
        new Promise<{ file: File; preview: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ file, preview: reader.result as string });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((imgs) => {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, images: [...r.images, ...imgs] } : r))
      );
    });
  };

  // 행 내부 이미지 드래그 순서 변경 상태
  const [rowDrag, setRowDrag] = useState<{ rowKey: number | null; from: number | null; over: number | null }>({ rowKey: null, from: null, over: null });
  const moveRowImage = (key: number, from: number, to: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const a = [...r.images];
        const [moved] = a.splice(from, 1);
        a.splice(to, 0, moved);
        return { ...r, images: a };
      })
    );
  };

  const removeImage = (key: number, imgIndex: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, images: r.images.filter((_, i) => i !== imgIndex) } : r
      )
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const validRows = () =>
    rows.filter((r) => r.images.length > 0 && r.nameJa.trim() && r.price.trim());

  const handleSubmit = async () => {
    const valid = validRows();
    if (valid.length === 0) {
      alert("최소 1행 이상: 이미지 + 상품명(일본어) + 가격 이 채워져야 합니다");
      return;
    }
    if (!confirm(`${valid.length}건 일괄 등록합니다. 진행할까요?`)) return;

    setUploading(true);
    let ok = 0;
    const failed: { key: number; nameJa: string; reason: string }[] = [];

    for (const row of valid) {
      updateRow(row.key, { status: "uploading" });

      // 이미지 업로드
      const urls: string[] = [];
      for (const img of row.images) {
        if (img.file) {
          const u = await uploadImage(img.file);
          if (u) urls.push(u);
        } else if (img.url) {
          urls.push(img.url);
        }
      }
      if (urls.length === 0) {
        updateRow(row.key, { status: "error", error: "이미지 업로드 실패" });
        failed.push({ key: row.key, nameJa: row.nameJa, reason: "이미지 업로드 실패" });
        continue;
      }

      // 카테고리 매핑
      const catIdx = categoriesJa.indexOf(row.categoryJa);
      const catKo = catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0];

      const { error } = await supabase.from("products").insert({
        name: row.nameJa || row.nameKo,
        name_ja: row.nameJa,
        name_ko: row.nameKo,
        price: Number(row.price),
        original_price: row.originalPrice ? Number(row.originalPrice) : null,
        stock: row.stock ? Number(row.stock) : null,
        category: row.categoryJa,
        category_ja: row.categoryJa,
        category_ko: catKo,
        sub_category: row.subCategoryJa || null,
        image: urls[0],
        images: urls,
        description: row.descriptionJa || row.descriptionKo || null,
        description_ja: row.descriptionJa || null,
        description_ko: row.descriptionKo || null,
        is_active: !!row.isActive,
      });

      if (error) {
        updateRow(row.key, { status: "error", error: error.message });
        failed.push({ key: row.key, nameJa: row.nameJa, reason: error.message });
      } else {
        updateRow(row.key, { status: "ok" });
        ok++;
      }
    }

    setUploading(false);

    if (failed.length === 0) {
      alert(`✓ ${ok}건 모두 등록 완료`);
      router.push("/products");
    } else {
      alert(`성공 ${ok}건 / 실패 ${failed.length}건\n실패 항목은 삭제 후 재시도해주세요.`);
    }
  };

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-medium text-gray-900">상품 일괄 등록</h1>
          <p className="text-sm text-gray-500 mt-1">
            여러 상품을 한 번에 등록합니다. 각 행에 이미지를 드래그&드롭 하세요.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {translateMsg && (
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 font-medium">{translateMsg}</span>
          )}
          <button
            onClick={bulkTranslate}
            disabled={translating || uploading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 shadow-sm transition"
            title="비어있는 반대 언어 필드 자동 채움 (상품명 · 상품설명)"
          >
            {translating ? "🌐 번역 중..." : "🌐 일괄 자동번역"}
          </button>
          <Link
            href="/products"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 shadow-sm transition"
          >
            {uploading ? "등록 중..." : `🆕 일괄 등록 (${validRows().length}건)`}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className={`bg-white rounded-xl shadow-sm p-4 border-2 transition ${
              row.status === "ok"
                ? "border-green-400"
                : row.status === "error"
                  ? "border-red-400"
                  : row.status === "uploading"
                    ? "border-blue-400 animate-pulse"
                    : "border-transparent"
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-4 items-start">
              {/* 이미지 드롭 영역 · 카드 순서 변경 드래그와 파일 drop 명확 구분 */}
              <div
                onDragOver={(e) => {
                  // 카드 순서 변경 중이면 외부 drop 인디케이터 안 띄움
                  if (rowDrag.from !== null) return;
                  // 실제 파일 drag만 감지
                  if (!e.dataTransfer.types.includes("Files")) return;
                  e.preventDefault();
                  setDragOverKey(row.key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverKey(null);
                  // 카드 순서 변경 중이면 파일 추가 안 함 (중복 방지)
                  if (rowDrag.from !== null) return;
                  // 실제 파일이 아닌 drag는 무시 (브라우저의 이미지 요소 기본 dragging 등)
                  if (!e.dataTransfer.types.includes("Files")) return;
                  if (e.dataTransfer.files.length > 0) addImagesToRow(row.key, e.dataTransfer.files);
                }}
                className={`border-2 border-dashed rounded-lg p-3 min-h-[120px] cursor-pointer transition ${
                  dragOverKey === row.key
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-400 bg-gray-50"
                }`}
              >
                {row.images.length === 0 ? (
                  <label className="cursor-pointer flex flex-col items-center justify-center h-full text-center py-4">
                    <svg className="w-8 h-8 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    <p className="text-xs text-gray-500">드래그 또는 클릭</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {row.images.map((img, i) => {
                      const isDragging = rowDrag.rowKey === row.key && rowDrag.from === i;
                      const isOver = rowDrag.rowKey === row.key && rowDrag.over === i && rowDrag.from !== i;
                      return (
                      <div
                        key={i}
                        className={`relative aspect-square group transition-transform ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                        draggable
                        onDragStart={() => setRowDrag({ rowKey: row.key, from: i, over: null })}
                        onDragOver={(e) => { e.preventDefault(); if (rowDrag.rowKey === row.key && rowDrag.from !== null && rowDrag.from !== i && rowDrag.over !== i) setRowDrag({ ...rowDrag, over: i }); }}
                        onDragLeave={() => rowDrag.over === i && setRowDrag({ ...rowDrag, over: null })}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (rowDrag.rowKey === row.key && rowDrag.from !== null && rowDrag.from !== i) moveRowImage(row.key, rowDrag.from, i); setRowDrag({ rowKey: null, from: null, over: null }); }}
                        onDragEnd={() => setRowDrag({ rowKey: null, from: null, over: null })}
                      >
                        {isOver && <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-blue-500 rounded z-20"></div>}
                        <div className={`relative w-full h-full rounded overflow-hidden border-2 cursor-move transition-all ${
                          isOver ? "border-blue-500 ring-2 ring-blue-200 shadow" :
                          i === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                        }`}>
                          <Image src={img.preview} alt={`img${i}`} fill className="object-cover" unoptimized />
                          {/* 순번 배지 · 우상단 · 등록/수정과 동일 스타일 */}
                          <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/85 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow ring-1 ring-white/20">
                            {i + 1}
                          </div>
                          {i === 0 && (
                            <span className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] font-bold px-1 rounded shadow">M</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(row.key, i)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                        >
                          ✕
                        </button>
                      </div>
                      );
                    })}
                    <label className="cursor-pointer aspect-square border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 hover:border-gray-500">
                      <span className="text-lg">+</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* 입력 필드들 */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 JP *</label>
                  <input
                    type="text"
                    value={row.nameJa}
                    onChange={(e) => updateRow(row.key, { nameJa: e.target.value })}
                    placeholder="ゴールドチェーンネックレス"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 KR</label>
                  <input
                    type="text"
                    value={row.nameKo}
                    onChange={(e) => updateRow(row.key, { nameKo: e.target.value })}
                    placeholder="골드 체인 목걸이"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">카테고리 · 실시간</label>
                  <select
                    value={row.categoryJa}
                    onChange={(e) => updateRow(row.key, { categoryJa: e.target.value, subCategoryJa: "" })}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {(topCats.length > 0 ? topCats.map(c => c.name_ja) : categoriesJa).map((cJa) => {
                      const cat = topCats.find(c => c.name_ja === cJa);
                      return <option key={cJa} value={cJa}>{cat ? `${cat.name_ko} / ${cat.name_ja}` : cJa}</option>;
                    })}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">가격 *</label>
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    placeholder="10000"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">정가</label>
                  <input
                    type="number"
                    value={row.originalPrice}
                    onChange={(e) => updateRow(row.key, { originalPrice: e.target.value })}
                    placeholder="-"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">재고</label>
                  <input
                    type="number"
                    value={row.stock}
                    onChange={(e) => updateRow(row.key, { stock: e.target.value })}
                    placeholder="-"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                {/* 하위 카테고리 · 라이브 · 상위 선택 시 그 하위만 · 판매상태 드롭다운 */}
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">
                    하위 카테고리 · 실시간 ({subCatsFor(row.categoryJa).length}건)
                  </label>
                  <select
                    value={row.subCategoryJa}
                    onChange={(e) => updateRow(row.key, { subCategoryJa: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                    disabled={subCatsFor(row.categoryJa).length === 0}
                  >
                    <option value="">— 선택 안 함 —</option>
                    {subCatsFor(row.categoryJa).map((s) => (
                      <option key={s.id} value={s.name_ja}>{s.name_ko} / {s.name_ja}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">판매 상태</label>
                  <select
                    value={row.isActive ? "on" : "off"}
                    onChange={(e) => updateRow(row.key, { isActive: e.target.value === "on" })}
                    className={`mt-1 w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${
                      row.isActive ? "bg-green-50 border-green-300 text-green-800" : "bg-gray-100 border-gray-300 text-gray-600"
                    }`}
                  >
                    <option value="on">✓ 판매중 (shop 노출)</option>
                    <option value="off">숨김 (shop 미노출)</option>
                  </select>
                </div>

                {/* 상품설명 JP / KO */}
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (일본어)</label>
                  <textarea
                    value={row.descriptionJa}
                    onChange={(e) => updateRow(row.key, { descriptionJa: e.target.value })}
                    placeholder="商品説明 (일본어)"
                    rows={2}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (한국어)</label>
                  <textarea
                    value={row.descriptionKo}
                    onChange={(e) => updateRow(row.key, { descriptionKo: e.target.value })}
                    placeholder="상품 설명 (한국어)"
                    rows={2}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y"
                  />
                </div>

                {row.error && (
                  <div className="col-span-6 text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">
                    ⚠ {row.error}
                  </div>
                )}
                {row.status === "ok" && (
                  <div className="col-span-6 text-[11px] text-green-600 bg-green-50 px-2 py-1 rounded">
                    ✓ 등록 완료
                  </div>
                )}
              </div>

              {/* 행 삭제 */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
                <button
                  onClick={() => removeRow(row.key)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition"
                  title="행 삭제"
                  disabled={uploading}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 행 추가 */}
      <button
        onClick={addRow}
        disabled={uploading}
        className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition disabled:opacity-50"
      >
        + 행 추가
      </button>

      {/* 하단 반복 등록 버튼 */}
      <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-xl">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{rows.length}행</span> 중 등록 가능
          <span className="ml-1 font-medium text-gray-900">{validRows().length}건</span>
          <span className="text-gray-400 ml-2 text-xs">(이미지 + 상품명 + 가격 필수)</span>
        </p>
        <button
          onClick={handleSubmit}
          disabled={uploading || validRows().length === 0}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
        >
          {uploading ? "등록 중..." : `일괄 등록 (${validRows().length}건)`}
        </button>
      </div>
    </div>
  );
}
