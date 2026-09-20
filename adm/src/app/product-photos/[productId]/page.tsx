"use client";

// 상품 실사진 게시판 · 상세 (P-02 · 2026-09-21)
// - 특정 상품의 실사진 자료실 (관리자용)
// - 업로드 · 드래그 정렬 · caption · 삭제 · 라이트박스
// - 판매용 이미지(products.image / products.images)와 완전 분리

import { useState, useEffect, useRef, useMemo, use } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAdmLanguage } from "@/contexts/LanguageContext";

interface ProductInfo {
  id: number;
  name: string;
  name_ko?: string | null;
  name_ja?: string | null;
  image: string;
  category?: string | null;
  category_ko?: string | null;
  category_ja?: string | null;
  sub_category?: string | null;
}

interface PhotoRow {
  id: number;
  product_id: number | null;  // P-03: FK SET NULL 후 삭제된 상품 사진은 null
  image_url: string;
  storage_path: string;
  caption: string | null;
  sort_order: number;
  product_name_ko_snapshot?: string | null;  // P-03: 상품 삭제 후에도 남는 상품명 스냅샷
  product_name_ja_snapshot?: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  params: Promise<{ productId: string }>;
}

export default function ProductPhotosDetailPage({ params }: Props) {
  const { productId: productIdStr } = use(params);
  const productId = Number(productIdStr);

  const { language, pickName, pickCategory } = useAdmLanguage();

  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [captionDrafts, setCaptionDrafts] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Lightbox state
  const [lightbox, setLightbox] = useState<{ urls: string[]; captions: (string | null)[]; alt: string; index: number } | null>(null);

  useEffect(() => {
    if (Number.isNaN(productId)) {
      setFetchError("잘못된 상품 ID입니다.");
      setLoading(false);
      return;
    }
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  const fetchAll = async () => {
    setLoading(true);
    setFetchError(null);
    const [prodRes, photoRes] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, name_ko, name_ja, image, category, category_ko, category_ja, sub_category")
        .eq("id", productId)
        .single(),
      supabase
        .from("product_photos")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order", { ascending: true }),
    ]);
    if (prodRes.error || !prodRes.data) {
      setFetchError(prodRes.error?.message || "상품을 찾을 수 없습니다.");
      setLoading(false);
      return;
    }
    setProduct(prodRes.data as ProductInfo);
    if (photoRes.error) {
      setFetchError(photoRes.error.message || "실사진 목록을 불러오지 못했습니다.");
    } else {
      const rows = (photoRes.data || []) as PhotoRow[];
      setPhotos(rows);
      setCaptionDrafts(Object.fromEntries(rows.map((r) => [r.id, r.caption || ""])));
    }
    setLoading(false);
  };

  // ── 업로드 ─────────────────────────────────────────
  // Storage · products-images/real-photos/{productId}/{timestamp}_{random}.{ext}
  // DB · product_photos 신규 row (sort_order는 현재 최대값 + 1부터)
  const uploadFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);

    let nextOrder = photos.length > 0 ? Math.max(...photos.map((p) => p.sort_order)) + 1 : 0;
    const newRows: PhotoRow[] = [];
    const failed: string[] = [];

    for (const file of arr) {
      // 이미지 파일만 허용
      if (!file.type.startsWith("image/")) {
        failed.push(`${file.name} (이미지 아님)`);
        continue;
      }
      try {
        const ext = (file.name.split(".").pop() || "bin").toLowerCase();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 11)}.${ext}`;
        const storagePath = `real-photos/${productId}/${fileName}`;

        const { error: upErr } = await supabase.storage
          .from("product-images")
          .upload(storagePath, file, { contentType: file.type || undefined });
        if (upErr) {
          failed.push(`${file.name}: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from("product-images").getPublicUrl(storagePath);
        const publicUrl = pub.publicUrl;

        const { data: inserted, error: dbErr } = await supabase
          .from("product_photos")
          .insert({
            product_id: productId,
            image_url: publicUrl,
            storage_path: storagePath,
            caption: null,
            sort_order: nextOrder,
          })
          .select("*")
          .single();

        if (dbErr || !inserted) {
          // 롤백 · Storage 파일 제거 시도
          await supabase.storage.from("product-images").remove([storagePath]);
          failed.push(`${file.name}: DB 저장 실패 (${dbErr?.message || "unknown"})`);
          continue;
        }
        newRows.push(inserted as PhotoRow);
        nextOrder++;
      } catch (e) {
        failed.push(`${file.name}: ${(e as Error).message}`);
      }
    }

    if (newRows.length > 0) {
      setPhotos((prev) => [...prev, ...newRows]);
      setCaptionDrafts((prev) => {
        const next = { ...prev };
        newRows.forEach((r) => { next[r.id] = r.caption || ""; });
        return next;
      });
    }
    setUploading(false);
    if (failed.length > 0) {
      alert(`업로드 실패 (${failed.length}건):\n\n` + failed.join("\n"));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    void uploadFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDropZoneDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadFiles(e.dataTransfer.files);
    }
  };
  const handleDropZoneOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };
  const handleDropZoneLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  // ── 삭제 ────────────────────────────────────────────
  // Storage → DB 순서 · 사장님 지시 (고아 파일 최소화)
  const deletePhoto = async (photo: PhotoRow) => {
    if (!confirm("이 실사진을 삭제하시겠습니까?")) return;
    // 1. Storage.remove 먼저
    const { error: rmErr } = await supabase.storage.from("product-images").remove([photo.storage_path]);
    if (rmErr) {
      alert(`Storage 삭제 실패:\n${rmErr.message}\n\nDB 데이터는 그대로 유지됩니다.`);
      return;
    }
    // 2. Storage 성공 시 · DB delete
    const { error: dbErr } = await supabase.from("product_photos").delete().eq("id", photo.id);
    if (dbErr) {
      alert(`DB 삭제 실패:\n${dbErr.message}\n\nStorage 파일은 이미 삭제되어 목록의 이미지가 깨질 수 있습니다. 관리자에게 알리세요.\n(고아 파일 방지를 위한 정책)`);
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    setCaptionDrafts((prev) => {
      const next = { ...prev };
      delete next[photo.id];
      return next;
    });
  };

  // ── 순서 변경 ─────────────────────────────────────
  // 로컬 상태 우선 반영 → 병렬 DB 업데이트 · 실패 시 콘솔 로그 (products/[id] 옵션 재정렬 패턴 준용)
  const persistSortOrder = async (arr: PhotoRow[]) => {
    const updates = arr.map((p, idx) => ({ id: p.id, sort_order: idx }));
    for (const u of updates) {
      const { error } = await supabase
        .from("product_photos")
        .update({ sort_order: u.sort_order })
        .eq("id", u.id);
      if (error) console.error("sort_order 저장 실패", u.id, error);
    }
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setPhotos(next);
    void persistSortOrder(next);
  };
  const moveDown = (index: number) => {
    if (index === photos.length - 1) return;
    const next = [...photos];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setPhotos(next);
    void persistSortOrder(next);
  };

  // Drag reorder handlers (products/new/page.tsx L131-155 패턴 준용)
  const onDragStart = (i: number) => setDragIndex(i);
  const onDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== i && dragOverIndex !== i) setDragOverIndex(i);
  };
  const onDragLeave = () => setDragOverIndex(null);
  const onDrop = (targetIndex: number) => {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null); setDragOverIndex(null); return;
    }
    const next = [...photos];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(targetIndex, 0, moved);
    setPhotos(next);
    void persistSortOrder(next);
    setDragIndex(null); setDragOverIndex(null);
  };
  const onDragEnd = () => { setDragIndex(null); setDragOverIndex(null); };

  // ── caption 저장 (onBlur) ──────────────────────────
  const saveCaption = async (photo: PhotoRow) => {
    const draft = (captionDrafts[photo.id] || "").trim();
    const current = (photo.caption || "").trim();
    if (draft === current) return;
    setSavingId(photo.id);
    const { error } = await supabase
      .from("product_photos")
      .update({ caption: draft || null })
      .eq("id", photo.id);
    setSavingId(null);
    if (error) {
      alert("메모 저장 실패: " + error.message);
      // 롤백
      setCaptionDrafts((prev) => ({ ...prev, [photo.id]: current }));
      return;
    }
    setPhotos((prev) => prev.map((p) => (p.id === photo.id ? { ...p, caption: draft || null } : p)));
  };

  // ── 라이트박스 ────────────────────────────────────
  const openLightbox = (index: number) => {
    if (photos.length === 0) return;
    setLightbox({
      urls: photos.map((p) => p.image_url),
      captions: photos.map((p) => p.caption),
      alt: product ? pickName(product) : "",
      index,
    });
  };
  const lightboxPrev = () =>
    setLightbox((c) => (c ? { ...c, index: (c.index - 1 + c.urls.length) % c.urls.length } : c));
  const lightboxNext = () =>
    setLightbox((c) => (c ? { ...c, index: (c.index + 1) % c.urls.length } : c));

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      else if (e.key === "ArrowLeft") lightboxPrev();
      else if (e.key === "ArrowRight" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        lightboxNext();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightbox]);

  const productName = useMemo(() => (product ? pickName(product) : ""), [product, pickName]);
  const productCategory = useMemo(() => (product ? pickCategory(product) : ""), [product, pickCategory]);

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">로딩 중...</div>;
  }

  if (fetchError || !product) {
    return (
      <div>
        <div className="mb-4">
          <Link href="/product-photos" className="text-sm text-gray-600 hover:text-gray-900">← 목록으로</Link>
        </div>
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-6">
          <p className="font-medium">상품 정보를 불러오지 못했습니다.</p>
          {fetchError && <p className="text-sm mt-1">{fetchError}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* 상단 · 이전으로 */}
      <div className="mb-4">
        <Link href="/product-photos" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          목록으로
        </Link>
      </div>

      {/* 상품 정보 헤더 */}
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-5 mb-6 flex items-start gap-4">
        <div className="relative w-20 h-20 md:w-24 md:h-24 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
          {product.image && (
            <Image
              src={product.image}
              alt={productName}
              fill
              unoptimized
              sizes="96px"
              className="object-cover"
            />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg md:text-xl font-medium text-gray-900 truncate" title={language === "ko" ? (product.name_ja || product.name || "") : (product.name_ko || "")}>
            {productName}
          </h1>
          <p className="text-xs md:text-sm text-gray-500 mt-1">
            {productCategory}
            {product.sub_category && <span className="ml-1 text-gray-400">/ {product.sub_category}</span>}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            실사진 {photos.length}장 · 판매용 이미지와는 별도 관리됩니다.
          </p>
        </div>
        <div className="flex-shrink-0">
          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs md:text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
            title="상품 정보 편집 (판매용 이미지 · 가격 · 옵션 등)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            상품 편집으로
          </Link>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div
        onDragOver={handleDropZoneOver}
        onDragEnter={handleDropZoneOver}
        onDragLeave={handleDropZoneLeave}
        onDrop={handleDropZoneDrop}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-8 md:p-10 text-center cursor-pointer transition-all mb-6 ${
          dragActive
            ? "border-[var(--color-brand)] bg-[var(--color-brand)]/5"
            : uploading
              ? "border-gray-200 bg-gray-50 cursor-wait"
              : "border-gray-300 bg-white hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5"
        }`}
        role="button"
        tabIndex={0}
        aria-label="실사진 파일을 업로드하려면 클릭하거나 드래그하세요"
      >
        <div className="flex flex-col items-center justify-center gap-2">
          {uploading ? (
            <>
              <svg className="w-10 h-10 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              <p className="text-sm text-gray-500">업로드 중...</p>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-gray-700">
                {dragActive ? "여기에 놓으세요" : "클릭 또는 드래그하여 실사진 업로드"}
              </p>
              <p className="text-xs text-gray-400">JPG · PNG · 여러 장 동시 가능</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* 실사진 그리드 */}
      {photos.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm p-12 text-center text-gray-500">
          아직 등록된 실사진이 없습니다.
          <p className="text-xs text-gray-400 mt-2">위 영역에 사진을 드래그하거나 클릭해서 업로드하세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {photos.map((photo, index) => {
            const isDragging = dragIndex === index;
            const isOver = dragOverIndex === index && dragIndex !== null && dragIndex !== index;
            const draft = captionDrafts[photo.id] ?? photo.caption ?? "";
            return (
              <div
                key={photo.id}
                data-testid={`photo-card-${photo.id}`}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-all ${
                  isDragging ? "opacity-40 scale-95" : ""
                } ${isOver ? "ring-2 ring-[var(--color-brand)] shadow-md" : ""}`}
                draggable
                onDragStart={() => onDragStart(index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDragLeave={onDragLeave}
                onDrop={() => onDrop(index)}
                onDragEnd={onDragEnd}
              >
                <div className="relative aspect-square bg-gray-100">
                  <button
                    type="button"
                    onClick={() => openLightbox(index)}
                    className="absolute inset-0 group cursor-zoom-in"
                    aria-label={`실사진 ${index + 1}번 크게 보기`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.image_url}
                      alt={`실사진 ${index + 1}`}
                      className="w-full h-full object-cover pointer-events-none"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition text-white text-xl">🔍</span>
                  </button>
                  {/* 순번 배지 */}
                  <div className="absolute top-1.5 left-1.5 w-7 h-7 bg-gray-900/85 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm">
                    {index + 1}
                  </div>
                  {/* 삭제 · 상단 우측 */}
                  <button
                    type="button"
                    onClick={() => deletePhoto(photo)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 bg-red-500/95 hover:bg-red-600 text-white text-xs rounded-full flex items-center justify-center shadow-lg backdrop-blur-sm"
                    title="삭제"
                    aria-label={`실사진 ${index + 1}번 삭제`}
                  >
                    ✕
                  </button>
                  {/* 순서 이동 화살표 · 하단 */}
                  <div className="absolute bottom-1.5 right-1.5 flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="w-7 h-7 bg-gray-900/70 hover:bg-gray-900 text-white text-xs rounded-full flex items-center justify-center backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="앞으로"
                      aria-label="앞으로 이동"
                    >
                      ‹
                    </button>
                    <button
                      type="button"
                      onClick={() => moveDown(index)}
                      disabled={index === photos.length - 1}
                      className="w-7 h-7 bg-gray-900/70 hover:bg-gray-900 text-white text-xs rounded-full flex items-center justify-center backdrop-blur-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      title="뒤로"
                      aria-label="뒤로 이동"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="p-2.5">
                  <input
                    type="text"
                    placeholder="메모 (예: 165cm 착용)"
                    value={draft}
                    onChange={(e) => setCaptionDrafts((prev) => ({ ...prev, [photo.id]: e.target.value }))}
                    onBlur={() => saveCaption(photo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    maxLength={200}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40 focus:border-[var(--color-brand)] transition"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    {savingId === photo.id ? "저장 중..." : `#${index + 1}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 라이트박스 ─────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/85 flex flex-col items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.alt}
        >
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/70 to-transparent z-[101]" onClick={(e) => e.stopPropagation()}>
            <div className="text-white">
              <p className="text-sm font-medium truncate max-w-[60vw]">{lightbox.alt}</p>
              <p className="text-[11px] text-white/60 mt-0.5">
                {lightbox.index + 1} / {lightbox.urls.length} · ESC · ← → · Space
                {lightbox.captions[lightbox.index] && (
                  <span className="ml-2 text-white/80">· {lightbox.captions[lightbox.index]}</span>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(null); }}
              className="w-10 h-10 bg-white/10 hover:bg-white/25 text-white rounded-full flex items-center justify-center text-xl backdrop-blur transition"
              aria-label="닫기"
            >
              ✕
            </button>
          </div>

          {lightbox.urls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); lightboxPrev(); }}
                className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-2xl backdrop-blur transition z-[101]"
                aria-label="이전 이미지"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); lightboxNext(); }}
                className="absolute right-2 md:right-6 top-1/2 -translate-y-1/2 w-12 h-12 md:w-14 md:h-14 bg-white/10 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-2xl backdrop-blur transition z-[101]"
                aria-label="다음 이미지"
              >
                ›
              </button>
            </>
          )}

          <div className="flex items-center justify-center cursor-default" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={lightbox.urls[lightbox.index]}
              src={lightbox.urls[lightbox.index]}
              alt={`${lightbox.alt} ${lightbox.index + 1}`}
              className="max-w-[85vw] max-h-[75vh] object-contain rounded shadow-2xl"
            />
          </div>

          {lightbox.urls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto py-2 px-4 bg-black/40 rounded-lg backdrop-blur" onClick={(e) => e.stopPropagation()}>
              {lightbox.urls.map((u, i) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setLightbox((cur) => (cur ? { ...cur, index: i } : cur))}
                  className={`relative w-14 h-14 flex-shrink-0 rounded overflow-hidden transition ${i === lightbox.index ? "ring-2 ring-white" : "opacity-60 hover:opacity-100"}`}
                  aria-label={`${i + 1}번째 이미지로 이동`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={u} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
