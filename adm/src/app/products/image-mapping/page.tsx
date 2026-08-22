"use client";

// CSV/일괄 등록 후 이미지 매핑 전용 페이지
// - 이미지 없는 상품 = 우선 노출
// - 좌: 이미지 풀 (업로드 · 라이브러리)
// - 우: 상품 카드 (필터 · 검색 · 등록방식)
// - 진입: 상품 관리 「이미지 매핑」 버튼 or ?ids=1,2,3 파라미터

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ImageBatchMapper, { type MapperTarget } from "@/components/ImageBatchMapper";

interface ProductRow {
  id: number;
  name: string;
  name_ko: string | null;
  name_ja: string | null;
  category: string | null;
  category_ko: string | null;
  image: string | null;
  images: string[] | null;
  source: string | null;
  updated_at: string | null;
}

export default function ImageMappingPage() {
  const searchParams = useSearchParams();
  const idsParam = searchParams.get("ids");
  const scope = searchParams.get("scope") || (idsParam ? "ids" : "no-image"); // ids | no-image | all

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    let q = supabase.from("products").select("id, name, name_ko, name_ja, category, category_ko, image, images, source, updated_at").eq("is_active", true).order("updated_at", { ascending: false }).limit(500);
    if (scope === "ids" && idsParam) {
      const ids = idsParam.split(",").map((s) => Number(s.trim())).filter((n) => n > 0);
      if (ids.length > 0) q = supabase.from("products").select("id, name, name_ko, name_ja, category, category_ko, image, images, source, updated_at").in("id", ids);
    } else if (scope === "no-image") {
      q = q.or("images.is.null,image.is.null");
    }
    const { data, error } = await q;
    if (error) {
      setError(error.message);
    } else {
      setRows((data as ProductRow[]) ?? []);
    }
    setLoading(false);
  }, [idsParam, scope]);

  useEffect(() => { load(); }, [load]);

  const targets: MapperTarget[] = useMemo(() => {
    return rows.map((p) => {
      const list = Array.isArray(p.images) ? p.images.filter((u): u is string => typeof u === "string" && u.length > 0) : [];
      const thumbnails = list.length > 0 ? list : (p.image ? [p.image] : []);
      return {
        id: p.id,
        label: p.name_ko || p.name_ja || p.name || `상품 #${p.id}`,
        subLabel: [p.category_ko || p.category, `#${p.id}`].filter(Boolean).join(" · "),
        thumbnails,
        filterBadge: p.source || undefined,
        meta: {},
      };
    });
  }, [rows]);

  const uploadFiles = async (files: File[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) {
        console.error("upload fail:", error);
        continue;
      }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      urls.push(pub.publicUrl);
    }
    return urls;
  };

  const handleSave = async (mappings: { targetId: number | string; imageUrls: string[] }[]) => {
    let ok = 0, failed = 0;
    for (const m of mappings) {
      const id = Number(m.targetId);
      const first = m.imageUrls[0] || null;
      const { error } = await supabase
        .from("products")
        .update({ image: first, images: m.imageUrls })
        .eq("id", id);
      if (error) failed++;
      else ok++;
    }
    // 저장 후 로컬 rows 반영
    setRows((prev) => prev.map((r) => {
      const m = mappings.find((x) => Number(x.targetId) === r.id);
      if (!m) return r;
      return { ...r, image: m.imageUrls[0] || null, images: m.imageUrls };
    }));
    return { ok, failed };
  };

  const missingCount = rows.filter((r) => (!Array.isArray(r.images) || r.images.length === 0) && !r.image).length;

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/products" className="hover:text-gray-700">← 상품 관리</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">📸 이미지 일괄 매핑</h1>
          <p className="text-sm text-gray-500 mt-1">
            {scope === "ids" && idsParam ? `선택된 ${idsParam.split(",").length}건` : scope === "no-image" ? "이미지 미첨부 상품 우선" : "전체 상품"}
            {loading ? " · 로드 중..." : ` · ${rows.length}건 로드 · 미첨부 ${missingCount}건`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/products/image-mapping?scope=no-image"
            className={`px-3 py-1.5 text-xs rounded-md border ${scope === "no-image" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            이미지 미첨부만
          </Link>
          <Link
            href="/products/image-mapping?scope=all"
            className={`px-3 py-1.5 text-xs rounded-md border ${scope === "all" ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            전체
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 안내 */}
      <div className="mb-4 rounded-xl border border-[var(--color-brand)]/25 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-[13px] text-gray-700 leading-relaxed">
            <p className="font-semibold text-gray-900 mb-1">사용법 · 삼성 갤러리 스타일</p>
            <p>1️⃣ 좌측에 이미지를 담습니다 (업로드 · 라이브러리에서 가져오기)</p>
            <p>2️⃣ 좌측에서 이미지 여러 장을 <b>체크</b>합니다</p>
            <p>3️⃣ 우측에서 상품 카드를 <b>클릭</b>하면 그 상품에 매핑 (한 상품에 여러 장 OK)</p>
            <p>4️⃣ 여러 상품을 매핑한 뒤 상단 <b>「일괄 저장」</b> 클릭</p>
          </div>
        </div>
      </div>

      <ImageBatchMapper
        targets={targets}
        uploadFiles={uploadFiles}
        onSave={handleSave}
        title="상품 이미지 매핑"
        emptyMessage={loading ? "로드 중..." : "매핑할 상품이 없습니다"}
      />
    </div>
  );
}
