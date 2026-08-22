"use client";

// 상품 일괄 수정 (bulk-edit)
// - bulk-new와 동일한 사진 편집 UX (드래그 재정렬 · 개별 업로드 · 세션 풀)
// - 설명 · 자동번역까지 포함
// - 사장님: "일괄등록 잘 만들어져 있으니 그거 따라가자"

import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAdmLanguage } from "@/contexts/LanguageContext";
import { translateKoJa } from "@/lib/translate";
import FormActionBar from "@/components/FormActionBar";
import ImageLibraryPicker from "@/components/ImageLibraryPicker";
import { SESSION_KEYS, loadSession, saveSession } from "@/lib/sessionPersistence";
import DraftSaveButton from "@/components/DraftSaveButton";
import DraftListButton from "@/components/DraftListButton";
import { upsertDraft, listDrafts } from "@/lib/adminDrafts";

const PAGE_KEY = "bulk-edit";
const PAGE_LABEL = "상품 일괄 수정";

interface ImageItem { file: File | null; preview: string; url?: string }

interface ProductOption {
  id?: number;
  option_name: string;
  additional_price: number;
  stock: number;
  is_active?: boolean;
}

interface Product {
  id: number;
  name: string;
  name_ja?: string | null;
  name_ko?: string | null;
  price: number;
  original_price?: number | null;
  category: string;
  category_ja?: string | null;
  category_ko?: string | null;
  sub_category?: string | null;
  description_ja?: string | null;
  description_ko?: string | null;
  stock?: number | null;
  is_active?: boolean | null;
  image: string;
  images?: string[] | null;
  // 편집 상태 · UI 내부에서만
  editImages?: ImageItem[];
  options?: ProductOption[]; // 개별 편집과 동일 · product_options 테이블에서 로드
}

function BulkEditInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { pickName, pickCategory, language } = useAdmLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Array<{ id: number; name_ja: string; name_ko: string; parent_id: number | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const ids = (sp.get("ids") || "")
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);

  useEffect(() => {
    (async () => {
      if (ids.length === 0) { setLoading(false); return; }
      const { data: prods } = await supabase
        .from("products")
        .select("id, name, name_ja, name_ko, price, original_price, category, category_ja, category_ko, sub_category, description_ja, description_ko, is_active, image, images")
        .in("id", ids);
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name_ja, name_ko, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      // 옵션 로드 · 개별 편집과 동일
      const { data: opts } = await supabase
        .from("product_options")
        .select("id, product_id, option_name, additional_price, stock, is_active")
        .in("product_id", ids);
      const optionsByPid = new Map<number, ProductOption[]>();
      ((opts || []) as Array<{ id: number; product_id: number; option_name: string; additional_price: number; stock: number; is_active: boolean }>).forEach((o) => {
        const arr = optionsByPid.get(o.product_id) || [];
        arr.push({ id: o.id, option_name: o.option_name, additional_price: o.additional_price, stock: o.stock, is_active: o.is_active });
        optionsByPid.set(o.product_id, arr);
      });
      // 기존 이미지 URL을 편집 가능한 배열로 초기화
      const initialized = ((prods || []) as Product[]).map((p) => {
        const arr = Array.isArray(p.images) ? (p.images.filter((u): u is string => typeof u === "string" && u.length > 0)) : [];
        const list: ImageItem[] = arr.length > 0
          ? arr.map((u) => ({ file: null, preview: u, url: u }))
          : (p.image ? [{ file: null, preview: p.image, url: p.image }] : []);
        return { ...p, editImages: list, options: optionsByPid.get(p.id) || [] };
      });
      setProducts(initialized);
      setCategories(((cats as Array<{ id: number; name_ja: string; name_ko: string | null; parent_id: number | null }>) || []).map((c) => ({
        id: c.id,
        name_ja: c.name_ja || "",
        name_ko: c.name_ko || c.name_ja || "",
        parent_id: c.parent_id,
      })));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = <K extends keyof Product>(id: number, field: K, value: Product[K]) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };

  // ── 이미지 편집 (bulk-new와 동일 UX) ──────────────
  const setEditImages = (id: number, imgs: ImageItem[]) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, editImages: imgs } : p)));
  };
  const addImagesToProduct = async (id: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    const readers = arr.map(
      (file) => new Promise<ImageItem>((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve({ file, preview: r.result as string });
        r.readAsDataURL(file);
      })
    );
    const imgs = await Promise.all(readers);
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, editImages: [...(p.editImages || []), ...imgs] } : p));
  };
  const removeImage = (id: number, index: number) => {
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, editImages: (p.editImages || []).filter((_, i) => i !== index) } : p));
  };
  const moveImage = (id: number, from: number, to: number) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const list = [...(p.editImages || [])];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...p, editImages: list };
    }));
  };

  // ── 옵션 편집 (개별 편집과 동일) ─────────────────────
  const addOption = (id: number) => {
    setProducts((prev) => prev.map((p) => p.id === id
      ? { ...p, options: [...(p.options || []), { option_name: "", additional_price: 0, stock: 99, is_active: true }] }
      : p));
  };
  const updateOption = (id: number, idx: number, patch: Partial<ProductOption>) => {
    setProducts((prev) => prev.map((p) => {
      if (p.id !== id) return p;
      const list = [...(p.options || [])];
      list[idx] = { ...list[idx], ...patch };
      return { ...p, options: list };
    }));
  };
  const removeOption = (id: number, idx: number) => {
    setProducts((prev) => prev.map((p) => p.id === id
      ? { ...p, options: (p.options || []).filter((_, i) => i !== idx) }
      : p));
  };

  // 세션 풀 (bulk-new와 동일 · 여러 상품에서 재사용)
  const [sessionPool, setSessionPool] = useState<string[]>(() => loadSession<string[]>(SESSION_KEYS.IMAGE_POOL, []));
  const [sessionUploading, setSessionUploading] = useState(false);
  const sessionBulkInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { saveSession(SESSION_KEYS.IMAGE_POOL, sessionPool); }, [sessionPool]);
  const uploadToSessionPool = async (files: File[]) => {
    setSessionUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) { console.error(error); continue; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      newUrls.push(pub.publicUrl);
    }
    if (newUrls.length > 0) setSessionPool((prev) => [...newUrls, ...prev]);
    setSessionUploading(false);
  };
  const [pickerProductId, setPickerProductId] = useState<number | null>(null);
  const [dragOverPid, setDragOverPid] = useState<number | null>(null);
  // 이미지 드래그 재정렬 (bulk-new와 동일)
  const [imgDrag, setImgDrag] = useState<{ pid: number | null; from: number | null; over: number | null }>({ pid: null, from: null, over: null });

  // 임시저장 · bulk-new와 동일 방식 · 수동 저장만 (자동 감지 없음)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const requestedDraftId = sp.get("draft");

  // URL에 ?draft={id} 있을 때만 명시적으로 이어서 편집 (자동 감지 · 팝업 없음)
  useEffect(() => {
    if (loading || products.length === 0 || !requestedDraftId) return;
    const all = listDrafts(PAGE_KEY);
    const d = all.find((x) => x.id === requestedDraftId);
    if (d && d.data && typeof d.data === "object" && "products" in (d.data as Record<string, unknown>)) {
      const dp = (d.data as { products: Product[] }).products;
      if (Array.isArray(dp) && dp.length > 0) {
        setProducts(dp);
        setCurrentDraftId(d.id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, requestedDraftId]);

  const manualSave = () => {
    const d = upsertDraft({
      id: currentDraftId || undefined,
      pageKey: PAGE_KEY,
      pageLabel: PAGE_LABEL,
      data: { ids, products },
    });
    if (!d) { alert("임시 저장 실패 · 브라우저 저장 공간 부족 또는 프라이빗 모드"); return; }
    setCurrentDraftId(d.id);
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };
  const loadDraftData = (data: unknown, draftId: string) => {
    const obj = data as { ids?: unknown; products?: unknown } | undefined;
    if (obj?.products && Array.isArray(obj.products)) {
      setProducts(obj.products as never);
      setCurrentDraftId(draftId);
    }
  };

  // 이미지 파일 업로드 헬퍼 (저장 시)
  const uploadImageFile = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) { console.error("upload fail:", error); return null; }
    const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
    return pub.publicUrl;
  };

  // 일괄 자동번역
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string>("");
  const bulkTranslate = async () => {
    setTranslating(true);
    setTranslateMsg("");
    let done = 0;
    for (const p of products) {
      const targets: Array<{ field: "name_ja" | "name_ko" | "description_ja" | "description_ko"; source: string; from: "ko" | "ja" }> = [];
      if (!p.name_ja && p.name_ko) targets.push({ field: "name_ja", source: p.name_ko, from: "ko" });
      if (!p.name_ko && p.name_ja) targets.push({ field: "name_ko", source: p.name_ja, from: "ja" });
      if (!p.description_ja && p.description_ko) targets.push({ field: "description_ja", source: p.description_ko, from: "ko" });
      if (!p.description_ko && p.description_ja) targets.push({ field: "description_ko", source: p.description_ja, from: "ja" });
      for (const t of targets) {
        try {
          const to: "ko" | "ja" = t.from === "ko" ? "ja" : "ko";
          const translated = await translateKoJa(t.source, t.from, to);
          updateField(p.id, t.field, translated);
          done++;
        } catch (e) { console.error(e); }
      }
    }
    setTranslating(false);
    setTranslateMsg(`번역 완료 · ${done}건 채움`);
  };

  const handleSave = async () => {
    if (products.length === 0) return;
    if (!confirm(`선택한 ${products.length}개 상품을 수정하시겠습니까?\n\n· 각 카드의 값이 그대로 저장됩니다.\n· 변경 안 한 상품도 재저장됩니다.`)) return;
    setSaving(true);
    setMsg(null);
    let ok = 0;
    let fail = 0;
    for (const p of products) {
      // 이미지 · 파일 신규 업로드 → URL 배열 확정
      const urls: string[] = [];
      for (const img of (p.editImages || [])) {
        if (img.file) {
          const u = await uploadImageFile(img.file);
          if (u) urls.push(u);
        } else if (img.url) {
          urls.push(img.url);
        }
      }
      const { error } = await supabase
        .from("products")
        .update({
          name_ja: p.name_ja || p.name,
          name_ko: p.name_ko || null,
          price: Number(p.price) || 0,
          original_price: p.original_price ? Number(p.original_price) : null,
          category: p.category,
          sub_category: p.sub_category || null,
          description_ja: p.description_ja || null,
          description_ko: p.description_ko || null,
          image: urls[0] || p.image,
          images: urls.length > 0 ? urls : null,
          is_active: !!p.is_active,
        })
        .eq("id", p.id);
      if (error) { fail++; continue; }

      // 옵션 반영 · 기존 삭제 → 신규 insert (편집 상태 그대로 덮어쓰기)
      await supabase.from("product_options").delete().eq("product_id", p.id);
      const validOptions = (p.options || []).filter((o) => o.option_name.trim());
      if (validOptions.length > 0) {
        const optPayload = validOptions.map((o) => ({
          product_id: p.id,
          option_name: o.option_name.trim(),
          additional_price: Number(o.additional_price) || 0,
          stock: Number(o.stock) || 99,
          is_active: o.is_active !== false,
        }));
        const { error: optErr } = await supabase.from("product_options").insert(optPayload);
        if (optErr) { fail++; continue; }
      }
      ok++;
    }
    setSaving(false);
    setMsg(`저장 완료 · 성공 ${ok}건${fail ? ` · 실패 ${fail}건` : ""}`);
    if (fail === 0) setTimeout(() => router.push("/products"), 1200);
  };

  if (loading) return <div className="p-10 text-center text-gray-500">로딩 중...</div>;
  if (ids.length === 0 || products.length === 0) {
    return (
      <div className="p-10 text-center">
        <p className="text-gray-500 mb-4">선택된 상품이 없습니다.</p>
        <Link href="/products" className="text-blue-600 hover:underline">상품 관리로 이동</Link>
      </div>
    );
  }

  return (
    <div className="pb-8 -mx-8 -mt-8 px-8 pt-4 min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-amber-50/40">
      {/* 수정 모드 · 상단 굵은 앰버 스트라이프 · 개별 편집과 동일 · 실수 방지 */}
      <div className="-mx-8 -mt-4 mb-0 h-2 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 shadow-md"></div>

      {/* 헤더 배너 · 진한 앰버 · 흰 텍스트 · 일괄 수정 임팩트 */}
      <div className="mt-6 mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 shadow-xl">
        <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full bg-white/10"></div>
        <div className="absolute -right-4 -bottom-10 w-32 h-32 rounded-full bg-white/5"></div>
        <div className="absolute left-0 top-4 bottom-4 w-1 bg-white/60 rounded-r-full"></div>
        <div className="relative px-6 py-5 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner">
            ✏️
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-none">상품 일괄 수정 중</h1>
              <span className="inline-flex items-center bg-white text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase shadow animate-pulse">BULK EDIT</span>
              <span className="inline-flex items-center bg-white/20 backdrop-blur border border-white/40 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">{products.length}개 선택</span>
            </div>
            <p className="text-amber-50 text-sm mt-1.5">⚠ 선택하신 상품들을 한 화면에서 수정합니다 · 저장 시 즉시 반영됩니다 · 각 행 이미지 드래그&드롭 가능</p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <DraftSaveButton onSave={manualSave} lastSavedAt={lastSavedAt} savedTick={savedTick} />
          <DraftListButton pageKey={PAGE_KEY} onLoad={loadDraftData} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {translateMsg && (
            <span className="text-xs bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-3 py-1 font-medium">{translateMsg}</span>
          )}
          <button
            type="button"
            onClick={() => sessionBulkInputRef.current?.click()}
            disabled={sessionUploading}
            className={`group relative flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-xl font-medium text-sm shadow-md transition-all disabled:opacity-60 ${
              sessionPool.length === 0
                ? "bg-gradient-to-br from-[var(--color-brand)] via-[#D6A490] to-[var(--color-brand-dk)] text-white hover:shadow-lg hover:-translate-y-0.5"
                : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg"
            }`}
            title="여러 장 사진 담아두고 각 상품에 재사용"
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
          <button
            onClick={bulkTranslate}
            disabled={translating || saving}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 shadow-sm transition"
            title="비어있는 반대 언어 필드 자동 채움"
          >
            {translating ? "🌐 번역 중..." : "🌐 일괄 자동번역"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {products.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-xl shadow-sm p-4 border-2 border-transparent">
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-4 items-stretch">
              {/* 이미지 영역 · bulk-new와 완전 동일 UX (큰 드롭존 · 드래그&드롭 · 세션 풀) */}
              {(p.editImages || []).length === 0 ? (
                <div className={`h-full min-h-[240px] ${sessionPool.length > 0 ? "grid grid-rows-2 gap-2" : ""}`}>
                  <label
                    onDragOver={(e) => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverPid(p.id); }}
                    onDragLeave={() => setDragOverPid(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverPid(null); if (e.dataTransfer.files.length > 0) addImagesToProduct(p.id, e.dataTransfer.files); }}
                    className={`cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg transition py-4 px-3 h-full ${sessionPool.length > 0 ? "min-h-[110px]" : "min-h-[240px]"} ${
                      dragOverPid === p.id ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white"
                    }`}
                  >
                    <svg className="w-7 h-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    <p className="text-xs text-gray-700 font-medium leading-tight">사진 올리기</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">드래그 또는 클릭</p>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addImagesToProduct(p.id, e.target.files); e.target.value = ""; }} />
                  </label>
                  {sessionPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerProductId(p.id)}
                      className="flex flex-col items-center justify-center text-center rounded-lg transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-emerald-500 py-4 px-3 h-full min-h-[110px]"
                      title={`담아둔 사진 ${sessionPool.length}장에서 골라 이 상품에 넣기`}
                    >
                      <span className="text-2xl leading-none mb-0.5">📸</span>
                      <p className="text-[11px] font-semibold leading-tight">사진 고르기</p>
                      <p className="text-[9px] mt-0.5 opacity-90">담아둔 {sessionPool.length}장</p>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  onDragOver={(e) => { if (imgDrag.from !== null) return; if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); setDragOverPid(p.id); }}
                  onDragLeave={() => setDragOverPid(null)}
                  onDrop={(e) => { e.preventDefault(); setDragOverPid(null); if (imgDrag.from !== null) return; if (e.dataTransfer.files.length > 0) addImagesToProduct(p.id, e.dataTransfer.files); }}
                  className={`border-2 border-dashed rounded-lg p-2.5 h-full min-h-[240px] transition ${
                    dragOverPid === p.id ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {(p.editImages || []).map((img, i) => {
                      const isDragging = imgDrag.pid === p.id && imgDrag.from === i;
                      const isOver = imgDrag.pid === p.id && imgDrag.over === i && imgDrag.from !== i;
                      return (
                      <div
                        key={i}
                        className={`relative aspect-square group transition-transform ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                        draggable
                        onDragStart={() => setImgDrag({ pid: p.id, from: i, over: null })}
                        onDragOver={(e) => { e.preventDefault(); if (imgDrag.pid === p.id && imgDrag.from !== null && imgDrag.from !== i && imgDrag.over !== i) setImgDrag({ ...imgDrag, over: i }); }}
                        onDragLeave={() => imgDrag.over === i && setImgDrag({ ...imgDrag, over: null })}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (imgDrag.pid === p.id && imgDrag.from !== null && imgDrag.from !== i) moveImage(p.id, imgDrag.from, i); setImgDrag({ pid: null, from: null, over: null }); }}
                        onDragEnd={() => setImgDrag({ pid: null, from: null, over: null })}
                      >
                        {isOver && <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-blue-500 rounded z-20"></div>}
                        <div className={`relative w-full h-full rounded overflow-hidden border-2 cursor-move transition-all ${
                          isOver ? "border-blue-500 ring-2 ring-blue-200 shadow" :
                          i === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                        }`}>
                          <Image src={img.preview} alt={`img${i}`} fill unoptimized className="object-cover" />
                          <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/85 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow ring-1 ring-white/20">{i + 1}</div>
                          {i === 0 && <span className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] font-bold px-1 rounded shadow">M</span>}
                        </div>
                        <button type="button" onClick={() => removeImage(p.id, i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">✕</button>
                        <div className="absolute bottom-0.5 inset-x-0.5 flex justify-between opacity-0 group-hover:opacity-100 transition">
                          <button type="button" onClick={() => i > 0 && moveImage(p.id, i, i - 1)} disabled={i === 0} className="text-[10px] bg-black/60 text-white px-1 rounded disabled:opacity-30">←</button>
                          <button type="button" onClick={() => i < (p.editImages?.length || 0) - 1 && moveImage(p.id, i, i + 1)} disabled={i === (p.editImages?.length || 0) - 1} className="text-[10px] bg-black/60 text-white px-1 rounded disabled:opacity-30">→</button>
                        </div>
                      </div>
                      );
                    })}
                    <label className="cursor-pointer aspect-square border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500">
                      <span className="text-lg leading-none">+</span>
                      <span className="text-[8px] mt-0.5">업로드</span>
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) addImagesToProduct(p.id, e.target.files); e.target.value = ""; }} />
                    </label>
                    {sessionPool.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPickerProductId(p.id)}
                        className="aspect-square rounded flex flex-col items-center justify-center transition bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 border-2 border-emerald-500"
                        title={`담아둔 사진 ${sessionPool.length}장에서 골라 이 상품에 넣기`}
                      >
                        <span className="text-lg leading-none">📸</span>
                        <span className="text-[8px] mt-0.5 font-semibold">사진 고르기</span>
                        <span className="text-[8px] leading-none mt-0.5 opacity-80">({sessionPool.length}장)</span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 필드 · bulk-new와 완전 동일 6열 그리드 */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 JP *</label>
                  <input type="text" value={p.name_ja || ""} onChange={(e) => updateField(p.id, "name_ja", e.target.value)} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 KR</label>
                  <input type="text" value={p.name_ko || ""} onChange={(e) => updateField(p.id, "name_ko", e.target.value)} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">카테고리</label>
                  <select value={p.category} onChange={(e) => { updateField(p.id, "category", e.target.value); updateField(p.id, "sub_category", ""); }} className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white">
                    {categories.filter((c) => c.parent_id === null).map((c) => (
                      <option key={c.id} value={c.name_ja}>{c.name_ko} / {c.name_ja}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">가격 *</label>
                  <input type="number" value={p.price || ""} onChange={(e) => updateField(p.id, "price", Number(e.target.value))} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                </div>
                <div className="col-span-3 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">정가</label>
                  <input type="number" value={p.original_price || ""} onChange={(e) => updateField(p.id, "original_price", e.target.value ? Number(e.target.value) : null)} className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  {(() => {
                    const parent = categories.find((c) => c.parent_id === null && c.name_ja === p.category);
                    const subs = parent ? categories.filter((c) => c.parent_id === parent.id) : [];
                    return (
                      <>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">하위 카테고리 ({subs.length}건)</label>
                        <select value={p.sub_category || ""} onChange={(e) => updateField(p.id, "sub_category", e.target.value)} className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100" disabled={subs.length === 0}>
                          <option value="">— 선택 안 함 —</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.name_ja}>{s.name_ko} / {s.name_ja}</option>
                          ))}
                        </select>
                      </>
                    );
                  })()}
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">판매 상태</label>
                  <select value={p.is_active ? "on" : "off"} onChange={(e) => updateField(p.id, "is_active", e.target.value === "on")} className={`mt-1 w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${p.is_active ? "bg-green-50 border-green-300 text-green-800" : "bg-gray-100 border-gray-300 text-gray-600"}`}>
                    <option value="on">✓ 판매중 (shop 노출)</option>
                    <option value="off">숨김 (shop 미노출)</option>
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (일본어)</label>
                  <textarea value={p.description_ja || ""} onChange={(e) => updateField(p.id, "description_ja", e.target.value)} rows={2} placeholder="商品説明 (일본어)" className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y" />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (한국어)</label>
                  <textarea value={p.description_ko || ""} onChange={(e) => updateField(p.id, "description_ko", e.target.value)} rows={2} placeholder="상품 설명 (한국어)" className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y" />
                </div>

                {/* COLOR 옵션 · 개별 편집과 동일 · 여러 옵션 편집 · 저장 시 반영 */}
                <div className="col-span-6 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">🎨 COLOR 옵션</span>
                      <span className="text-[11px] text-gray-500">{(p.options || []).length}건</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addOption(p.id)}
                      className="text-[11px] px-3 py-1 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-medium"
                    >
                      + 옵션 추가
                    </button>
                  </div>
                  {(p.options || []).length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-2">등록된 옵션이 없습니다. 필요시 「+ 옵션 추가」</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(p.options || []).map((opt, oi) => (
                        <div key={oi} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-gray-200 rounded p-1.5">
                          <input
                            type="text"
                            placeholder="옵션명 (예: ゴールド)"
                            value={opt.option_name}
                            onChange={(e) => updateOption(p.id, oi, { option_name: e.target.value })}
                            className="col-span-7 text-[12px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            type="number"
                            placeholder="추가금액"
                            value={opt.additional_price || ""}
                            onChange={(e) => updateOption(p.id, oi, { additional_price: Number(e.target.value) })}
                            className="col-span-4 text-[12px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          {/* 재고 필드 · 사장님 요청으로 UI 숨김 · 기존 stock 값 그대로 유지 */}
                          <button
                            type="button"
                            onClick={() => removeOption(p.id, oi)}
                            className="col-span-1 text-red-500 hover:bg-red-50 rounded p-1 flex items-center justify-center"
                            title="옵션 삭제"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 우측 · #N (bulk-new와 완전 동일) */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <FormActionBar
        cancelHref="/products"
        cancelLabel="취소"
        status={msg ? <span className="text-green-700 font-medium">{msg}</span> : `${products.length}개 상품 편집 중`}
        primary={{
          label: saving ? "저장 중..." : "✏️ 일괄 저장",
          onClick: handleSave,
          disabled: saving,
        }}
      />

      <ImageLibraryPicker
        open={pickerProductId !== null}
        onClose={() => setPickerProductId(null)}
        sessionUrls={sessionPool}
        titleOverride="📸 세션 이미지 풀에서 선택"
        descriptionOverride="이번 세션에 담아둔 사진 중 골라 이 상품에 넣기"
        onSelect={(urls) => {
          if (pickerProductId === null) return;
          setProducts((prev) => prev.map((p) => p.id === pickerProductId
            ? { ...p, editImages: [...(p.editImages || []), ...urls.map((u) => ({ file: null, preview: u, url: u }))] }
            : p
          ));
        }}
      />
    </div>
  );
}

export default function BulkEditPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-gray-500">로딩 중...</div>}>
      <BulkEditInner />
    </Suspense>
  );
}
