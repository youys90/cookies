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

interface ImageItem { file: File | null; preview: string; url?: string }

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
      // 기존 이미지 URL을 편집 가능한 배열로 초기화
      const initialized = ((prods || []) as Product[]).map((p) => {
        const arr = Array.isArray(p.images) ? (p.images.filter((u): u is string => typeof u === "string" && u.length > 0)) : [];
        const list: ImageItem[] = arr.length > 0
          ? arr.map((u) => ({ file: null, preview: u, url: u }))
          : (p.image ? [{ file: null, preview: p.image, url: p.image }] : []);
        return { ...p, editImages: list };
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
          image: urls[0] || p.image, // 없으면 기존 유지
          images: urls.length > 0 ? urls : null,
          is_active: !!p.is_active,
        })
        .eq("id", p.id);
      if (error) fail++;
      else ok++;
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
    <div className="pb-8 -mx-8 -mt-8 px-8 pt-4 min-h-screen bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30">
      {/* 상단 얇은 앰버 스트라이프 · 수정 모드 확실히 */}
      <div className="fixed top-0 left-64 right-0 h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 z-30"></div>

      {/* 큰 앰버 배너 · 수정 모드 · new/[id]와 동일한 시각 언어 */}
      <div className="mb-6 relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl"></div>
        </div>
        <div className="relative flex items-center justify-between p-5 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <span className="text-4xl leading-none animate-pulse-slow">✏️</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">상품 일괄 수정</h1>
                <span className="text-[11px] font-bold bg-white/20 backdrop-blur border border-white/30 px-2.5 py-0.5 rounded-full tracking-wider">EDIT</span>
              </div>
              <p className="text-xs text-amber-50/95 mt-1">기존 상품 여러 개를 · 한 화면에서 · 확인하고 수정</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-white/20 backdrop-blur border border-white/30 px-3 py-1 rounded-full font-medium">
              {products.length}개 선택
            </span>
          </div>
        </div>
      </div>


      {/* 상품 카드 목록 */}
      {/* 상단 툴바 · 세션 풀 + 일괄 자동번역 (bulk-new 스타일) */}
      <div className="mb-4 flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => sessionBulkInputRef.current?.click()}
          disabled={sessionUploading}
          className={`group relative flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-xl font-medium text-sm shadow-md transition-all disabled:opacity-60 ${
            sessionPool.length === 0
              ? "bg-gradient-to-br from-[var(--color-brand)] via-[#D6A490] to-[var(--color-brand-dk)] text-white hover:shadow-lg hover:-translate-y-0.5"
              : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg"
          }`}
        >
          <span className="text-xl">📸</span>
          <div className="flex flex-col items-start leading-tight">
            <span className="text-[13px] font-bold">{sessionPool.length === 0 ? "사진 미리 담기" : `담긴 사진 ${sessionPool.length}장`}</span>
            <span className="text-[10px] opacity-90">▼ 여러 장 한번에 담아두고 각 상품에 재사용</span>
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
        {translateMsg && <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 font-medium">{translateMsg}</span>}
      </div>

      <div className="space-y-3">
        {products.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_auto] gap-4 items-start">
              {/* 이미지 편집 · bulk-new와 동일 UX */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-gray-500 tracking-wider">#{idx + 1} · 사진</span>
                  <label className="text-[10px] text-[var(--color-brand-dk)] cursor-pointer hover:underline">
                    + 사진 추가
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) addImagesToProduct(p.id, e.target.files); e.target.value = ""; }}
                    />
                  </label>
                </div>
                {(p.editImages || []).length === 0 ? (
                  <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 min-h-[120px] hover:border-gray-500 hover:bg-gray-50 transition">
                    <span className="text-3xl mb-1">📷</span>
                    <p className="text-xs text-gray-500">클릭 or 위 「+ 사진 추가」</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) addImagesToProduct(p.id, e.target.files); e.target.value = ""; }}
                    />
                  </label>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5">
                    {(p.editImages || []).map((img, i) => (
                      <div key={i} className="relative aspect-square group">
                        <div className={`relative w-full h-full rounded overflow-hidden border-2 ${i === 0 ? "border-blue-500" : "border-gray-200"}`}>
                          <Image src={img.preview} alt="" fill unoptimized className="object-cover" />
                          <div className="absolute top-0 right-0 w-4 h-4 bg-gray-900/85 text-white text-[8px] font-bold rounded-bl flex items-center justify-center">{i + 1}</div>
                          {i === 0 && <span className="absolute top-0 left-0 bg-blue-500 text-white text-[8px] font-bold px-1 rounded-br">M</span>}
                        </div>
                        <div className="absolute -top-1 -right-1 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition">
                          <button type="button" onClick={() => removeImage(p.id, i)} className="w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center">✕</button>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 flex justify-between opacity-0 group-hover:opacity-100 transition">
                          <button type="button" onClick={() => i > 0 && moveImage(p.id, i, i - 1)} disabled={i === 0} className="text-[10px] bg-black/50 text-white px-1 rounded disabled:opacity-30">←</button>
                          <button type="button" onClick={() => i < (p.editImages?.length || 0) - 1 && moveImage(p.id, i, i + 1)} disabled={i === (p.editImages?.length || 0) - 1} className="text-[10px] bg-black/50 text-white px-1 rounded disabled:opacity-30">→</button>
                        </div>
                      </div>
                    ))}
                    {sessionPool.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPickerProductId(p.id)}
                        className="aspect-square bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded flex flex-col items-center justify-center border-2 border-emerald-500 shadow-sm hover:shadow-md"
                        title={`세션 풀에서 (${sessionPool.length}장)`}
                      >
                        <span className="text-base">📸</span>
                        <span className="text-[8px]">세션 풀</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* 필드 · 상품명 · 가격 · 카테고리 · 설명 */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <div className="col-span-2 md:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 (일본어)</label>
                  <input
                    type="text"
                    value={p.name_ja || ""}
                    onChange={(e) => updateField(p.id, "name_ja", e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 (한국어)</label>
                  <input
                    type="text"
                    value={p.name_ko || ""}
                    onChange={(e) => updateField(p.id, "name_ko", e.target.value)}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">가격</label>
                  <input
                    type="number"
                    value={p.price || ""}
                    onChange={(e) => updateField(p.id, "price", Number(e.target.value))}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">정가</label>
                  <input
                    type="number"
                    value={p.original_price || ""}
                    onChange={(e) => updateField(p.id, "original_price", e.target.value ? Number(e.target.value) : null)}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">카테고리 · 실시간</label>
                  <select
                    value={p.category}
                    onChange={(e) => { updateField(p.id, "category", e.target.value); updateField(p.id, "sub_category", ""); }}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] bg-white"
                  >
                    {categories.filter((c) => c.parent_id === null).map((c) => (
                      <option key={c.id} value={c.name_ja}>{c.name_ko} / {c.name_ja}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 md:col-span-1">
                  {(() => {
                    const parent = categories.find((c) => c.parent_id === null && c.name_ja === p.category);
                    const subs = parent ? categories.filter((c) => c.parent_id === parent.id) : [];
                    return (
                      <>
                        <label className="text-[10px] text-gray-500 uppercase tracking-wider">하위 ({subs.length})</label>
                        <select
                          value={p.sub_category || ""}
                          onChange={(e) => updateField(p.id, "sub_category", e.target.value)}
                          className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] bg-white disabled:bg-gray-100"
                          disabled={subs.length === 0}
                        >
                          <option value="">— 없음 —</option>
                          {subs.map((s) => (
                            <option key={s.id} value={s.name_ja}>{s.name_ko} / {s.name_ja}</option>
                          ))}
                        </select>
                      </>
                    );
                  })()}
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">판매 상태</label>
                  <select
                    value={p.is_active ? "on" : "off"}
                    onChange={(e) => updateField(p.id, "is_active", e.target.value === "on")}
                    className={`mt-1 w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] font-medium ${
                      p.is_active ? "bg-green-50 border-green-300 text-green-800" : "bg-gray-100 border-gray-300 text-gray-600"
                    }`}
                  >
                    <option value="on">✓ 판매중</option>
                    <option value="off">숨김</option>
                  </select>
                </div>

                {/* 상품 설명 · JP / KO */}
                <div className="col-span-2 md:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품 설명 (일본어)</label>
                  <textarea
                    value={p.description_ja || ""}
                    onChange={(e) => updateField(p.id, "description_ja", e.target.value)}
                    rows={2}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] resize-y"
                  />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품 설명 (한국어)</label>
                  <textarea
                    value={p.description_ko || ""}
                    onChange={(e) => updateField(p.id, "description_ko", e.target.value)}
                    rows={2}
                    className="mt-1 w-full px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] resize-y"
                  />
                </div>
              </div>

              {/* 개별 편집 링크 */}
              <Link
                href={`/products/${p.id}`}
                className="text-[11px] text-gray-400 hover:text-[var(--color-brand-dk)] whitespace-nowrap flex-shrink-0 self-start"
                title="이미지 등 상세 편집"
              >
                상세 편집 →
              </Link>
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
