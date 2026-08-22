"use client";

// 매장 화면 커스터마이징 · 편집 페이지
// - 스키마 기반 폼 자동 생성 (shopUiSchema.ts 수정만으로 새 항목 추가 가능)
// - 활성 프리셋 로드 · 변경 · 저장 · 다른 이름으로 저장 · 원복 · 미리보기

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SHOP_UI_SCHEMA, DEFAULT_CONFIG, mergeWithDefaults, type ShopUiConfig, type FieldMeta } from "@/lib/shopUiSchema";

interface Preset {
  id: number;
  name: string;
  description: string | null;
  config: ShopUiConfig;
  is_active: boolean;
  is_default: boolean;
  updated_at: string;
}

const SHOP_URL = process.env.NEXT_PUBLIC_SHOP_URL || "http://localhost:3001";

export default function CustomizePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [active, setActive] = useState<Preset | null>(null);
  const [config, setConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("shop_ui_presets")
      .select("*")
      .eq("is_active", true)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      setError(error.message);
    } else if (data) {
      const p: Preset = { ...data, config: mergeWithDefaults(data.config) };
      setActive(p);
      setConfig(p.config);
      setDirty(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (section: string, key: string, value: unknown) => {
    setConfig((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      (next as Record<string, Record<string, unknown>>)[section][key] = value;
      return next;
    });
    setDirty(true);
    setMsg("");
  };

  const saveOverwrite = async () => {
    if (!active) return;
    if (!confirm("현재 활성 프리셋을 이 내용으로 덮어씁니다.\n\n계속하시겠어요?")) return;
    setSaving(true);
    const { error } = await supabase
      .from("shop_ui_presets")
      .update({ config })
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      setMsg("저장 실패: " + error.message);
    } else {
      setMsg("저장 완료 · 매장에 반영되었습니다");
      setDirty(false);
      load();
    }
  };

  const saveAsNew = async () => {
    const name = newName.trim();
    if (!name) return alert("이름을 입력해주세요");
    setSaving(true);
    // 1) 기존 활성 프리셋 → 비활성화
    await supabase.from("shop_ui_presets").update({ is_active: false }).eq("is_active", true).is("deleted_at", null);
    // 2) 새 프리셋 · 활성 저장
    const { error } = await supabase.from("shop_ui_presets").insert({
      name,
      config,
      is_active: true,
    });
    setSaving(false);
    if (error) {
      setMsg("저장 실패: " + error.message);
    } else {
      setMsg(`「${name}」 프리셋을 새로 만들어 활성화했습니다`);
      setShowSaveAs(false);
      setNewName("");
      setDirty(false);
      load();
    }
  };

  const resetToDefault = async () => {
    if (!confirm("처음 만들었던 기본 화면으로 되돌립니다.\n\n현재 활성 프리셋의 내용이 기본값으로 바뀝니다.\n계속하시겠어요?")) return;
    // 시스템 기본 config 조회
    const { data } = await supabase
      .from("shop_ui_presets")
      .select("config")
      .eq("is_default", true)
      .maybeSingle();
    const def = mergeWithDefaults(data?.config ?? DEFAULT_CONFIG);
    setConfig(def);
    setDirty(true);
    setMsg("기본 화면으로 되돌렸어요. 「저장」을 눌러 반영해주세요.");
  };

  const openPreview = () => {
    // 편집 중 config를 sessionStorage에 담아 shop이 preview 모드로 읽음
    const payload = { config, ts: Date.now() };
    try {
      sessionStorage.setItem("shopUiPreviewDraft", JSON.stringify(payload));
    } catch {}
    window.open(`${SHOP_URL}?preview=draft`, "_blank", "noopener");
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎨 매장 화면 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            매장(고객용) 화면의 배치 · 크기 · 노출 정보를 사장님이 직접 조정할 수 있어요
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/customize/list" className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            📚 저장된 화면 목록
          </Link>
          <Link href="/customize/trash" className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            🗑 휴지통
          </Link>
        </div>
      </div>

      {/* 활성 정보 */}
      {active && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-2">
          <div className="text-sm text-emerald-800">
            🟢 지금 매장에 반영된 화면: <b>{active.name}</b>
            {active.is_default && <span className="ml-2 text-[10px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">기본</span>}
          </div>
          <div className="text-[11px] text-emerald-700">마지막 저장: {new Date(active.updated_at).toLocaleString("ko-KR")}</div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <p className="font-semibold">화면 설정을 불러오지 못했어요</p>
          <p className="mt-1">{error}</p>
          <p className="mt-2 text-[11px] text-red-600">
            원인: 데이터 테이블이 아직 만들어지지 않았을 수 있어요.
            <br />→ 사장님이 Supabase SQL Editor에서 <code className="px-1 py-0.5 bg-red-100 rounded">2.deploy/003_cookies_shop_ui_presets_20260822/001_create_table.sql</code> 을 한 번 실행해주시면 시작됩니다.
          </p>
        </div>
      ) : (
        <>
          {/* 섹션별 폼 · 스키마에서 자동 생성 */}
          <div className="space-y-4">
            {SHOP_UI_SCHEMA.map((sec) => (
              <div key={sec.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{sec.icon}</span>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">{sec.label}</h3>
                      {sec.hint && <p className="text-[11px] text-gray-500">{sec.hint}</p>}
                    </div>
                  </div>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {sec.fields.map((field) => (
                    <FieldControl
                      key={field.key}
                      field={field}
                      value={(config[sec.key as keyof ShopUiConfig] as Record<string, unknown>)[field.key]}
                      onChange={(v) => updateField(sec.key, field.key, v)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 액션 바 · 하단 sticky */}
          <div className="sticky bottom-4 mt-6 p-4 rounded-2xl bg-gray-900 text-white shadow-xl flex items-center justify-between flex-wrap gap-3">
            <div className="text-xs">
              {msg && <span className="opacity-90">{msg}</span>}
              {!msg && dirty && <span className="opacity-70">🔸 저장하지 않은 변경사항이 있어요</span>}
              {!msg && !dirty && <span className="opacity-50">변경사항 없음</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={resetToDefault}
                className="px-3 py-1.5 text-xs text-gray-300 border border-gray-700 rounded-lg hover:bg-gray-800"
                title="처음 제공한 기본 화면으로 되돌리기"
              >
                ↺ 기본 화면으로
              </button>
              <button
                onClick={openPreview}
                className="px-4 py-1.5 text-xs bg-white/10 text-white rounded-lg hover:bg-white/20 font-medium border border-white/20"
                title="지금 편집한 내용으로 매장 화면 미리보기 (새 탭)"
              >
                👁 미리보기 (새 탭)
              </button>
              <button
                onClick={() => setShowSaveAs(true)}
                disabled={saving}
                className="px-4 py-1.5 text-xs bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] font-semibold disabled:opacity-50"
              >
                💾 이름 붙여 저장
              </button>
              <button
                onClick={saveOverwrite}
                disabled={saving || !dirty}
                className="px-5 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-semibold disabled:opacity-40"
              >
                {saving ? "저장 중..." : "✓ 지금 화면에 반영"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 이름 붙여 저장 모달 */}
      {showSaveAs && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowSaveAs(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-2">💾 이 화면에 이름을 붙여주세요</h3>
            <p className="text-xs text-gray-500 mb-4">
              나중에 다른 화면으로 바꿨다가도 · 목록에서 이 이름을 선택해 다시 불러올 수 있어요
            </p>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예) 여름 시즌 · 크게 · 3열 화면"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveAsNew()}
            />
            <div className="flex items-center justify-end gap-2 mt-4">
              <button onClick={() => setShowSaveAs(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">취소</button>
              <button onClick={saveAsNew} disabled={saving || !newName.trim()} className="px-4 py-1.5 text-sm bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] disabled:opacity-50">
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 스키마 기반 필드 컨트롤 ─────────────────────────
function FieldControl({ field, value, onChange }: { field: FieldMeta; value: unknown; onChange: (v: unknown) => void }) {
  const label = (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="text-xs font-semibold text-gray-700">{field.label}</label>
      {field.hint && <span className="text-[10px] text-gray-400">· {field.hint}</span>}
    </div>
  );

  if (field.type === "boolean") {
    const on = !!value;
    return (
      <div>
        {label}
        <button
          type="button"
          onClick={() => onChange(!on)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition text-sm ${
            on ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-gray-50 border-gray-200 text-gray-600"
          }`}
        >
          <span className={`inline-block w-4 h-4 rounded-full ${on ? "bg-emerald-500" : "bg-gray-300"}`}></span>
          <span>{on ? "보이기 · ON" : "숨김 · OFF"}</span>
        </button>
      </div>
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <div>
        {label}
        <div className="flex flex-wrap gap-1">
          {field.options.map((opt) => {
            const active = value === opt.value;
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => onChange(opt.value)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                  active
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (field.type === "range") {
    const num = Number(value ?? 0);
    return (
      <div>
        {label}
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-mono font-semibold text-gray-700 min-w-[3rem] text-right">
            {num}{field.suffix ?? ""}
          </span>
        </div>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div>
        {label}
        <input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={field.min}
          max={field.max}
          className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40"
        />
      </div>
    );
  }

  if (field.type === "numberList") {
    const arr = Array.isArray(value) ? (value as number[]) : [];
    const count = field.count ?? 3;
    const items = Array.from({ length: count }, (_, i) => arr[i] ?? 0);
    return (
      <div>
        {label}
        <div className="flex items-center gap-2 flex-wrap">
          {items.map((n, i) => (
            <input
              key={i}
              type="number"
              value={n}
              onChange={(e) => {
                const next = [...items];
                next[i] = Number(e.target.value);
                onChange(next);
              }}
              min={field.min}
              max={field.max}
              className="w-20 px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand)]/40"
              placeholder={`${i + 1}번째`}
            />
          ))}
        </div>
      </div>
    );
  }

  return null;
}
