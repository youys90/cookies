"use client";
// 카테고리 관리 (하위 뎁스, 아이콘 선택, 순서, 활성/비활성)

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import { BuiltinCategoryIcon, BUILTIN_ICON_PREFIX, guessIconKey } from "@/lib/category-icons";
import IconPicker from "@/components/IconPicker";

type Category = {
  id: number;
  name_ko: string;
  name_ja: string;
  name_en?: string | null;
  parent_id: number | null;
  sort_order: number;
  icon_url: string | null;
  is_active: boolean;
  is_special?: boolean;
  access_password_hash?: string | null;
  created_at?: string;
  updated_at?: string;
};

export default function CategoriesPage() {
  const [rows, setRows] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    name_ko: "",
    name_ja: "",
    name_en: "",
    parent_id: null as number | null,
    sort_order: 0,
    icon_url: "" as string,
    is_active: true,
    is_special: false,
    new_password: "", // 등록 시 필수 / 수정 시 비워두면 기존 유지
  });
  // 무료 번역 (MyMemory/Google)
  const [translating, setTranslating] = useState<"ko-ja" | "ja-ko" | null>(null);

  // 아이콘 선택 모달
  const [showIconPicker, setShowIconPicker] = useState(false);

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

  // 자기 자신의 모든 자손 id 계산 (순환 참조 방지용)
  const getDescendantIds = (id: number): Set<number> => {
    const descendants = new Set<number>();
    const stack = [id];
    while (stack.length > 0) {
      const current = stack.pop()!;
      rows.forEach((r) => {
        if (r.parent_id === current && !descendants.has(r.id)) {
          descendants.add(r.id);
          stack.push(r.id);
        }
      });
    }
    return descendants;
  };

  const openCreate = (parent: Category | null = null, special = false) => {
    setEditing(null);
    const siblings = rows.filter((r) => r.parent_id === (parent?.id ?? null));
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((r) => r.sort_order), 0) : 0;
    setForm({
      name_ko: "",
      name_ja: "",
      name_en: "",
      parent_id: parent ? parent.id : null,
      sort_order: maxOrder + 10,
      icon_url: "",
      is_active: true,
      is_special: special,
      new_password: "",
    });
    setShowForm(true);
  };

  const openEdit = (row: Category) => {
    setEditing(row);
    setForm({
      name_ko: row.name_ko,
      name_ja: row.name_ja,
      name_en: row.name_en || "",
      parent_id: row.parent_id,
      sort_order: row.sort_order,
      icon_url: row.icon_url || "",
      is_active: row.is_active,
      is_special: !!row.is_special,
      new_password: "", // 비워두면 기존 hash 유지
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name_ko.trim() || !form.name_ja.trim()) {
      alert("한국어명 · 일본어명 모두 입력해주세요.");
      return;
    }

    // 하위 카테고리는 아이콘/영문라벨/특수 사용 안 함 → 저장 시 강제로 null/false
    const isSub = form.parent_id !== null;
    const isSpecial = !isSub && form.is_special;

    // 특수 카테고리 등록/수정 시 비밀번호 유효성
    let passwordHash: string | null | undefined = undefined; // undefined = 유지, null = 지움, string = 새 값
    if (isSpecial) {
      if (!editing && !form.new_password.trim()) {
        return alert("특수 카테고리 등록 시 비밀번호는 필수입니다.");
      }
      if (form.new_password.trim()) {
        // 서버 API로 해싱 요청 (평문이 DB로 안 감)
        const hashRes = await fetch("/api/category-password/hash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: form.new_password }),
        });
        if (!hashRes.ok) return alert("비밀번호 해싱 실패");
        const j = await hashRes.json();
        passwordHash = j.hash;
      }
    } else if (editing?.is_special && !form.is_special) {
      // 특수 → 일반 전환: 해시 지움
      passwordHash = null;
    }

    const payload = {
      name_ko: form.name_ko,
      name_ja: form.name_ja,
      name_en: isSub ? null : (form.name_en || null),
      parent_id: form.parent_id,
      sort_order: form.sort_order,
      icon_url: isSub ? null : (form.icon_url || null),
      is_active: form.is_active,
      is_special: isSpecial,
      ...(passwordHash !== undefined ? { access_password_hash: passwordHash } : {}),
    };

    if (editing) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
      if (error) return alert("수정 실패: " + error.message);
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) return alert("등록 실패: " + error.message);
    }
    // 저장 후 부모 노드 자동 확장 - 방금 등록된 하위가 즉시 눈에 보이게
    const parentId = form.parent_id;
    closeForm();
    await fetchAll();
    if (parentId != null) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
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

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 재귀 렌더 - 최상위/하위 시각 구분 강화 (2026-08-03 크림디자인팀 개선)
  const renderRow = (row: Category, depth: number): React.ReactElement => {
    const children = tree.get(row.id) || [];
    const isExpanded = expanded.has(row.id);
    const hasChildren = children.length > 0;
    const isSub = !!row.parent_id;

    // 최상위 일반: 흰 배경 + 좌측 앰버 막대
    // 최상위 특수: 자주색 그라디언트 배경 + 좌측 자주 막대 + 자물쇠 배지
    // 하위: 연회색 배경 + 인덴트 + 트리 마커(└) + dim 태그
    const rowBg = isSub
      ? "bg-gray-50/70 hover:bg-gray-100/70 border-b border-gray-100"
      : row.is_special
        ? "bg-gradient-to-r from-purple-50 to-white hover:from-purple-100/60 border-b border-purple-200 border-l-[4px] border-l-purple-600"
        : "bg-white hover:bg-amber-50/30 border-b border-gray-200 border-l-[3px] border-l-amber-400";
    const iconWrap = isSub
      ? "w-7 h-7 bg-gray-100 border border-gray-200 border-dashed"
      : row.is_special
        ? "w-11 h-11 bg-purple-100 border border-purple-300 shadow-sm"
        : "w-11 h-11 bg-amber-50 border border-amber-200 shadow-sm";
    const nameCls = isSub
      ? "text-[13px] text-gray-600 font-normal"
      : "text-[15px] text-gray-900 font-semibold tracking-tight";
    const subNameCls = isSub ? "text-[11px] text-gray-400" : "text-xs text-gray-500";

    return (
      <div key={row.id}>
        <div
          className={`flex items-center gap-3 py-2.5 pr-3 ${rowBg} ${!row.is_active ? "opacity-50" : ""}`}
          style={{ paddingLeft: `${12 + depth * 28}px` }}
        >
          {/* 트리 마커 (하위 전용) */}
          {isSub && (
            <span className="text-gray-300 text-sm font-light select-none -mr-1" aria-hidden>└</span>
          )}

          <button
            type="button"
            onClick={() => hasChildren && toggleExpand(row.id)}
            className={`w-5 text-xs ${hasChildren ? "text-gray-500" : "text-transparent"}`}
          >
            {hasChildren ? (isExpanded ? "▾" : "▸") : "·"}
          </button>

          {/* 아이콘 - 최상위는 크고 명확, 하위는 작고 dim */}
          <div className={`flex-shrink-0 rounded-full overflow-hidden flex items-center justify-center ${iconWrap}`}>
            {(() => {
              if (isSub) return <span className="text-[8px] text-gray-400 tracking-wider">SUB</span>;
              if (row.icon_url?.startsWith(BUILTIN_ICON_PREFIX)) {
                return <BuiltinCategoryIcon name={row.icon_url.slice(BUILTIN_ICON_PREFIX.length)} className="w-6 h-6 text-amber-700" />;
              }
              if (row.icon_url) {
                return (
                  <div className="relative w-full h-full">
                    <Image src={row.icon_url} alt={row.name_ko} fill sizes="44px" className="object-cover" unoptimized />
                  </div>
                );
              }
              // icon_url 미지정 → shop이 실제 노출하는 fallback 아이콘 표시
              return <BuiltinCategoryIcon name={guessIconKey(row.name_ja || row.name_ko)} className="w-6 h-6 text-gray-500" />;
            })()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {/* 특수 카테고리 배지 (최상위 전용) */}
              {!isSub && row.is_special && (
                <span className="text-[10px] font-bold tracking-wider text-white bg-purple-600 border border-purple-700 px-2 py-0.5 rounded shadow-sm">
                  🔒 SPECIAL
                </span>
              )}
              {/* 영문 라벨 배지: 최상위 전용 */}
              {!isSub && row.name_en && (
                <span className="text-[10px] font-semibold tracking-wider text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded">
                  {row.name_en}
                </span>
              )}
              <p className={`truncate ${nameCls}`}>
                {row.name_ko} <span className={subNameCls}>/ {row.name_ja}</span>
              </p>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              #{row.id} · 순서 {row.sort_order}
              {!row.icon_url && !isSub && <span className="ml-1 text-gray-400">· 아이콘 미지정(자동)</span>}
              {row.is_active ? "" : " · 비활성"}
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
    <div>
      {/* Header · 상품관리 스타일 통일 */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">카테고리 관리</h1>
          <p className="text-sm text-gray-500 mt-1">하위 뎁스 · 아이콘 · 순서 · 활성 상태 관리 · 최상위 {roots.length}개 · 전체 {rows.length}개</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openCreate(null, true)}
            className="px-4 py-2 bg-purple-700 text-white text-sm rounded-lg hover:bg-purple-800 shadow-sm"
            title="비밀번호로 잠긴 특수 카테고리를 등록합니다 (예: Premium)"
          >
            🔒 + 특수 카테고리 등록
          </button>
          <button
            onClick={() => openCreate(null, false)}
            className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800"
            title="트리 최상단에 새 카테고리를 등록합니다"
          >
            + 카테고리 등록
          </button>
        </div>
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

      {/* 아이콘 선택 팝업 */}
      <IconPicker
        open={showIconPicker}
        currentValue={form.icon_url}
        onClose={() => setShowIconPicker(false)}
        onSelect={(v) => setForm((p) => ({ ...p, icon_url: v }))}
      />

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className={`px-6 py-4 border-b flex items-center justify-between ${form.is_special ? "bg-purple-50 border-purple-200" : "border-gray-100"}`}>
              <h3 className={`text-lg font-medium flex items-center gap-2 ${form.is_special ? "text-purple-900" : ""}`}>
                {form.is_special && <span>🔒</span>}
                {editing ? (form.is_special ? "특수 카테고리 수정" : "카테고리 수정") : (form.is_special ? "특수 카테고리 등록" : "카테고리 등록")}
              </h3>
              <button onClick={closeForm} className={form.is_special ? "text-purple-400 hover:text-purple-700" : "text-gray-400 hover:text-gray-700"}>✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* 상위 카테고리 - optgroup으로 최상위/하위 구분 · 하위는 상위이름과 함께 표기 */}
              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  상위 카테고리 <span className="text-gray-400 font-normal">· 선택 안 하면 최상위 카테고리로 등록</span>
                </label>
                <select
                  value={form.parent_id ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value ? Number(e.target.value) : null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                >
                  <option value="">◆ 최상위 (독립 카테고리)</option>
                  {(() => {
                    const excludeIds = editing ? new Set<number>([editing.id, ...getDescendantIds(editing.id)]) : new Set<number>();
                    const parents = rows.filter((r) => r.parent_id === null && !excludeIds.has(r.id));
                    if (parents.length === 0) return null;
                    return (
                      <optgroup label="── 최상위 카테고리 (여기서 선택하면 그 아래 하위로 등록됨) ──">
                        {parents.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name_ko} / {p.name_ja}{p.name_en ? ` · ${p.name_en}` : ""}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })()}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  {form.parent_id === null
                    ? "💡 shop 홈 원형 아이콘 영역에 노출되는 대분류로 등록됩니다."
                    : "💡 선택한 상위 아래에 하위(2뎁스)로 등록됩니다. shop에서는 상위 클릭 시 필터바에 노출됨."}
                </p>
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
                      title="한국어 → 일본어 자동 번역 (MyMemory/Google 무료)"
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
                      title="일본어 → 한국어 자동 번역 (MyMemory/Google 무료)"
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

              {/* 하위 카테고리는 영문 라벨 · 아이콘 필드 완전 숨김 (shop에서 애초에 안 씀) */}
              {form.parent_id === null && (
                <>
                  {/* 영문 라벨 - 최상위 전용 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      영문 라벨 <span className="text-gray-400 font-normal">(shop 홈 원형 아이콘 하단 표기, 짧게 · 예: ACC, HAIR ACC, FASHION)</span>
                    </label>
                    <input
                      type="text"
                      value={form.name_en || ""}
                      onChange={(e) => setForm((p) => ({ ...p, name_en: e.target.value.toUpperCase() }))}
                      placeholder="ACC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm uppercase"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">비워두면 shop 홈 원형 아이콘 하단에 언어별 이름(한국어/일본어)이 그대로 노출됨.</p>
                  </div>

                  {/* 아이콘 - 최상위 전용 */}
                  <div>
                    <label className="block text-xs text-gray-600 mb-2">
                      아이콘 <span className="text-gray-400">(노출 크기 64×64 고정)</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="w-16 h-16 rounded-full border border-gray-200 bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {(() => {
                          if (form.icon_url.startsWith(BUILTIN_ICON_PREFIX)) {
                            return <BuiltinCategoryIcon name={form.icon_url.slice(BUILTIN_ICON_PREFIX.length)} className="w-8 h-8 text-gray-700" />;
                          }
                          if (form.icon_url) {
                            return <Image src={form.icon_url} alt="icon" width={64} height={64} className="object-cover w-full h-full" unoptimized />;
                          }
                          return <BuiltinCategoryIcon name={guessIconKey(form.name_ja || form.name_ko)} className="w-8 h-8 text-gray-400" />;
                        })()}
                      </div>
                      <div className="flex-1">
                        <button
                          type="button"
                          onClick={() => setShowIconPicker(true)}
                          className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                        >
                          {form.icon_url ? "🎨 아이콘 변경" : "🎨 아이콘 선택"}
                        </button>
                        <p className="text-[10px] text-gray-400 mt-1.5">기본 25종에서 선택 · 이미지 직접 업로드도 가능. 비워두면 이름 기반 자동 매칭.</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* 하위 카테고리 안내 배너 - 필드 숨김 이유 명시 */}
              {form.parent_id !== null && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-[11px] text-blue-800 leading-relaxed">
                    <span className="font-semibold">💡 하위 카테고리 안내</span><br />
                    영문 라벨 · 아이콘 · 특수 잠금은 <b>최상위 카테고리 전용</b>입니다. 하위는 shop 상단 필터바에 <b>한국어/일본어 이름</b>이 그대로 노출됩니다.
                  </p>
                </div>
              )}

              {/* 특수 카테고리 (비밀번호 잠금) - 최상위 전용 */}
              {form.parent_id === null && (
                <div className={`p-4 rounded-lg border-2 ${form.is_special ? "bg-purple-50 border-purple-300" : "bg-gray-50 border-gray-200"}`}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_special}
                      onChange={(e) => setForm((p) => ({ ...p, is_special: e.target.checked, new_password: e.target.checked ? p.new_password : "" }))}
                      className="w-4 h-4 accent-purple-600"
                    />
                    <span className="text-sm font-semibold text-purple-900">🔒 특수 카테고리 (비밀번호 잠금)</span>
                  </label>
                  <p className="text-[11px] text-purple-700 mt-1 ml-6">
                    shop에서 이 카테고리를 클릭하면 비밀번호를 요구합니다. 통과하면 4시간 동안 유지됩니다.
                  </p>

                  {form.is_special && (
                    <div className="mt-3 ml-6">
                      <label className="block text-xs font-semibold text-purple-900 mb-1">
                        비밀번호 {editing ? "변경 (비워두면 기존 유지)" : "설정 *"}
                      </label>
                      <input
                        type="password"
                        value={form.new_password}
                        onChange={(e) => setForm((p) => ({ ...p, new_password: e.target.value }))}
                        placeholder={editing ? "변경 시에만 입력" : "예: 1004"}
                        autoComplete="new-password"
                        className="w-full max-w-xs px-3 py-2 border border-purple-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                      />
                      {editing?.is_special && (
                        <p className="text-[10px] text-purple-600 mt-1">현재 비밀번호가 설정되어 있습니다. 바꾸려면 새 값 입력.</p>
                      )}
                    </div>
                  )}
                </div>
              )}

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
