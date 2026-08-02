"use client";
// 카테고리 관리 (하위 뎁스, 아이콘 업로드, 순서, 활성/비활성)

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";

type Category = {
  id: number;
  name_ko: string;
  name_ja: string;
  parent_id: number | null;
  sort_order: number;
  icon_url: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

const BUCKET = "product-images";
const ICON_MAX_SIZE = 5 * 1024 * 1024; // 5MB

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    name_ko: "",
    name_ja: "",
    parent_id: null as number | null,
    sort_order: 0,
    icon_url: "" as string,
    is_active: true,
  });
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [iconError, setIconError] = useState<string | null>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  // AI 번역
  const [translating, setTranslating] = useState<"ko-ja" | "ja-ko" | null>(null);

  const translate = async (direction: "ko-ja" | "ja-ko") => {
    const from = direction === "ko-ja" ? "ko" : "ja";
    const to = direction === "ko-ja" ? "ja" : "ko";
    const src = direction === "ko-ja" ? form.name_ko : form.name_ja;
    if (!src.trim()) {
      alert(direction === "ko-ja" ? "한국어 이름 먼저 입력해주세요." : "일본어 이름 먼저 입력해주세요.");
      return;
    }
    setTranslating(direction);
    try {
      // 무료 번역 (MyMemory → Google fallback). 상품 등록 페이지와 동일 방식.
      const translated = await translateKoJa(src, from, to);
      if (!translated || translated === src) {
        alert("번역 결과가 원문과 동일합니다. 수동 입력 부탁드립니다.");
        return;
      }
      setForm((p) => direction === "ko-ja" ? { ...p, name_ja: translated } : { ...p, name_ko: translated });
    } catch (e) {
      alert("번역 실패: 잠시 후 다시 시도해주세요.");
    } finally {
      setTranslating(null);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      alert("카테고리 조회 실패: " + error.message);
    } else {
      setRows((data as Category[]) || []);
    }
    setLoading(false);
  };

  // 트리 구조로 그룹핑
  const tree = useMemo(() => {
    const byParent = new Map<number | null, Category[]>();
    rows.forEach((r) => {
      const arr = byParent.get(r.parent_id) || [];
      arr.push(r);
      byParent.set(r.parent_id, arr);
    });
    return byParent;
  }, [rows]);

  const openCreate = (parent: Category | null = null) => {
    setEditing(null);
    setForm({
      name_ko: "",
      name_ja: "",
      parent_id: parent ? parent.id : null,
      sort_order: (rows.filter((r) => r.parent_id === (parent?.id ?? null)).at(-1)?.sort_order ?? 0) + 10,
      icon_url: "",
      is_active: true,
    });
    setShowForm(true);
  };

  const openEdit = (row: Category) => {
    setEditing(row);
    setForm({
      name_ko: row.name_ko,
      name_ja: row.name_ja,
      parent_id: row.parent_id,
      sort_order: row.sort_order,
      icon_url: row.icon_url || "",
      is_active: row.is_active,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setIconError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ko.trim() || !form.name_ja.trim()) {
      alert("한국어명 · 일본어명 모두 입력해주세요.");
      return;
    }

    if (editing) {
      const { error } = await supabase
        .from("categories")
        .update({
          name_ko: form.name_ko,
          name_ja: form.name_ja,
          parent_id: form.parent_id,
          sort_order: form.sort_order,
          icon_url: form.icon_url || null,
          is_active: form.is_active,
        })
        .eq("id", editing.id);
      if (error) return alert("수정 실패: " + error.message);
    } else {
      const { error } = await supabase.from("categories").insert({
        name_ko: form.name_ko,
        name_ja: form.name_ja,
        parent_id: form.parent_id,
        sort_order: form.sort_order,
        icon_url: form.icon_url || null,
        is_active: form.is_active,
      });
      if (error) return alert("등록 실패: " + error.message);
    }
    closeForm();
    fetchAll();
  };

  const handleDelete = async (row: Category) => {
    const childrenCount = rows.filter((r) => r.parent_id === row.id).length;
    const msg = childrenCount > 0
      ? `이 카테고리와 하위 ${childrenCount}개 카테고리를 모두 삭제합니다. 계속하시겠습니까?`
      : `"${row.name_ko}" 카테고리를 삭제하시겠습니까?`;
    if (!confirm(msg)) return;

    const { error } = await supabase.from("categories").delete().eq("id", row.id);
    if (error) return alert("삭제 실패: " + error.message);
    fetchAll();
  };

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIconError(null);

    if (file.size > ICON_MAX_SIZE) {
      setIconError("5MB 이하 이미지만 업로드 가능합니다.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setIconError("이미지 파일만 업로드 가능합니다.");
      return;
    }

    setUploadingIcon(true);
    const ext = file.name.split(".").pop() || "png";
    const key = `categories/icon_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, file, {
      upsert: true,
      contentType: file.type,
    });
    if (upErr) {
      setUploadingIcon(false);
      setIconError("업로드 실패: " + upErr.message);
      return;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(key);
    setForm((p) => ({ ...p, icon_url: urlData.publicUrl }));
    setUploadingIcon(false);
    if (iconInputRef.current) iconInputRef.current.value = "";
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 재귀 렌더
  const renderRow = (row: Category, depth: number): React.ReactElement => {
    const children = tree.get(row.id) || [];
    const isExpanded = expanded.has(row.id);
    const hasChildren = children.length > 0;
    return (
      <div key={row.id}>
        <div
          className={`flex items-center gap-3 py-2.5 px-3 border-b border-gray-100 hover:bg-gray-50 ${!row.is_active ? "opacity-50" : ""}`}
          style={{ paddingLeft: `${12 + depth * 24}px` }}
        >
          <button
            type="button"
            onClick={() => hasChildren && toggleExpand(row.id)}
            className={`w-5 text-xs ${hasChildren ? "text-gray-500" : "text-transparent"}`}
          >
            {hasChildren ? (isExpanded ? "▾" : "▸") : "·"}
          </button>

          {/* 아이콘 */}
          <div className="w-10 h-10 flex-shrink-0 bg-gray-100 rounded-full overflow-hidden flex items-center justify-center border border-gray-200">
            {row.icon_url ? (
              <Image src={row.icon_url} alt={row.name_ko} width={40} height={40} className="object-cover w-full h-full" unoptimized />
            ) : (
              <span className="text-[10px] text-gray-400">no icon</span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{row.name_ko} <span className="text-xs text-gray-400">/ {row.name_ja}</span></p>
            <p className="text-[11px] text-gray-400">
              #{row.id} · 순서 {row.sort_order} {row.is_active ? "" : "· 비활성"}
            </p>
          </div>

          <div className="flex items-center gap-1">
            <button onClick={() => openCreate(row)} className="text-[11px] text-blue-600 hover:text-blue-800 px-2">+ 하위</button>
            <button onClick={() => openEdit(row)} className="text-[11px] text-gray-600 hover:text-gray-900 px-2">수정</button>
            <button onClick={() => handleDelete(row)} className="text-[11px] text-red-500 hover:text-red-700 px-2">삭제</button>
          </div>
        </div>

        {isExpanded && children.map((c) => renderRow(c, depth + 1))}
      </div>
    );
  };

  const roots = tree.get(null) || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">카테고리 관리</h1>
          <p className="text-sm text-gray-500 mt-1">하위 뎁스 · 아이콘 · 순서 · 활성 상태 관리</p>
        </div>
        <button
          onClick={() => openCreate(null)}
          className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
          title="트리 최상단에 새 카테고리를 등록합니다"
        >
          + 최상위 카테고리 등록
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 text-[11px] text-gray-500 tracking-wide border-b border-gray-200">
          최상위 {roots.length}개 · 전체 {rows.length}개
        </div>
        {loading ? (
          <div className="p-10 text-center text-sm text-gray-400">불러오는 중…</div>
        ) : roots.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">등록된 카테고리가 없습니다.</div>
        ) : (
          <div>{roots.map((r) => renderRow(r, 0))}</div>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-medium">{editing ? "카테고리 수정" : "카테고리 등록"}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 상위 카테고리 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">상위 카테고리</label>
                <select
                  value={form.parent_id ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">(최상위)</option>
                  {rows
                    .filter((r) => !editing || r.id !== editing.id) // 자기 자신 제외
                    .map((r) => (
                      <option key={r.id} value={r.id}>{r.name_ko} / {r.name_ja}</option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-600">한국어 이름 *</label>
                    <button
                      type="button"
                      onClick={() => translate("ko-ja")}
                      disabled={!!translating}
                      className="text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-40"
                      title="한국어 → 일본어 자동 번역 (AI)"
                    >
                      🌐 → 일본어 {translating === "ko-ja" ? "번역 중..." : ""}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={form.name_ko}
                    onChange={(e) => setForm((p) => ({ ...p, name_ko: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-600">일본어 이름 *</label>
                    <button
                      type="button"
                      onClick={() => translate("ja-ko")}
                      disabled={!!translating}
                      className="text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-40"
                      title="일본어 → 한국어 자동 번역 (AI)"
                    >
                      🌐 → 한국어 {translating === "ja-ko" ? "번역 중..." : ""}
                    </button>
                  </div>
                  <input
                    type="text"
                    value={form.name_ja}
                    onChange={(e) => setForm((p) => ({ ...p, name_ja: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    required
                  />
                </div>
              </div>

              {/* 아이콘 업로드 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">아이콘 (원본 크기 무관 · 노출 크기 64×64 고정)</label>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.icon_url ? (
                      <Image src={form.icon_url} alt="icon" width={64} height={64} className="object-cover w-full h-full" unoptimized />
                    ) : (
                      <span className="text-[10px] text-gray-400">preview</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={iconInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleIconUpload}
                      className="text-xs"
                    />
                    {uploadingIcon && <p className="text-xs text-blue-500 mt-1">업로드 중…</p>}
                    {iconError && <p className="text-xs text-red-500 mt-1">{iconError}</p>}
                    {form.icon_url && (
                      <button
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, icon_url: "" }))}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        아이콘 제거
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">노출 순서 (작을수록 앞)</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                    />
                    <span>활성 (shop에 노출)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button type="button" onClick={closeForm} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  취소
                </button>
                <button
                  type="submit"
                  disabled={uploadingIcon}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
                >
                  {editing ? "수정 저장" : "등록"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
