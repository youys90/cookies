"use client";

// 리뷰 일괄 수정 · 여러 리뷰를 한 화면에서 동시에 편집
// - 상품 bulk-edit와 동일한 UX (드래그&드롭 · 세션 사진 풀 · 임시저장)
// - 각 카드: 사진 · 별점 · 내용 · 작성자명 · 관련 상품 · 노출 상태

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import FormActionBar from "@/components/FormActionBar";
import ProductPicker from "@/components/ProductPicker";
import DraftSaveButton from "@/components/DraftSaveButton";
import ImageLibraryPicker from "@/components/ImageLibraryPicker";
import { upsertDraft, listDrafts } from "@/lib/adminDrafts";
import { SESSION_KEYS, loadSession, saveSession } from "@/lib/sessionPersistence";

const PAGE_KEY = "review-bulk-edit";
const PAGE_LABEL = "리뷰 일괄 수정";
const MAX_IMAGES = 3;

interface ImageItem { file: File | null; preview: string; url?: string }
interface RelatedProduct { id: number; name: string; image?: string }

interface ReviewRow {
  id: string;
  images: ImageItem[];
  rating: number;
  content: string;
  author_name: string;
  is_active: boolean;
  products: RelatedProduct[];
  status?: "idle" | "saving" | "ok" | "error";
  error?: string;
}

function BulkEditReviewsInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const ids = (sp.get("ids") || "").split(",").filter(Boolean);

  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [pickerRowId, setPickerRowId] = useState<string | null>(null);
  const [productPickerRowId, setProductPickerRowId] = useState<string | null>(null);
  const [imgDrag, setImgDrag] = useState<{ rid: string | null; from: number | null; over: number | null }>({ rid: null, from: null, over: null });

  // 세션 사진 풀
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

  // 임시저장
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const requestedDraftId = sp.get("draft");

  // 초기 로드
  useEffect(() => {
    (async () => {
      if (ids.length === 0) { setLoading(false); return; }
      // draft 이어서 편집
      if (requestedDraftId) {
        const all = listDrafts(PAGE_KEY);
        const d = all.find((x) => x.id === requestedDraftId);
        if (d && d.data && typeof d.data === "object" && "rows" in (d.data as Record<string, unknown>)) {
          const dr = (d.data as { rows: ReviewRow[] }).rows;
          if (Array.isArray(dr) && dr.length > 0) {
            setRows(dr);
            setCurrentDraftId(d.id);
            setLoading(false);
            return;
          }
        }
      }
      // 신규 로드
      const { data } = await supabase
        .from("reviews")
        .select("id, image_url, images, rating, content, author_name, is_active, product_id, product_ids")
        .in("id", ids);
      const reviewsRaw = (data || []) as Array<{ id: string; image_url: string | null; images: string[] | null; rating: number; content: string; author_name: string; is_active: boolean; product_id: number | null; product_ids: number[] | null }>;
      const productIds = new Set<number>();
      reviewsRaw.forEach((r) => {
        if (r.product_id) productIds.add(r.product_id);
        if (Array.isArray(r.product_ids)) r.product_ids.forEach((id) => productIds.add(id));
      });
      const productMap = new Map<number, RelatedProduct>();
      if (productIds.size > 0) {
        const { data: prods } = await supabase.from("products").select("id, name, image").in("id", Array.from(productIds));
        (prods || []).forEach((p) => productMap.set(p.id as number, { id: p.id as number, name: p.name as string, image: p.image as string }));
      }
      const initialized: ReviewRow[] = reviewsRaw.map((r) => {
        const urls = Array.isArray(r.images) ? r.images.filter((u) => typeof u === "string" && u) : [];
        const list: ImageItem[] = urls.length > 0
          ? urls.map((u) => ({ file: null, preview: u, url: u }))
          : (r.image_url ? [{ file: null, preview: r.image_url, url: r.image_url }] : []);
        const pids = Array.isArray(r.product_ids) && r.product_ids.length > 0
          ? r.product_ids
          : r.product_id ? [r.product_id] : [];
        return {
          id: r.id,
          images: list,
          rating: r.rating || 5,
          content: r.content || "",
          author_name: r.author_name || "",
          is_active: !!r.is_active,
          products: pids.map((pid) => productMap.get(pid)).filter((p): p is RelatedProduct => !!p),
          status: "idle",
        };
      });
      setRows(initialized);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateRow = (id: string, patch: Partial<ReviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addImagesToRow = (id: string, files: FileList | File[]) => {
    const arr = Array.from(files);
    const readers = arr.map((file) =>
      new Promise<ImageItem>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve({ file, preview: reader.result as string });
        reader.readAsDataURL(file);
      })
    );
    Promise.all(readers).then((imgs) => {
      setRows((prev) => prev.map((r) => {
        if (r.id !== id) return r;
        const merged = [...r.images, ...imgs].slice(0, MAX_IMAGES);
        return { ...r, images: merged };
      }));
    });
  };

  const removeImage = (id: string, i: number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, images: r.images.filter((_, idx) => idx !== i) } : r)));
  };

  const moveImage = (id: string, from: number, to: number) => {
    setRows((prev) => prev.map((r) => {
      if (r.id !== id) return r;
      const list = [...r.images];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...r, images: list };
    }));
  };

  const removeProduct = (id: string, pid: number) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, products: r.products.filter((p) => p.id !== pid) } : r)));
  };

  const manualSave = () => {
    const d = upsertDraft({ id: currentDraftId || undefined, pageKey: PAGE_KEY, pageLabel: PAGE_LABEL, data: { ids, rows } });
    setCurrentDraftId(d.id);
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };

  const uploadImageFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `reviews/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return null;
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  const handleSave = async () => {
    if (!confirm(`선택한 ${rows.length}개 리뷰를 수정하시겠어요?`)) return;
    setSaving(true);
    let ok = 0, fail = 0;
    for (const row of rows) {
      updateRow(row.id, { status: "saving" });
      const urls: string[] = [];
      for (const img of row.images) {
        if (img.file) {
          const u = await uploadImageFile(img.file);
          if (u) urls.push(u);
        } else if (img.url) {
          urls.push(img.url);
        }
      }
      const { error } = await supabase
        .from("reviews")
        .update({
          image_url: urls[0] || null,
          images: urls.length > 0 ? urls : null,
          rating: row.rating,
          content: row.content.trim(),
          author_name: row.author_name.trim(),
          is_active: row.is_active,
          product_id: row.products[0]?.id || null,
          product_ids: row.products.length > 0 ? row.products.map((p) => p.id) : null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);
      if (error) {
        updateRow(row.id, { status: "error", error: error.message });
        fail++;
      } else {
        updateRow(row.id, { status: "ok" });
        ok++;
      }
    }
    setSaving(false);
    setMsg(`저장 완료 · 성공 ${ok}건${fail ? ` · 실패 ${fail}건` : ""}`);
    if (fail === 0) setTimeout(() => router.push("/reviews"), 1200);
  };

  if (loading) return <div className="p-10 text-center text-gray-500">로딩 중...</div>;
  if (ids.length === 0 || rows.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500 mb-4">선택된 리뷰가 없습니다.</p>
        <Link href="/reviews" className="text-blue-600 hover:underline">리뷰 관리로 이동</Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl md:text-2xl font-medium text-gray-900">리뷰 일괄 수정</h1>
            <span className="text-[11px] font-bold bg-amber-500 text-white px-2 py-0.5 rounded-full tracking-wider">EDIT</span>
            <span className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5 font-medium">{rows.length}개 선택</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">선택하신 리뷰들을 한 화면에서 확인하고 수정합니다.</p>
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
                : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:shadow-lg"
            }`}
          >
            <span className="text-xl">📸</span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold">{sessionPool.length === 0 ? "사진 미리 담기" : `담긴 사진 ${sessionPool.length}장`}</span>
              <span className="text-[10px] opacity-90">▼ 클릭해서 여러 장 한 번에 올리기</span>
            </div>
          </button>
          <input ref={sessionBulkInputRef} type="file" accept="image/*" multiple className="hidden"
            onChange={(e) => { if (e.target.files && e.target.files.length > 0) uploadToSessionPool(Array.from(e.target.files)); e.target.value = ""; }} />
        </div>
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div key={row.id} className={`bg-white rounded-xl shadow-sm p-4 border-2 transition ${
            row.status === "ok" ? "border-green-400" :
            row.status === "error" ? "border-red-400" :
            row.status === "saving" ? "border-blue-400 animate-pulse" :
            "border-transparent"
          }`}>
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-4 items-stretch">
              {/* 이미지 · 상품 bulk-edit 스타일 */}
              {row.images.length === 0 ? (
                <div className={`h-full min-h-[240px] ${sessionPool.length > 0 ? "grid grid-rows-2 gap-2" : ""}`}>
                  <label
                    onDragOver={(e) => { if (imgDrag.from !== null) return; if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverId(row.id); }}
                    onDragLeave={() => setDragOverId(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverId(null); if (imgDrag.from !== null) return; if (e.dataTransfer.files.length > 0) addImagesToRow(row.id, e.dataTransfer.files); }}
                    className={`cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg transition py-4 px-3 h-full ${sessionPool.length > 0 ? "min-h-[110px]" : "min-h-[240px]"} ${dragOverId === row.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white"}`}
                  >
                    <span className="text-3xl mb-1">📷</span>
                    <p className="text-xs text-gray-700 font-medium leading-tight">리뷰 사진 올리기</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">드래그 또는 클릭 · 최대 {MAX_IMAGES}장</p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImagesToRow(row.id, e.target.files)} />
                  </label>
                  {sessionPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerRowId(row.id)}
                      className="flex flex-col items-center justify-center text-center rounded-lg transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-emerald-500 py-4 px-3 h-full min-h-[110px]"
                    >
                      <span className="text-2xl leading-none mb-0.5">📸</span>
                      <p className="text-[11px] font-semibold leading-tight">사진 고르기</p>
                      <p className="text-[9px] mt-0.5 opacity-90">담아둔 {sessionPool.length}장</p>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { if (imgDrag.from !== null) return; if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverId(row.id); }}
                  onDragLeave={() => setDragOverId(null)}
                  onDrop={(e) => { e.preventDefault(); setDragOverId(null); if (imgDrag.from !== null) return; if (e.dataTransfer.files.length > 0) addImagesToRow(row.id, e.dataTransfer.files); }}
                  className={`border-2 border-dashed rounded-lg p-2.5 h-full min-h-[240px] transition ${dragOverId === row.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"}`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {row.images.map((img, i) => {
                      const isDragging = imgDrag.rid === row.id && imgDrag.from === i;
                      const isOver = imgDrag.rid === row.id && imgDrag.over === i && imgDrag.from !== i;
                      return (
                        <div
                          key={i}
                          className={`relative aspect-square group transition-transform ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                          draggable
                          onDragStart={() => setImgDrag({ rid: row.id, from: i, over: null })}
                          onDragOver={(e) => { e.preventDefault(); if (imgDrag.rid === row.id && imgDrag.from !== null && imgDrag.from !== i && imgDrag.over !== i) setImgDrag({ ...imgDrag, over: i }); }}
                          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (imgDrag.rid === row.id && imgDrag.from !== null && imgDrag.from !== i) moveImage(row.id, imgDrag.from, i); setImgDrag({ rid: null, from: null, over: null }); }}
                          onDragEnd={() => setImgDrag({ rid: null, from: null, over: null })}
                        >
                          <div className={`relative w-full h-full rounded overflow-hidden border-2 cursor-move ${i === 0 ? "border-blue-500" : "border-gray-200"}`}>
                            <Image src={img.preview} alt={`img${i}`} fill unoptimized className="object-cover" />
                            <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/85 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow">{i + 1}</div>
                            {i === 0 && <span className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] font-bold px-1 rounded shadow">M</span>}
                          </div>
                          <button type="button" onClick={() => removeImage(row.id, i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">✕</button>
                        </div>
                      );
                    })}
                    {row.images.length < MAX_IMAGES && (
                      <label className="cursor-pointer aspect-square border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500">
                        <span className="text-lg leading-none">+</span>
                        <span className="text-[8px] mt-0.5">업로드</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && addImagesToRow(row.id, e.target.files)} />
                      </label>
                    )}
                    {sessionPool.length > 0 && row.images.length < MAX_IMAGES && (
                      <button
                        type="button"
                        onClick={() => setPickerRowId(row.id)}
                        className="aspect-square rounded flex flex-col items-center justify-center transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-2 border-emerald-500"
                      >
                        <span className="text-lg leading-none">📸</span>
                        <span className="text-[8px] mt-0.5 font-semibold">사진 고르기</span>
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
                      <button key={n} type="button" onClick={() => updateRow(row.id, { rating: n })} className={`text-2xl leading-none transition ${row.rating >= n ? "text-amber-400" : "text-gray-300 hover:text-amber-300"}`}>★</button>
                    ))}
                    <span className="ml-1 text-xs text-gray-500 font-mono">{row.rating}/5</span>
                  </div>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">작성자명 *</label>
                  <input type="text" value={row.author_name} onChange={(e) => updateRow(row.id, { author_name: e.target.value })} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">노출 상태</label>
                  <select value={row.is_active ? "on" : "off"} onChange={(e) => updateRow(row.id, { is_active: e.target.value === "on" })} className={`mt-1 w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${row.is_active ? "bg-green-50 border-green-300 text-green-800" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
                    <option value="on">✓ 노출중 (승인됨)</option>
                    <option value="off">숨김</option>
                  </select>
                </div>
                <div className="col-span-6">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">리뷰 내용 *</label>
                  <textarea value={row.content} onChange={(e) => updateRow(row.id, { content: e.target.value })} rows={3} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y" />
                </div>
                <div className="col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-wider">관련 상품 ({row.products.length}건)</label>
                    <button type="button" onClick={() => setProductPickerRowId(row.id)} className="text-[11px] px-3 py-1 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-medium">+ 상품 선택</button>
                  </div>
                  {row.products.length === 0 ? (
                    <p className="text-[11px] text-gray-400 py-1">관련 상품 없음</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {row.products.map((p) => (
                        <span key={p.id} className="inline-flex items-center gap-1 pl-1 pr-1.5 py-0.5 bg-gray-100 border border-gray-200 rounded-full text-[11px]">
                          {p.image && <Image src={p.image} alt="" width={16} height={16} className="rounded object-cover" unoptimized />}
                          <span>{p.name}</span>
                          <button type="button" onClick={() => removeProduct(row.id, p.id)} className="text-red-500 hover:text-red-700">✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {row.error && <div className="col-span-6 text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">⚠ {row.error}</div>}
                {row.status === "ok" && <div className="col-span-6 text-[11px] text-green-600 bg-green-50 px-2 py-1 rounded">✓ 저장 완료</div>}
              </div>

              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FormActionBar
        cancelHref="/reviews"
        cancelLabel="취소"
        status={msg ? <span className="text-green-700 font-medium">{msg}</span> : `${rows.length}개 리뷰 편집 중`}
        primary={{
          label: saving ? "저장 중..." : "✏️ 일괄 저장",
          onClick: handleSave,
          disabled: saving,
        }}
      />

      {/* 관련 상품 선택 */}
      <ProductPicker
        open={productPickerRowId !== null}
        onClose={() => setProductPickerRowId(null)}
        onConfirm={(products) => {
          if (productPickerRowId === null) return;
          updateRow(productPickerRowId, { products: products.map((p) => ({ id: p.id, name: p.name, image: p.image })) });
          setProductPickerRowId(null);
        }}
        initialSelectedIds={productPickerRowId !== null ? (rows.find((r) => r.id === productPickerRowId)?.products.map((p) => p.id) || []) : []}
        maxSelect={5}
      />

      {/* 세션 사진 풀에서 고르기 */}
      <ImageLibraryPicker
        open={pickerRowId !== null}
        onClose={() => setPickerRowId(null)}
        sessionUrls={sessionPool}
        titleOverride="📸 세션 이미지 풀에서 선택"
        descriptionOverride="이번 세션에 담아둔 사진 중 골라 이 리뷰에 넣기"
        onSelect={(urls) => {
          if (pickerRowId === null) return;
          setRows((prev) => prev.map((r) => {
            if (r.id !== pickerRowId) return r;
            const merged = [...r.images, ...urls.map((u) => ({ file: null, preview: u, url: u }))].slice(0, MAX_IMAGES);
            return { ...r, images: merged };
          }));
          setPickerRowId(null);
        }}
      />
    </div>
  );
}

export default function BulkEditReviewsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">로딩 중...</div>}>
      <BulkEditReviewsInner />
    </Suspense>
  );
}
