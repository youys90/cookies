"use client";

// 리뷰 일괄 등록 · 여러 리뷰를 한 화면에서 동시에 등록
// - 상품 bulk-new와 동일한 UX (카드 여러 개 · 사진 드래그&드롭 · 임시저장)
// - 각 카드: 사진 · 별점 · 내용 · 작성자명 · 관련 상품
// - 저장 시: type="admin" 고정, is_active=true

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import FormActionBar from "@/components/FormActionBar";
import ProductPicker from "@/components/ProductPicker";
import DraftSaveButton from "@/components/DraftSaveButton";
import ImageLibraryPicker from "@/components/ImageLibraryPicker";
import { upsertDraft, listDrafts, deleteDraft } from "@/lib/adminDrafts";
import { SESSION_KEYS, loadSession, saveSession } from "@/lib/sessionPersistence";

const PAGE_KEY = "review-bulk-new";
const PAGE_LABEL = "리뷰 일괄 등록";

interface ReviewProductLite {
  id: number;
  name: string;
  image?: string;
}

interface ReviewRow {
  key: number;
  images: { file: File | null; preview: string; url?: string }[];
  rating: number;
  content: string;
  author_name: string;
  products: ReviewProductLite[];
  status?: "pending" | "uploading" | "ok" | "error";
  error?: string;
}

const INITIAL_ROWS = 5;
const MAX_IMAGES_PER_REVIEW = 3;

function makeRow(key: number): ReviewRow {
  return {
    key,
    images: [],
    rating: 5,
    content: "",
    author_name: "",
    products: [],
    status: "pending",
  };
}

function BulkNewReviewsInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const [rows, setRows] = useState<ReviewRow[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => makeRow(i)));
  const [uploading, setUploading] = useState(false);
  const nextKeyRef = useRef(INITIAL_ROWS);
  const [dragOverKey, setDragOverKey] = useState<number | null>(null);
  const [pickerRowKey, setPickerRowKey] = useState<number | null>(null);
  const [productPickerRowKey, setProductPickerRowKey] = useState<number | null>(null);

  // 세션 사진 풀 · 상품 bulk-new와 같은 UX · 여러 리뷰 카드에서 재사용
  const [sessionPool, setSessionPool] = useState<string[]>(() => loadSession<string[]>(SESSION_KEYS.REVIEW_IMAGE_POOL, []));
  const [sessionUploading, setSessionUploading] = useState(false);
  const sessionBulkInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { saveSession(SESSION_KEYS.REVIEW_IMAGE_POOL, sessionPool); }, [sessionPool]);
  const uploadToSessionPool = async (files: File[]) => {
    setSessionUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `reviews/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) { console.error(error); continue; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      newUrls.push(pub.publicUrl);
    }
    if (newUrls.length > 0) setSessionPool((prev) => [...newUrls, ...prev]);
    setSessionUploading(false);
  };

  // 임시저장 · 자동 감지 없음 · 명시적 draft 파라미터로만 이어서 편집
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const requestedDraftId = sp.get("draft");

  useEffect(() => {
    if (!requestedDraftId) return;
    const all = listDrafts(PAGE_KEY);
    const d = all.find((x) => x.id === requestedDraftId);
    if (d && d.data && typeof d.data === "object" && "rows" in (d.data as Record<string, unknown>)) {
      const dr = (d.data as { rows: ReviewRow[] }).rows;
      if (Array.isArray(dr) && dr.length > 0) {
        setRows(dr);
        setCurrentDraftId(d.id);
      }
    }
  }, [requestedDraftId]);

  const manualSave = () => {
    const d = upsertDraft({
      id: currentDraftId || undefined,
      pageKey: PAGE_KEY,
      pageLabel: PAGE_LABEL,
      data: { rows },
    });
    setCurrentDraftId(d.id);
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeRow(nextKeyRef.current++)]);
  };
  const removeRow = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };
  const updateRow = (key: number, patch: Partial<ReviewRow>) => {
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
      setRows((prev) => prev.map((r) => {
        if (r.key !== key) return r;
        const merged = [...r.images, ...imgs].slice(0, MAX_IMAGES_PER_REVIEW);
        return { ...r, images: merged };
      }));
    });
  };
  const removeImage = (key: number, i: number) => {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, images: r.images.filter((_, idx) => idx !== i) } : r));
  };

  const removeProduct = (key: number, productId: number) => {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, products: r.products.filter((p) => p.id !== productId) } : r));
  };

  const uploadImageFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `reviews/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { console.error("upload fail:", error); return null; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleSave = async () => {
    // 최소한 · 사진 1장 + 내용 · 있어야 유효
    // 사장님 요구 · 사진 필수값 아님 · 내용 + 작성자명만 있으면 등록 가능
    const validRows = rows.filter((r) => r.content.trim() && r.author_name.trim());
    if (validRows.length === 0) {
      alert("등록할 리뷰가 없습니다.\n\n각 카드에 내용 · 작성자명 입력 필요.");
      return;
    }
    if (!confirm(`${validRows.length}건의 리뷰를 등록하시겠어요?\n\n(내용·작성자명 입력된 카드만 등록됩니다 · 사진은 선택)`)) return;

    setUploading(true);
    let ok = 0;
    let fail = 0;
    for (const row of validRows) {
      updateRow(row.key, { status: "uploading" });
      const urls: string[] = [];
      for (const img of row.images) {
        if (img.file) {
          const u = await uploadImageFile(img.file);
          if (u) urls.push(u);
        } else if (img.url) {
          urls.push(img.url);
        }
      }
      // 사진 · 필수값 아님 · 없으면 null 저장
      const { error } = await supabase.from("reviews").insert({
        image_url: urls[0] || null,
        images: urls.length > 0 ? urls : null,
        rating: row.rating,
        content: row.content.trim(),
        author_name: row.author_name.trim(),
        is_active: true,
        type: "admin",
        product_id: row.products[0]?.id || null,
        product_ids: row.products.length > 0 ? row.products.map((p) => p.id) : null,
      });
      if (error) {
        updateRow(row.key, { status: "error", error: error.message });
        fail++;
      } else {
        updateRow(row.key, { status: "ok" });
        ok++;
      }
    }
    setUploading(false);
    if (fail === 0) {
      if (currentDraftId) { deleteDraft(currentDraftId); setCurrentDraftId(null); }
      alert(`✓ ${ok}건 등록 완료`);
      router.push("/reviews");
    } else {
      alert(`성공 ${ok}건 / 실패 ${fail}건\n실패 카드는 확인 후 다시 등록해주세요.`);
    }
  };

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl font-medium text-gray-900">리뷰 일괄 등록</h1>
          <p className="text-sm text-gray-500 mt-1">
            여러 리뷰를 한 번에 등록합니다. 각 카드에 이미지를 드래그&드롭 하세요.
          </p>
          <div className="mt-3">
            <DraftSaveButton onSave={manualSave} lastSavedAt={lastSavedAt} savedTick={savedTick} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => sessionBulkInputRef.current?.click()}
            disabled={sessionUploading}
            className={`group relative flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-xl font-medium text-sm shadow-md transition-all disabled:opacity-60 ${
              sessionPool.length === 0
                ? "bg-gradient-to-br from-[var(--color-brand)] via-[#D6A490] to-[var(--color-brand-dk)] text-white hover:shadow-lg hover:-translate-y-0.5"
                : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg"
            }`}
            title="여러 장 사진 담아두고 각 리뷰에 재사용"
          >
            <span className="text-xl">📸</span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold">{sessionPool.length === 0 ? "사진 미리 담기" : `담긴 사진 ${sessionPool.length}장`}</span>
              <span className="text-[10px] opacity-90">▼ 클릭해서 여러 장 한 번에 올리기</span>
            </div>
            {sessionPool.length > 0 && (
              <span className="ml-1 flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-white/25 backdrop-blur rounded-full text-[11px] font-bold border border-white/40">
                {sessionPool.length}
              </span>
            )}
          </button>
          <input
            ref={sessionBulkInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) uploadToSessionPool(Array.from(e.target.files));
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className={`bg-white rounded-xl shadow-sm p-4 border-2 transition ${
              row.status === "ok" ? "border-green-400"
                : row.status === "error" ? "border-red-400"
                : row.status === "uploading" ? "border-blue-400 animate-pulse"
                : "border-transparent"
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-4 items-stretch">
              {/* 이미지 · 상품 bulk-new 스타일 · 큰 드롭존 + 세션 풀 픽커 */}
              {row.images.length === 0 ? (
                <div className={`h-full min-h-[240px] ${sessionPool.length > 0 ? "grid grid-rows-2 gap-2" : ""}`}>
                  <label
                    onDragOver={(e) => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverKey(row.key); }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverKey(null); if (e.dataTransfer.files.length > 0) addImagesToRow(row.key, e.dataTransfer.files); }}
                    className={`cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg transition py-4 px-3 h-full ${sessionPool.length > 0 ? "min-h-[110px]" : "min-h-[240px]"} ${
                      dragOverKey === row.key ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white"
                    }`}
                  >
                    <svg className="w-7 h-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    <p className="text-xs text-gray-700 font-medium leading-tight">리뷰 사진 올리기</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">드래그 또는 클릭 · 최대 {MAX_IMAGES_PER_REVIEW}장</p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)} />
                  </label>
                  {sessionPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerRowKey(row.key)}
                      className="flex flex-col items-center justify-center text-center rounded-lg transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-emerald-500 py-4 px-3 h-full min-h-[110px]"
                      title={`담아둔 사진 ${sessionPool.length}장에서 골라 이 리뷰에 넣기`}
                    >
                      <span className="text-2xl leading-none mb-0.5">📸</span>
                      <p className="text-[11px] font-semibold leading-tight">사진 고르기</p>
                      <p className="text-[9px] mt-0.5 opacity-90">담아둔 {sessionPool.length}장</p>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverKey(row.key); }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => { e.preventDefault(); setDragOverKey(null); if (e.dataTransfer.files.length > 0) addImagesToRow(row.key, e.dataTransfer.files); }}
                  className={`border-2 border-dashed rounded-lg p-2.5 h-full min-h-[240px] transition ${
                    dragOverKey === row.key ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {row.images.map((img, i) => (
                      <div key={i} className="relative aspect-square group">
                        <div className={`relative w-full h-full rounded overflow-hidden border-2 ${i === 0 ? "border-blue-500" : "border-gray-200"}`}>
                          <Image src={img.preview} alt={`img${i}`} fill unoptimized className="object-cover" />
                          <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/85 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">{i + 1}</div>
                        </div>
                        <button type="button" onClick={() => removeImage(row.key, i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">✕</button>
                      </div>
                    ))}
                    {row.images.length < MAX_IMAGES_PER_REVIEW && (
                      <label className="cursor-pointer aspect-square border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500">
                        <span className="text-lg leading-none">+</span>
                        <span className="text-[8px] mt-0.5">업로드</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)} />
                      </label>
                    )}
                    {sessionPool.length > 0 && row.images.length < MAX_IMAGES_PER_REVIEW && (
                      <button
                        type="button"
                        onClick={() => setPickerRowKey(row.key)}
                        className="aspect-square rounded flex flex-col items-center justify-center transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-emerald-500"
                        title={`담아둔 사진 ${sessionPool.length}장에서 골라 이 리뷰에 넣기`}
                      >
                        <span className="text-lg leading-none">📸</span>
                        <span className="text-[8px] mt-0.5 font-semibold">사진 고르기</span>
                        <span className="text-[8px] leading-none mt-0.5 opacity-80">({sessionPool.length}장)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 필드 */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">별점 *</label>
                  <div className="mt-1 flex items-center gap-1">
                    {[1,2,3,4,5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => updateRow(row.key, { rating: n })}
                        className={`text-2xl leading-none transition ${row.rating >= n ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}
                        title={`${n}점`}
                      >★</button>
                    ))}
                    <span className="ml-1 text-xs text-gray-500 font-mono">{row.rating}/5</span>
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-4">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">작성자명 *</label>
                  <input
                    type="text"
                    value={row.author_name}
                    onChange={(e) => updateRow(row.key, { author_name: e.target.value })}
                    placeholder="예) さくら"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-6">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">리뷰 내용 *</label>
                  <textarea
                    value={row.content}
                    onChange={(e) => updateRow(row.key, { content: e.target.value })}
                    placeholder="상품에 대한 리뷰를 입력하세요"
                    rows={3}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y"
                  />
                </div>
                <div className="col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">관련 상품 ({row.products.length}건)</label>
                    <button
                      type="button"
                      onClick={() => setProductPickerRowKey(row.key)}
                      className="text-[11px] px-3 py-1 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-medium"
                    >+ 상품 선택</button>
                  </div>
                  {row.products.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-1">관련 상품 없음 (선택 사항)</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {row.products.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-[11px]">
                          {p.image && <Image src={p.image} alt="" width={16} height={16} className="rounded object-cover" unoptimized />}
                          <span>{p.name}</span>
                          <button type="button" onClick={() => removeProduct(row.key, p.id)} className="text-red-500 hover:text-red-700">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {row.error && (
                  <div className="col-span-6 text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">⚠ {row.error}</div>
                )}
                {row.status === "ok" && (
                  <div className="col-span-6 text-[11px] text-green-600 bg-green-50 px-2 py-1 rounded">✓ 등록 완료</div>
                )}
              </div>

              {/* 우측 · #N + 행 삭제 */}
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

      <button
        onClick={addRow}
        disabled={uploading}
        className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition disabled:opacity-50"
      >
        + 리뷰 카드 추가
      </button>

      <FormActionBar
        cancelHref="/reviews"
        cancelLabel="취소"
        status={`${rows.length}건 중 등록 가능 ${rows.filter((r) => r.content.trim() && r.author_name.trim()).length}건 (내용 + 작성자명 필수 · 사진은 선택)`}
        primary={{
          label: uploading ? "저장 중..." : "⭐ 일괄 등록",
          onClick: handleSave,
          disabled: uploading,
        }}
      />

      {/* 관련 상품 선택 모달 */}
      <ProductPicker
        open={productPickerRowKey !== null}
        onClose={() => setProductPickerRowKey(null)}
        onConfirm={(products) => {
          if (productPickerRowKey === null) return;
          updateRow(productPickerRowKey, { products: products.map((p) => ({ id: p.id, name: p.name, image: p.image })) });
          setProductPickerRowKey(null);
        }}
        initialSelectedIds={productPickerRowKey !== null ? (rows.find((r) => r.key === productPickerRowKey)?.products.map((p) => p.id) || []) : []}
        maxSelect={5}
      />

      {/* 세션 사진 풀 · 이 리뷰에 담을 이미지 고르기 */}
      <ImageLibraryPicker
        open={pickerRowKey !== null}
        onClose={() => setPickerRowKey(null)}
        sessionUrls={sessionPool}
        titleOverride="📸 세션 이미지 풀에서 선택"
        descriptionOverride="이번 세션에 담아둔 사진 중 골라 이 리뷰에 넣기"
        onSelect={(urls) => {
          if (pickerRowKey === null) return;
          setRows((prev) => prev.map((r) => {
            if (r.key !== pickerRowKey) return r;
            const merged = [...r.images, ...urls.map((u) => ({ file: null, preview: u, url: u }))].slice(0, MAX_IMAGES_PER_REVIEW);
            return { ...r, images: merged };
          }));
          setPickerRowKey(null);
        }}
      />
    </div>
  );
}

export default function BulkNewReviewsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">로딩 중...</div>}>
      <BulkNewReviewsInner />
    </Suspense>
  );
}
