"use client";

// 매장 화면 커스터마이징 · 편집 페이지
// - 스키마 기반 폼 자동 생성 (shopUiSchema.ts 수정만으로 새 항목 추가 가능)
// - 활성 프리셋 로드 · 변경 · 저장 · 다른 이름으로 저장 · 원복 · 미리보기

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SHOP_UI_SCHEMA, DEFAULT_CONFIG, mergeWithDefaults, deriveMobileValues, type ShopUiConfig, type FieldMeta } from "@/lib/shopUiSchema";
import FormActionBar from "@/components/FormActionBar";
import ShopPreview from "@/components/ShopPreview";
import { loadSession, saveSession, clearSession } from "@/lib/sessionPersistence";

const DRAFT_KEY = "adm.session.customizeDraft";

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
      const next = JSON.parse(JSON.stringify(prev)) as ShopUiConfig;
      (next as unknown as Record<string, Record<string, unknown>>)[section][key] = value;
      // 링크 ON일 때만 · PC 값 조정 시 모바일 자동 동기화
      return next.linkMobileToDesktop ? deriveMobileValues(next) : next;
    });
    setDirty(true);
    setMsg("");
  };

  const toggleLink = () => {
    setConfig((prev) => {
      const linked = !prev.linkMobileToDesktop;
      const next: ShopUiConfig = { ...prev, linkMobileToDesktop: linked };
      return linked ? deriveMobileValues(next) : next;
    });
    setDirty(true);
    setMsg("");
  };

  // 미리보기 기기 (PC / 모바일) · 화면 시각화용
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewPage, setPreviewPage] = useState<"list" | "detail">("list");

  // 임시저장 · 메일 스타일 팝업 + 자동 저장 + 수동 임시저장
  const [restorePrompt, setRestorePrompt] = useState<ShopUiConfig | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0);

  // 활성 프리셋 로드 완료 후 · 임시저장된 것 있으면 팝업
  useEffect(() => {
    if (loading || !active) return;
    const draft = loadSession<ShopUiConfig | null>(DRAFT_KEY, null);
    if (draft && draft.version) {
      // 활성 config와 다른 경우만 팝업
      if (JSON.stringify(draft) !== JSON.stringify(config)) {
        setRestorePrompt(draft);
      } else {
        setAutoSaveEnabled(true);
      }
    } else {
      setAutoSaveEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, active?.id]);

  // rows(config) 자동 저장 · 500ms debounce
  useEffect(() => {
    if (!autoSaveEnabled || saving) return;
    const t = setTimeout(() => {
      saveSession(DRAFT_KEY, config);
      setLastSavedAt(new Date());
    }, 500);
    return () => clearTimeout(t);
  }, [config, autoSaveEnabled, saving]);

  const manualSave = () => {
    saveSession(DRAFT_KEY, config);
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };

  const doRestore = () => {
    if (restorePrompt) {
      setConfig(mergeWithDefaults(restorePrompt));
      setDirty(true);
    }
    setRestorePrompt(null);
    setAutoSaveEnabled(true);
  };
  const doDiscard = () => {
    clearSession(DRAFT_KEY);
    setRestorePrompt(null);
    setAutoSaveEnabled(true);
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
      // 정식 저장 완료 시 · 임시저장은 정리
      clearSession(DRAFT_KEY);
      setLastSavedAt(null);
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
    // adm(3002)과 shop(3001)은 다른 origin · sessionStorage 공유 불가
    // → config를 URL 파라미터로 전달 (Base64 · 데이터 크기 작음)
    let encoded = "";
    try {
      encoded = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
    } catch (e) {
      console.error("config 인코딩 실패:", e);
    }
    const params = new URLSearchParams({
      preview: "draft",
      device: previewDevice,
      c: encoded,
    });
    window.open(`${SHOP_URL}?${params.toString()}`, "_blank", "noopener");
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎨 매장 화면 관리</h1>
          <p className="text-sm text-gray-500 mt-1">
            매장(고객용) 화면의 배치 · 크기 · 노출 정보를 사장님이 직접 조정할 수 있어요
          </p>
          <div className="flex items-center gap-2 mt-1.5 text-[11px]">
            <button
              onClick={manualSave}
              className="px-2 py-0.5 bg-white border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50 flex items-center gap-1"
              title="현재 편집 상태를 즉시 임시저장"
            >
              💾 임시저장
            </button>
            <span key={savedTick} className={`text-gray-400 ${savedTick > 0 ? "animate-fade-in" : ""}`}>
              {lastSavedAt
                ? `방금 저장됨 · ${lastSavedAt.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
                : "자동 임시저장 · 페이지 이동해도 유지"}
            </span>
          </div>
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

      {/* 임시저장 복원 팝업 · 메일 스타일 */}
      {restorePrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">💾</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">이전에 편집 중이던 화면이 있어요</h3>
                <p className="text-sm text-gray-500 mt-1">
                  저장하지 않은 편집 내용이 남아있어요. 이어서 편집하시겠어요?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button onClick={doDiscard} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">🗑 새로 시작</button>
              <button onClick={doRestore} className="px-5 py-2 text-sm bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] font-semibold">✎ 불러오기</button>
            </div>
          </div>
        </div>
      )}

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
          {/* ── 상단 큰 탭 · 편집 대상 (화면) + 미리보기 기기 ─── */}
          <div className="mb-4 bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {/* 좌측 · 어느 화면 편집 · 큰 세로 탭 2개 */}
              <div className="p-3 bg-gradient-to-br from-gray-50 to-white border-b md:border-b-0 md:border-r border-gray-200">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">📝 어느 화면을 편집할까요?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPreviewPage("list")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewPage === "list" ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛍</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">상품 목록 화면</p>
                        <p className="text-[10px] text-gray-500">홈 · 카테고리 · 상품 그리드</p>
                      </div>
                      {previewPage === "list" && <span className="ml-auto text-[10px] font-semibold text-[var(--color-brand-dk)]">● 편집 중</span>}
                    </div>
                  </button>
                  <button
                    onClick={() => setPreviewPage("detail")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewPage === "detail" ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">상품 상세 화면</p>
                        <p className="text-[10px] text-gray-500">상품 클릭 시 나오는 페이지</p>
                      </div>
                      {previewPage === "detail" && <span className="ml-auto text-[10px] font-semibold text-[var(--color-brand-dk)]">● 편집 중</span>}
                    </div>
                  </button>
                </div>
              </div>
              {/* 우측 · 어느 기기 미리보기 · PC/모바일 */}
              <div className="p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">👁 미리보기 · 어떤 기기로?</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewDevice === "desktop" ? "border-gray-900 bg-gray-900 text-white shadow" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🖥</span>
                      <div>
                        <p className="text-sm font-bold">PC</p>
                        <p className={`text-[10px] ${previewDevice === "desktop" ? "text-gray-300" : "text-gray-500"}`}>큰 화면</p>
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewDevice === "mobile" ? "border-gray-900 bg-gray-900 text-white shadow" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📱</span>
                      <div>
                        <p className="text-sm font-bold">모바일</p>
                        <p className={`text-[10px] ${previewDevice === "mobile" ? "text-gray-300" : "text-gray-500"}`}>휴대폰 화면</p>
                      </div>
                    </div>
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none pl-1 pt-1">
                  <input
                    type="checkbox"
                    checked={config.linkMobileToDesktop}
                    onChange={toggleLink}
                    className="w-3.5 h-3.5 accent-[var(--color-brand)]"
                  />
                  <span className="text-[11px] text-gray-600">모바일 값 · PC 조정 시 자동으로 함께 조정</span>
                </label>
              </div>
            </div>
          </div>

          {/* 좌: 편집 폼 (해당 화면 관련 섹션만) · 우: 실시간 미리보기 */}
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
            {/* 편집 폼 · 선택된 화면에 해당하는 섹션만 노출 */}
            <div className="space-y-4">
              {SHOP_UI_SCHEMA
                .filter((sec) => {
                  // 상품 목록 화면 편집 중 → productList + pagination + categoryTabs 만
                  // 상품 상세 화면 편집 중 → productDetail 만
                  if (previewPage === "list") return sec.key !== "productDetail";
                  return sec.key === "productDetail";
                })
                .map((sec) => (
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
                    {sec.fields
                      .filter((f) => {
                        if (f.hidden && config.linkMobileToDesktop) return false;
                        return true;
                      })
                      .map((field) => (
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

            {/* 우 · 실시간 미리보기 · sticky · 선택된 화면 렌더 */}
            <div className="hidden xl:block">
              <div className="sticky top-6 space-y-3">
                <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-700">
                    🔴 실시간 미리보기 · {previewPage === "list" ? "🛍 상품 목록" : "📦 상품 상세"} · {previewDevice === "desktop" ? "🖥 PC" : "📱 모바일"}
                  </div>
                  <div className="text-[10px] text-gray-400">위 탭에서 전환</div>
                </div>
                <ShopPreview config={config} device={previewDevice} page={previewPage} />
              </div>
            </div>
          </div>

          <FormActionBar
            cancelHref="/customize/list"
            cancelLabel="목록으로"
            status={
              msg ? <span className="text-emerald-700 font-medium">{msg}</span>
              : dirty ? <span className="text-amber-700">🔸 저장하지 않은 변경사항이 있어요</span>
              : <span>변경사항 없음</span>
            }
            secondary={[
              { label: "↺ 기본 화면으로", onClick: resetToDefault },
              { label: "👁 미리보기 (새 탭)", onClick: openPreview },
              { label: "💾 이름 붙여 저장", onClick: () => setShowSaveAs(true), disabled: saving },
            ]}
            primary={{
              label: saving ? "저장 중..." : "✓ 지금 화면에 반영",
              onClick: saveOverwrite,
              disabled: saving || !dirty,
            }}
          />
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

  if (field.type === "counter") {
    const num = Number(value ?? field.min ?? 1);
    const min = field.min ?? 1;
    const max = field.max ?? 20;
    const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));
    return (
      <div>
        {label}
        {/* 세로 세트 · 한 세트임이 명확 · 얇은 테두리로 그룹 표시 */}
        <div className="inline-flex flex-col items-stretch gap-2 p-2.5 rounded-lg border border-gray-200 bg-gray-50/50">
          {/* 상단: 스핌너 (▼ 숫자 ▲) · 재고와 동일 UX */}
          <div className="inline-flex items-center gap-0 rounded-md border border-gray-300 bg-white overflow-hidden shadow-sm mx-auto">
            <button
              type="button"
              onClick={() => set(num - 1)}
              disabled={num <= min}
              className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="감소"
            >
              ▼
            </button>
            <input
              type="number"
              value={num}
              onChange={(e) => set(Number(e.target.value) || min)}
              min={min}
              max={max}
              className="w-14 px-2 py-1.5 text-sm text-center font-semibold text-gray-900 border-x border-gray-200 focus:outline-none focus:bg-blue-50"
            />
            <button
              type="button"
              onClick={() => set(num + 1)}
              disabled={num >= max}
              className="px-3 py-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
              title="증가"
            >
              ▲
            </button>
            {field.suffix && <span className="px-2 text-sm text-gray-500 bg-gray-50">{field.suffix}</span>}
          </div>
          {/* 하단: 슬라이더 · min~max 시각적 조정 */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-[9px] text-gray-400 font-mono">{min}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={1}
              value={num}
              onChange={(e) => set(Number(e.target.value))}
              className="flex-1 accent-[var(--color-brand)]"
              aria-label={field.label}
            />
            <span className="text-[9px] text-gray-400 font-mono">{max}</span>
          </div>
        </div>
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
