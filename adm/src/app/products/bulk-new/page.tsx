"use client";
// 여러 상품을 한 페이지에서 동시에 등록 (판석이형/YYS 제안)
// 각 행: 이미지 드래그&드롭 + 상품명 + 카테고리 + 가격 + 재고
// [일괄 등록] 버튼 → 각 행 순차 저장 + 성공/실패 리포트

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const categoriesJa = [
  "アクセサリー",
  "ヘアアクセサリー",
  "冬物アイテム",
  "キーリング",
  "メガネ／サングラス",
  "ファッション雑貨",
  "その他（ETC）",
];
const categoriesKo = [
  "악세사리",
  "헤어",
  "겨울상품",
  "키링",
  "안경/선글라스",
  "패션잡화",
  "기타",
];

interface Row {
  key: number;
  images: { file: File | null; preview: string; url?: string }[];
  nameJa: string;
  nameKo: string;
  categoryJa: string;
  price: string;
  originalPrice: string;
  stock: string;
  descriptionJa: string;
  descriptionKo: string;
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
    price: "",
    originalPrice: "",
    stock: "",
    descriptionJa: "",
    descriptionKo: "",
    status: "pending",
  };
}

export default function BulkNewProductsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => makeRow(i)));
  const [uploading, setUploading] = useState(false);
  const nextKeyRef = useRef(INITIAL_ROWS);
  const [dragOverKey, setDragOverKey] = useState<number | null>(null);

  const addRow = () => {
    setRows((prev) => [...prev, makeRow(nextKeyRef.current++)]);
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
        image: urls[0],
        images: urls,
        description: row.descriptionJa || row.descriptionKo || null,
        description_ja: row.descriptionJa || null,
        description_ko: row.descriptionKo || null,
        is_active: true,
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
        <div className="flex items-center gap-2">
          <Link
            href="/products"
            className="px-4 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            취소
          </Link>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50"
          >
            {uploading ? "등록 중..." : `일괄 등록 (${validRows().length}건)`}
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
              {/* 이미지 드롭 영역 */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverKey(row.key);
                }}
                onDragLeave={() => setDragOverKey(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverKey(null);
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
                    {row.images.map((img, i) => (
                      <div key={i} className="relative aspect-square group">
                        <div className={`relative w-full h-full rounded overflow-hidden border ${i === 0 ? "border-blue-500 border-2" : "border-gray-200"}`}>
                          <Image src={img.preview} alt={`img${i}`} fill className="object-cover" unoptimized />
                          {i === 0 && (
                            <span className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] px-1 rounded">M</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(row.key, i)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
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
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">카테고리</label>
                  <select
                    value={row.categoryJa}
                    onChange={(e) => updateRow(row.key, { categoryJa: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    {categoriesJa.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
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
