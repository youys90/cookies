"use client";

// 상품 일괄 수정 (bulk-edit)
// - 상품 관리 목록에서 여러 상품 체크 → "일괄수정" 버튼으로 진입
// - 각 상품 · 편집 가능 필드 (이름/가격/정가/재고/카테고리/판매상태) 카드 UI
// - 이미지는 개별 편집 페이지에서 (여기서는 텍스트 필드만 · 심플)
// - 저장 시 · 여러 상품 동시 update

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useAdmLanguage } from "@/contexts/LanguageContext";
import FormActionBar from "@/components/FormActionBar";

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
  stock?: number | null;
  is_active?: boolean | null;
  image: string;
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
        .select("id, name, name_ja, name_ko, price, original_price, category, category_ja, category_ko, sub_category, stock, is_active, image")
        .in("id", ids);
      const { data: cats } = await supabase
        .from("categories")
        .select("id, name_ja, name_ko, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setProducts((prods || []) as Product[]);
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

  const handleSave = async () => {
    if (products.length === 0) return;
    if (!confirm(`선택한 ${products.length}개 상품을 수정하시겠습니까?\n\n· 각 카드의 값이 그대로 저장됩니다.\n· 변경 안 한 상품도 재저장됩니다.`)) return;
    setSaving(true);
    setMsg(null);
    let ok = 0;
    let fail = 0;
    for (const p of products) {
      const { error } = await supabase
        .from("products")
        .update({
          name_ja: p.name_ja || p.name,
          name_ko: p.name_ko || null,
          price: Number(p.price) || 0,
          original_price: p.original_price ? Number(p.original_price) : null,
          category: p.category,
          sub_category: p.sub_category || null,
          stock: p.stock !== null && p.stock !== undefined ? Number(p.stock) : null,
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
    <div className="pb-8">
      {/* 수정 모드 시각 구분 · 앰버 · 일괄 표기 */}
      <div className="mb-6 relative pl-4 py-1 border-l-4 border-amber-500 bg-amber-50/40 rounded-r-lg">
        <div className="absolute -left-1 top-0 bottom-0 w-1 bg-amber-500 rounded-full"></div>
        <div className="flex items-center gap-2 flex-wrap py-1">
          <h1 className="text-xl md:text-2xl font-medium text-gray-900">상품 일괄 수정</h1>
          <span className="inline-flex items-center gap-1 bg-amber-500 text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm tracking-wide">
            ✏️ 일괄 수정
          </span>
          <span className="text-xs text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
            {products.length}개 선택
          </span>
        </div>
        <p className="text-sm text-amber-800/70 mt-1">각 상품의 값을 확인·변경한 뒤 상단 저장 버튼을 누르세요</p>
      </div>


      {/* 상품 카드 목록 */}
      <div className="space-y-3">
        {products.map((p, idx) => (
          <div key={p.id} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
            <div className="flex items-start gap-4">
              {/* 썸네일 */}
              <div className="relative w-20 h-20 flex-shrink-0 rounded overflow-hidden bg-gray-100 border border-gray-200">
                {p.image && <Image src={p.image} alt="" fill unoptimized className="object-cover" />}
                <span className="absolute top-0.5 left-0.5 bg-gray-900/85 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">#{idx + 1}</span>
              </div>

              {/* 필드 */}
              <div className="flex-1 grid grid-cols-2 md:grid-cols-6 gap-2">
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
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">재고</label>
                  <input
                    type="number"
                    value={p.stock ?? ""}
                    onChange={(e) => updateField(p.id, "stock", e.target.value ? Number(e.target.value) : null)}
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
