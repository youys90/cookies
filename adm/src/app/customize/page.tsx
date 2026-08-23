"use client";

// 매장 화면 커스터마이징 · 편집 페이지
// - 스키마 기반 폼 자동 생성 (shopUiSchema.ts 수정만으로 새 항목 추가 가능)
// - 활성 프리셋 로드 · 변경 · 저장 · 다른 이름으로 저장 · 원복 · 미리보기

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { SHOP_UI_SCHEMA, DEFAULT_CONFIG, mergeWithDefaults, deriveMobileValues, type ShopUiConfig, type FieldMeta } from "@/lib/shopUiSchema";
import { translateKoJa } from "@/lib/translate";
import FormActionBar from "@/components/FormActionBar";
import ShopPreview from "@/components/ShopPreview";
import DraftSaveButton from "@/components/DraftSaveButton";
import DraftListButton from "@/components/DraftListButton";
import InlineFormatInput from "@/components/InlineFormatInput";
import { getShopUrl } from "@/lib/shopUrl";
import { upsertDraft, deleteDraft, listDrafts } from "@/lib/adminDrafts";
import { useSearchParams } from "next/navigation";

const PAGE_KEY = "customize";
const PAGE_LABEL = "매장 화면 관리";

interface Preset {
  id: number;
  name: string;
  description: string | null;
  config: ShopUiConfig;
  is_active: boolean;
  is_default: boolean;
  updated_at: string;
}

// shop URL · 런타임 자동 감지 (매장 PC 등 · 별도 설정 없이 동작)

export default function CustomizePage() {
  const [loading, setLoading] = useState(true);
  const [sampleProductId, setSampleProductId] = useState<number | null>(null);
  const [error, setError] = useState<string>("");
  const [active, setActive] = useState<Preset | null>(null);
  const [config, setConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
  const [originalConfig, setOriginalConfig] = useState<ShopUiConfig>(DEFAULT_CONFIG);
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
      setOriginalConfig(p.config); // 서버 원본 스냅샷 · 부분 저장 시 참조
      setDirty(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 미리보기 · 상세 페이지로 열 때 쓸 임의의 상품 ID 하나 캐싱 (activeProduct 우선)
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("products").select("id").eq("is_active", true).limit(1).maybeSingle();
      if (data?.id) setSampleProductId(data.id);
    })();
  }, []);

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
  const [previewPage, setPreviewPage] = useState<"list" | "detail" | "mainTop">("mainTop");
  // 메인 화면 · 2뎁스 세부 영역 선택 · 사장님 요구 (스포트라이트 UX)
  type MainSection = "promoBar" | "header" | "hero" | "benefits" | "categories" | "footer";
  const [mainSection, setMainSection] = useState<MainSection>("promoBar");
  // 편집 모드 · "split" = 좌측 설정창 + 우측 미리보기 (현재)  |  "preview" = 큰 미리보기 + 클릭 시 설정 팝업
  const [editorMode, setEditorMode] = useState<"split" | "preview">("split");

  // 임시저장 · 사장님 명시 요청 시에만 저장/불러오기 (자동 감지 없음)
  // 진입 시 · 항상 라이브(활성 프리셋) 값으로 시작 · 임시저장 목록 팝업 없음
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0);
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");

  // 마운트 시 · URL에 ?draft={id} 있을 때만 명시적으로 이어서 편집
  // 그 외에는 라이브 프리셋 값 그대로 (자동 감지 · 복원 팝업 없음)
  useEffect(() => {
    if (loading || !active || !requestedDraftId) return;
    const all = listDrafts(PAGE_KEY);
    const d = all.find((x) => x.id === requestedDraftId);
    if (d) {
      setConfig(mergeWithDefaults(d.data as unknown));
      setCurrentDraftId(d.id);
      setDirty(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, active?.id, requestedDraftId]);

  const manualSave = () => {
    const d = upsertDraft({ id: currentDraftId || undefined, pageKey: PAGE_KEY, pageLabel: PAGE_LABEL, data: config });
    if (!d) {
      alert("임시 저장 실패\n\n브라우저 저장 공간이 부족하거나 프라이빗 모드일 수 있어요.\n(저장한 목록에서 오래된 항목을 삭제하면 공간이 확보됩니다.)");
      return;
    }
    setCurrentDraftId(d.id);
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };
  const loadDraftData = (data: unknown, draftId: string) => {
    if (data && typeof data === "object") {
      setConfig(mergeWithDefaults(data));
      setCurrentDraftId(draftId);
      setDirty(true);
      setMsg("불러왔어요. 저장을 눌러야 매장에 반영됩니다.");
    }
  };

  // 부분 저장 · 지금 편집 중인 화면의 섹션만 · 나머지는 서버 원본 유지
  const buildScopedConfig = (scope: "current" | "all"): ShopUiConfig => {
    if (scope === "all") return config;
    // 메인 화면 (mainTop) 편집 중 · 하단바(footer) + 카테고리 탭(categoryTabs) 편집도 이 뷰 안에서 이뤄지므로 함께 저장
    // - categoryTabs 는 mainSection === "categories" 에서 편집 · 사장님 지시로 여기로 이동
    // - linkMobileToDesktop 은 categoryTabs.columnsMobile 자동 파생과 연동되므로 함께 저장
    if (previewPage === "mainTop") {
      return {
        ...originalConfig,
        linkMobileToDesktop: config.linkMobileToDesktop,
        mainTop: config.mainTop,
        footer: config.footer,
        categoryTabs: config.categoryTabs,
      };
    }
    // current 편집 화면에 해당하는 섹션만 · 나머지는 originalConfig에서
    // 상품 목록 편집 · productList + pagination 만 (categoryTabs 는 메인/카테고리 편집으로 이동)
    if (previewPage === "list") {
      return {
        ...originalConfig,
        linkMobileToDesktop: config.linkMobileToDesktop,
        productList: config.productList,
        pagination: config.pagination,
      };
    }
    // detail
    return {
      ...originalConfig,
      linkMobileToDesktop: config.linkMobileToDesktop,
      productDetail: config.productDetail,
    };
  };

  // 「저장된 매장 화면 목록」 모달 · customize/list 페이지 대신 팝업으로
  interface PresetRow { id: number; name: string; description: string | null; is_active: boolean; is_default: boolean; updated_at: string }
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [presetList, setPresetList] = useState<PresetRow[]>([]);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetBusyId, setPresetBusyId] = useState<number | null>(null);
  const loadPresets = async () => {
    setPresetLoading(true);
    const { data } = await supabase
      .from("shop_ui_presets")
      .select("id, name, description, is_active, is_default, updated_at")
      .is("deleted_at", null)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });
    const all = ((data as PresetRow[]) || []);
    // 자동 저장 (「관리자 저장 화면 · ...」) 제외 · 사장님 명시 저장만
    setPresetList(all.filter((p) => !p.name.startsWith("관리자 저장 화면 ·")));
    setPresetLoading(false);
  };
  const presetActivate = async (row: PresetRow) => {
    if (!confirm(`「${row.name}」 화면을 불러옵니다.\n\n현재 수정 중인 내용은 불러온 화면의 설정으로 바뀝니다.\n계속하시겠어요?`)) return;
    setPresetBusyId(row.id);
    // 실제 매장에는 반영 안 함 · 저장한 프리셋의 config만 편집 상태로 로드
    const { data, error } = await supabase.from("shop_ui_presets").select("config").eq("id", row.id).maybeSingle();
    setPresetBusyId(null);
    if (error || !data?.config) {
      alert("화면을 불러오지 못했습니다.\n다시 시도해주세요.");
      return;
    }
    const loaded = mergeWithDefaults(data.config);
    setConfig(loaded);
    setDirty(JSON.stringify(loaded) !== JSON.stringify(originalConfig));
    setMsg(`「${row.name}」 화면을 불러왔습니다.`);
    setShowPresetsModal(false);
  };
  const presetRename = async (row: PresetRow) => {
    const name = prompt("새 이름을 입력해주세요", row.name);
    if (!name || name === row.name) return;
    setPresetBusyId(row.id);
    const { error } = await supabase.from("shop_ui_presets").update({ name }).eq("id", row.id);
    setPresetBusyId(null);
    if (error) alert("변경 실패: " + error.message);
    else { loadPresets(); if (active?.id === row.id) load(); }
  };
  const presetDelete = async (row: PresetRow) => {
    if (row.is_default) return alert("기본 화면은 삭제할 수 없어요");
    if (row.is_active) return alert("지금 매장에 반영된 화면은 삭제할 수 없어요.\n먼저 다른 화면을 활성화해주세요.");
    if (!confirm(`「${row.name}」 을 휴지통으로 옮깁니다.\n\n20일 안에 되돌릴 수 있어요.\n\n계속하시겠어요?`)) return;
    setPresetBusyId(row.id);
    const { error } = await supabase.from("shop_ui_presets").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
    setPresetBusyId(null);
    if (error) alert("삭제 실패: " + error.message);
    else loadPresets();
  };

  // 「마지막 운영 화면으로 복원」을 위해 · 직전 매장 반영 config를 로컬 저장
  const PREV_LIVE_KEY = "adm.customize.prevLive.v1";
  const savePrevLiveSnapshot = (id: number, cfg: ShopUiConfig, name: string) => {
    try {
      const now = Date.now();
      window.localStorage.setItem(PREV_LIVE_KEY, JSON.stringify({ id, config: cfg, name, savedAt: now }));
    } catch {}
  };
  const [prevLive, setPrevLive] = useState<{ id: number; config: ShopUiConfig; name: string; savedAt: number } | null>(null);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREV_LIVE_KEY);
      if (raw) setPrevLive(JSON.parse(raw));
    } catch {}
  }, []);

  // 「현재 적용된 화면으로 돌아가기」 · 활성 프리셋 config를 편집 상태로 복구 · 실제 적용 상태는 그대로
  const restoreLastLive = () => {
    if (!active) return;
    if (!confirm("현재 적용된 화면으로 돌아갈까요?\n\n지금까지 바꾼 내용은 사라지고, 현재 적용된 화면으로 돌아갑니다.")) return;
    setConfig(active.config);
    setDirty(false);
    setMsg("↺ 현재 적용된 화면으로 돌아갔어요.");
  };

  // ko만 채워지고 ja 비어있으면 자동 번역 · 채워져있으면 유지
  const autoTranslatePair = async (pair: { ko: string; ja: string }): Promise<{ ko: string; ja: string }> => {
    if (pair.ko && pair.ko.trim() && (!pair.ja || pair.ja.trim() === "" || pair.ja === pair.ko)) {
      try {
        const ja = await translateKoJa(pair.ko, "ko", "ja");
        return { ko: pair.ko, ja: ja || pair.ko };
      } catch { return pair; }
    }
    return pair;
  };

  // 저장 직전 · 메인 화면 이중 언어 필드 전부 자동 번역 · 스타일 필드는 그대로 유지
  const autoTranslateMainTop = async (cfg: ShopUiConfig): Promise<ShopUiConfig> => {
    const mt = cfg.mainTop;
    // 프로모 문구
    const promo = await Promise.all((mt.promoBarMessages || []).map(autoTranslatePair));
    // 히어로 · 3필드
    const heroTitle = await autoTranslatePair(mt.hero.title);
    const heroBody = await autoTranslatePair(mt.hero.body);
    const heroFooter = await autoTranslatePair(mt.hero.footer);
    // 혜택 · 항목별 ko→ja · color/bold 유지
    const benefits = await Promise.all((mt.benefits || []).map(async (b) => {
      const p = await autoTranslatePair({ ko: b.ko, ja: b.ja });
      return { ...b, ko: p.ko, ja: p.ja };
    }));
    // 로고 · 태그라인
    const tagline = await autoTranslatePair(mt.logo.tagline);
    return {
      ...cfg,
      mainTop: {
        ...mt,
        promoBarMessages: promo,
        hero: { ...mt.hero, title: heroTitle, body: heroBody, footer: heroFooter },
        benefits,
        logo: { ...mt.logo, tagline },
      },
    };
  };

  const doSave = async (scope: "current" | "all") => {
    if (!active) return;
    let finalConfig = buildScopedConfig(scope);
    // 메인 화면 이중 언어 필드 · 저장 시 자동 일본어 번역
    finalConfig = await autoTranslateMainTop(finalConfig);
    const currentLabel = previewPage === "mainTop" ? "메인" : previewPage === "list" ? "상품 목록" : "상품 상세";
    const scopeLabel = scope === "all"
      ? "전체 저장 · 메인 화면 + 상품 목록 화면 + 상품 상세 화면 · 지금 편집한 내용 모두 저장됩니다"
      : `이번 저장 · 「${currentLabel} 화면」만 변경 · 다른 화면 설정은 그대로 유지됩니다`;
    if (!confirm(`${scopeLabel}\n\n계속하시겠어요?`)) return;
    setSaving(true);
    // 저장 전 · 현재 매장 반영 config를 이전 스냅샷으로 백업 · 「마지막 운영 화면으로 복원」 기능용
    savePrevLiveSnapshot(active.id, active.config, active.name);
    setPrevLive({ id: active.id, config: active.config, name: active.name, savedAt: Date.now() });
    // 저장 config가 소스 오리지널(DEFAULT_CONFIG)과 완전히 같은지 판정
    // - 같으면 · 「기본 화면」으로 인식 (사장님 논리 · 기본 화면 원복 → 저장 = 여전히 기본 화면)
    // - 다르면 · 「관리자 저장 화면 · MM-DD HH:mm 저장」 자동 이름 갱신
    // 「이름 붙여 저장」 마커 (description) 는 이 저장에서 리셋 (원래 이름과 다른 상태이므로)
    const isReallyDefault = JSON.stringify(finalConfig) === JSON.stringify(mergeWithDefaults(DEFAULT_CONFIG));
    const nowStr = new Date().toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
    const autoName = isReallyDefault ? "기본 화면" : `관리자 저장 화면 · ${nowStr} 저장`;
    const updatePayload: { config: ShopUiConfig; name: string; description?: string | null; is_default?: boolean } = {
      config: finalConfig,
      name: autoName,
      is_default: isReallyDefault,
    };
    if (active.description) updatePayload.description = null;
    const { error } = await supabase
      .from("shop_ui_presets")
      .update(updatePayload)
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      setMsg("저장 실패: " + error.message);
    } else {
      setMsg("💾 저장 완료 · 실제 매장에 반영되었습니다 (매장 탭을 새로고침하면 확인 가능)");
      setDirty(false);
      if (currentDraftId) { deleteDraft(currentDraftId); setCurrentDraftId(null); }
      setLastSavedAt(null);
      load();
    }
  };

  const saveOverwrite = () => doSave("current"); // 기본은 현재 화면만
  const saveAll = () => doSave("all");

  const saveAsNew = async () => {
    const name = newName.trim();
    if (!name) return alert("이름을 입력해주세요");
    setSaving(true);
    // 「이름 붙여 저장」 = 스냅샷 저장만 · 매장 반영 X (사장님 요구)
    // is_active: false 로 저장 · 매장은 기존 활성 프리셋 유지
    // 목록에서 「이 화면으로 바꾸기」 눌러야 매장에 반영됨
    const { error } = await supabase.from("shop_ui_presets").insert({
      name,
      description: "사장님이 이름 붙여 저장한 매장 화면",
      config,
      is_active: false,
    });
    setSaving(false);
    if (error) {
      setMsg("저장 실패: " + error.message);
    } else {
      setMsg(`💾 「${name}」 스냅샷으로 저장되었어요 (실제 매장에는 반영 안 됨 · 「저장된 매장 화면 목록」에서 「이 화면으로 바꾸기」를 눌러야 반영돼요)`);
      setShowSaveAs(false);
      setNewName("");
      // dirty 유지 · 사장님이 편집한 값이 현재 매장 활성 프리셋과 여전히 다르므로
      load();
    }
  };

  const resetToDefault = () => {
    if (!confirm("기본값으로 되돌릴까요?\n\n화면 꾸미기에서 변경한 설정이 처음 제공된 값으로 돌아갑니다.\n※ 저장 전이므로 아직 적용되지 않아요.")) return;
    const def = mergeWithDefaults(DEFAULT_CONFIG);
    setConfig(def);
    setDirty(JSON.stringify(def) !== JSON.stringify(originalConfig));
    setMsg("↺ 기본값으로 되돌렸어요. 저장을 눌러야 적용됩니다.");
  };

  const openPreview = () => {
    // adm(3002)과 shop(3001)은 다른 origin · sessionStorage 공유 불가
    // → config를 URL 파라미터로 전달 (URL-safe Base64 · UTF-8 안전)
    let encoded = "";
    try {
      const json = JSON.stringify(config);
      const bytes = new TextEncoder().encode(json);
      let bin = "";
      bytes.forEach((b) => { bin += String.fromCharCode(b); });
      encoded = btoa(bin).replace(/\+/g, "-").replace(/\//g, "_");
    } catch (e) {
      console.error("config 인코딩 실패:", e);
    }
    // 실제 매장 페이지 경로 · 상세 편집이면 상품 상세 · 아니면 홈(상품 목록)
    const targetPath = previewPage === "detail" && sampleProductId
      ? `/product/${sampleProductId}`
      : "/";
    // 메인 편집 · 한국어 원본 그대로 검수하도록 강제 한국어
    const forceLangKo = previewPage === "mainTop";
    if (previewDevice === "mobile") {
      // 모바일 · 진짜 모바일 뷰포트로 보려면 iframe으로 폭 강제 필요
      // → shop의 /mobile-preview 페이지에 iframe으로 감싸서 정확한 모바일 렌더
      const params = new URLSearchParams({
        c: encoded,
        path: targetPath,
      });
      if (forceLangKo) params.set("forceLang", "ko");
      window.open(`${getShopUrl()}/mobile-preview?${params.toString()}`, "_blank", "noopener");
    } else {
      // PC · 그냥 매장 열기
      const params = new URLSearchParams({
        preview: "draft",
        device: "desktop",
        c: encoded,
      });
      if (forceLangKo) params.set("forceLang", "ko");
      window.open(`${getShopUrl()}${targetPath}?${params.toString()}`, "_blank", "noopener");
    }
  };

  return (
    <div className="p-6 max-w-[1800px] mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎨 화면 꾸미기</h1>
          <p className="text-sm text-gray-500 mt-1">
            상품과 메뉴의 크기, 간격, 표시 방법을 직접 꾸밀 수 있어요.
          </p>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <DraftSaveButton
              onSave={manualSave}
              lastSavedAt={lastSavedAt}
              savedTick={savedTick}
            />
            <DraftListButton pageKey={PAGE_KEY} onLoad={loadDraftData} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => { setShowPresetsModal(true); loadPresets(); }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-[var(--color-brand-dk)] bg-white border-2 border-[var(--color-brand)] rounded-full hover:bg-[var(--color-brand)]/10 shadow-sm transition"
            title="이전에 저장해둔 매장 화면들을 모아봅니다"
          >
            📚 저장한 화면 불러오기
          </button>
          <Link href="/customize/trash" className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">
            🗑 휴지통
          </Link>
        </div>
      </div>

      {/* 활성 정보 · 실제 매장에 반영된 값 · 편집 값과 다를 수 있음 명시 */}
      {active && (() => {
        // 활성 프리셋 config가 소스 기본값과 실제로 같은지 판정 · name과 무관
        const isReallyDefault = JSON.stringify(originalConfig) === JSON.stringify(mergeWithDefaults(DEFAULT_CONFIG));
        const shownLabel = isReallyDefault ? "처음 설정 화면 (아직 저장 안 함)" : active.name;
        return (
          <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-2">
            <div className="text-sm text-emerald-800 flex items-center gap-2 flex-wrap">
              <span>🟢 현재 적용된 화면:</span>
              <b>{shownLabel}</b>
              {dirty && <span className="text-[10px] px-2 py-0.5 bg-amber-500 text-white rounded-full font-semibold animate-pulse">꾸미는 중 · 저장 안 함</span>}
            </div>
            <div className="text-[11px] text-emerald-700">
              마지막 변경: <span className="font-mono">{new Date(active.updated_at).toLocaleString("ko-KR")}</span>
            </div>
          </div>
        );
      })()}

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
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">📝 꾸밀 화면을 선택해주세요</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => setPreviewPage("mainTop")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewPage === "mainTop" ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎁</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">메인</p>
                        <p className="text-[10px] text-gray-500">메인 배너 · 상단바 · 하단바 · 문구띠</p>
                      </div>
                      {previewPage === "mainTop" && <span className="ml-auto text-[10px] font-semibold text-[var(--color-brand-dk)]">● 꾸미는 중</span>}
                    </div>
                  </button>
                  <button
                    onClick={() => setPreviewPage("list")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewPage === "list" ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🛍</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">상품 목록</p>
                        <p className="text-[10px] text-gray-500">상품을 둘러보는 화면</p>
                      </div>
                      {previewPage === "list" && <span className="ml-auto text-[10px] font-semibold text-[var(--color-brand-dk)]">● 꾸미는 중</span>}
                    </div>
                  </button>
                  <button
                    onClick={() => setPreviewPage("detail")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewPage === "detail" ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 shadow-sm" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">📦</span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-gray-900">상품 상세</p>
                        <p className="text-[10px] text-gray-500">상품을 눌렀을 때 보이는 화면</p>
                      </div>
                      {previewPage === "detail" && <span className="ml-auto text-[10px] font-semibold text-[var(--color-brand-dk)]">● 꾸미는 중</span>}
                    </div>
                  </button>
                </div>
              </div>
              {/* 우측 · 어느 기기 미리보기 · PC/모바일 */}
              <div className="p-3">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 pl-1">👁 미리보기 화면</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    className={`px-3 py-3 rounded-lg border-2 transition text-left ${previewDevice === "desktop" ? "border-gray-900 bg-gray-900 text-white shadow" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🖥</span>
                      <div>
                        <p className="text-sm font-bold">PC</p>
                        <p className={`text-[10px] ${previewDevice === "desktop" ? "text-gray-300" : "text-gray-500"}`}>PC 화면</p>
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
                        <p className={`text-[10px] ${previewDevice === "mobile" ? "text-gray-300" : "text-gray-500"}`}>모바일 화면</p>
                      </div>
                    </div>
                  </button>
                </div>
                {/* PC ↔ 모바일 링크 토글 · 사장님 친화 큰 토글 스위치 (상품관리 스타일 참고) */}
                <button
                  type="button"
                  onClick={toggleLink}
                  className={`mt-2 w-full p-3 rounded-xl border-2 transition text-left shadow-sm hover:shadow-md ${
                    config.linkMobileToDesktop
                      ? "bg-emerald-50 border-emerald-400 hover:bg-emerald-100"
                      : "bg-amber-50 border-amber-400 hover:bg-amber-100 ring-2 ring-amber-200 animate-pulse-slow"
                  }`}
                  title="PC와 모바일 값을 함께 조정할지 · 따로 조정할지"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl leading-none">{config.linkMobileToDesktop ? "🔗" : "🔓"}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${config.linkMobileToDesktop ? "text-emerald-800" : "text-amber-900"}`}>
                        {config.linkMobileToDesktop ? "PC · 모바일 함께 설정" : "⚡ PC · 모바일 따로 설정 중"}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${config.linkMobileToDesktop ? "text-emerald-700" : "text-amber-800"}`}>
                        {config.linkMobileToDesktop
                          ? "PC에서 설정하면 모바일 화면에 맞게 자동으로 조정돼요."
                          : "노란색으로 표시된 「📱 모바일」 필드를 별도로 조절해주세요."}
                      </p>
                    </div>
                    {/* 토글 스위치 UI (iOS 스타일) */}
                    <div className={`w-12 h-7 rounded-full relative transition flex-shrink-0 ${config.linkMobileToDesktop ? "bg-emerald-500" : "bg-amber-500"}`}>
                      <div className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow-md transition-all ${config.linkMobileToDesktop ? "left-[calc(100%-1.625rem)]" : "left-0.5"}`}></div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* 좌: 편집 폼 (해당 화면 관련 섹션만) · 우: 실시간 미리보기 */}
          {/* 편집 모드 전환 · 사장님 요구 (양쪽 편집 ↔ 큰 미리보기 전환) */}
          <div className="flex items-center justify-end mb-3 gap-1.5">
            <span className="text-[11px] text-gray-500 font-medium mr-1">편집 방식:</span>
            <button
              type="button"
              onClick={() => setEditorMode("split")}
              className={`px-3 py-1.5 text-xs rounded-lg border-2 transition font-semibold ${
                editorMode === "split"
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand-dk)]"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              title="좌측 설정 폼 + 우측 실시간 미리보기 (기본)"
            >
              📋 양쪽 편집
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("preview")}
              className={`px-3 py-1.5 text-xs rounded-lg border-2 transition font-semibold ${
                editorMode === "preview"
                  ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 text-[var(--color-brand-dk)]"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
              title="미리보기가 큰 화면 · 좌측 설정은 접힘 (아이콘 클릭 시 펼침)"
            >
              🔍 큰 미리보기
            </button>
          </div>
          <div className={`grid grid-cols-1 gap-6 transition-all ${
            editorMode === "split"
              ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              : "lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]"
          }`}>
            {/* 편집 폼 · 선택된 화면에 해당하는 섹션만 노출 */}
            <div className={`space-y-4 ${editorMode === "preview" ? "lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:pr-2" : ""}`}>
              {previewPage === "mainTop" && (
                <>
                  {/* ─── 2뎁스 · 세부 영역 선택 · 사장님 요구 (스포트라이트 UX) ─── */}
                  <div className="bg-white rounded-2xl border-2 border-[var(--color-brand)]/30 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-[var(--color-brand)]/5 to-transparent">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🎯</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">메인 화면 · 세부 영역 선택</h3>
                          <p className="text-[11px] text-gray-500">고칠 영역을 고르면 · 미리보기에서 그 부분만 밝게 표시돼요</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { key: "promoBar" as MainSection, icon: "📣", label: "맨 위 문구띠", desc: "슬라이드 안내 문구" },
                          { key: "header" as MainSection, icon: "🏷", label: "상단바", desc: "로고 · 메뉴" },
                          { key: "hero" as MainSection, icon: "🖼", label: "메인 배너", desc: "큰 사진 · 공지" },
                          { key: "benefits" as MainSection, icon: "🎁", label: "혜택 안내", desc: "배송비 무료 등" },
                          { key: "categories" as MainSection, icon: "🗂", label: "카테고리 메뉴", desc: "상품 분류 탭" },
                          { key: "footer" as MainSection, icon: "📄", label: "하단바", desc: "회사 정보 · 문의" },
                        ].map((s) => (
                          <button
                            key={s.key}
                            onClick={() => setMainSection(s.key)}
                            className={`px-2 py-2 rounded-lg border-2 transition text-left ${
                              mainSection === s.key
                                ? "border-[var(--color-brand)] bg-[var(--color-brand)]/10 shadow-sm"
                                : "border-gray-200 bg-white hover:bg-gray-50"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-base">{s.icon}</span>
                              <div className="flex-1 min-w-0">
                                <p className={`text-xs font-bold ${mainSection === s.key ? "text-[var(--color-brand-dk)]" : "text-gray-900"} truncate`}>{s.label}</p>
                                <p className="text-[9px] text-gray-500 truncate">{s.desc}</p>
                              </div>
                              {mainSection === s.key && <span className="text-[9px] text-[var(--color-brand-dk)] font-semibold">●</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {mainSection === "promoBar" && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📢</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">최상단 프로모 슬림바</h3>
                          <p className="text-[11px] text-gray-500">여러 개 문구가 슬라이드로 반복 노출돼요</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={config.mainTop.promoBarEnabled}
                          onChange={(e) => updateField("mainTop", "promoBarEnabled", e.target.checked)}
                          className="w-4 h-4 accent-[var(--color-brand)]"
                        />
                        <span className="text-sm text-gray-700 font-medium">슬림바 표시</span>
                      </label>
                      {config.mainTop.promoBarEnabled && (
                        <div>
                          <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                            <span className="text-lg leading-none">🌐</span>
                            <div className="flex-1">
                              <p className="text-[11px] font-bold text-amber-900">한국어로만 입력해주세요 · 저장 시 일본어는 자동으로 번역돼요</p>
                              <p className="text-[10px] text-amber-700 mt-0.5">한국어 손님에게는 한국어로 · 일본어 손님에게는 번역된 문구로 자동 노출됩니다.</p>
                            </div>
                          </div>
                          <p className="text-xs text-gray-500 mb-2">프로모 문구 · {config.mainTop.promoBarMessages.length}개</p>
                          <div className="space-y-1.5">
                            {config.mainTop.promoBarMessages.map((msg, i) => (
                              <div key={i}>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={msg.ko}
                                    onChange={(e) => {
                                      const next = [...config.mainTop.promoBarMessages];
                                      next[i] = { ko: e.target.value, ja: msg.ja };
                                      updateField("mainTop", "promoBarMessages", next);
                                    }}
                                    placeholder="한국어로 입력 (예: 2만엔 이상 구매 시 배송비 무료)"
                                    className="flex-1 px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                  />
                                  <button
                                    onClick={() => {
                                      const next = config.mainTop.promoBarMessages.filter((_, idx) => idx !== i);
                                      updateField("mainTop", "promoBarMessages", next);
                                    }}
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                                    title="이 문구 삭제"
                                  >
                                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" /></svg>
                                  </button>
                                </div>
                                {msg.ko && msg.ko.trim() && (msg.ja && msg.ja !== msg.ko ? (
                                  <p className="text-[10px] text-blue-600 pl-1 mt-1 flex items-center gap-1">
                                    <span className="inline-block px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-bold">🇯🇵 번역됨</span>
                                    <span className="text-gray-600">{msg.ja}</span>
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-gray-400 pl-1 mt-1 italic">💾 저장하면 일본어로 자동 번역됩니다</p>
                                ))}
                              </div>
                            ))}
                            <button
                              onClick={() => updateField("mainTop", "promoBarMessages", [...config.mainTop.promoBarMessages, { ko: "", ja: "" }])}
                              className="w-full mt-1 py-2 text-xs border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)]"
                            >
                              + 문구 추가
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  )}

                  {mainSection === "hero" && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🖼</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">메인 배너 · 공지 문구</h3>
                          <p className="text-[11px] text-gray-500">메인 큰 배너 안 · 제목 · 본문 · 하단 인사말 · 글자 선택 → 굵게/색상</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                        <span className="text-lg leading-none">🌐</span>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-amber-900">한국어로만 입력 · 저장 시 일본어 자동 번역</p>
                          <p className="text-[10px] text-amber-700 mt-0.5">글자를 <b>드래그로 선택</b> 하고 툴바의 <b>B (굵게)</b> · <b>색상</b> 버튼을 누르면 그 부분에만 서식이 적용돼요.</p>
                        </div>
                      </div>
                      {[
                        { key: "title", label: "제목 (큰 글씨)", placeholder: "예) 온라인 가격 정책 변경 안내", multi: false },
                        { key: "body", label: "본문 (안내 문구)", placeholder: "예) 2만엔 이상 구매 시 배송비 무료로 제공합니다.", multi: true },
                        { key: "footer", label: "하단 인사말", placeholder: "예) 항상 감사합니다.", multi: false },
                      ].map((f) => {
                        const v = config.mainTop.hero[f.key as "title" | "body" | "footer"];
                        return (
                          <div key={f.key}>
                            <label className="text-[11px] font-semibold text-gray-700 mb-1 block">{f.label}</label>
                            <InlineFormatInput
                              value={v.ko}
                              onChange={(nv) => {
                                const nextHero = { ...config.mainTop.hero, [f.key]: { ko: nv, ja: v.ja } };
                                updateField("mainTop", "hero", nextHero);
                              }}
                              placeholder={f.placeholder}
                              multi={f.multi}
                              rows={3}
                            />
                            {v.ko && v.ko.trim() && (v.ja && v.ja !== v.ko ? (
                              <p className="text-[10px] text-blue-600 pl-1 mt-1 flex items-start gap-1">
                                <span className="inline-block px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-bold shrink-0">🇯🇵 번역됨</span>
                                <span className="text-gray-600 line-clamp-2">{v.ja}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-gray-400 pl-1 mt-1 italic">💾 저장하면 일본어로 자동 번역됩니다</p>
                            ))}
                          </div>
                        );
                      })}

                      {/* ─── 텍스트 박스 배경 · 패널 전체 설정 · 여기는 인라인 아님 ─── */}
                      <div className="pt-3 mt-3 border-t border-gray-200">
                        <p className="text-[11px] font-bold text-gray-700 mb-2">📦 텍스트 박스 배경 (히어로 안 반투명 카드)</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                          <div>
                            <label className="text-[10px] text-gray-600 block mb-0.5">배경색</label>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="color"
                                value={config.mainTop.hero.boxBgColor || "#FAF7F0"}
                                onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxBgColor: e.target.value })}
                                className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                              />
                              <input
                                type="text"
                                value={config.mainTop.hero.boxBgColor}
                                onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxBgColor: e.target.value })}
                                placeholder="#FAF7F0"
                                className="flex-1 px-1.5 py-1 text-[11px] font-mono border border-gray-200 rounded"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-600 flex items-center justify-between mb-0.5">
                              <span>투명도</span>
                              <span className="text-[10px] font-mono text-gray-500">{config.mainTop.hero.boxBgOpacity}%</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={config.mainTop.hero.boxBgOpacity}
                              onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxBgOpacity: Number(e.target.value) })}
                              className="w-full h-8 accent-[var(--color-brand)]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-600 flex items-center justify-between mb-0.5">
                              <span>최대 너비</span>
                              <span className="text-[10px] font-mono text-gray-500">{config.mainTop.hero.boxMaxWidth}px</span>
                            </label>
                            <input
                              type="range"
                              min={320}
                              max={1280}
                              step={10}
                              value={config.mainTop.hero.boxMaxWidth}
                              onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxMaxWidth: Number(e.target.value) })}
                              className="w-full h-8 accent-[var(--color-brand)]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-600 flex items-center justify-between mb-0.5">
                              <span>안쪽 여백</span>
                              <span className="text-[10px] font-mono text-gray-500">{config.mainTop.hero.boxPadding}px</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={2}
                              value={config.mainTop.hero.boxPadding}
                              onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxPadding: Number(e.target.value) })}
                              className="w-full h-8 accent-[var(--color-brand)]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-gray-600 flex items-center justify-between mb-0.5">
                              <span>모서리 둥글기</span>
                              <span className="text-[10px] font-mono text-gray-500">{config.mainTop.hero.boxRadius}px</span>
                            </label>
                            <input
                              type="range"
                              min={0}
                              max={48}
                              step={1}
                              value={config.mainTop.hero.boxRadius}
                              onChange={(e) => updateField("mainTop", "hero", { ...config.mainTop.hero, boxRadius: Number(e.target.value) })}
                              className="w-full h-8 accent-[var(--color-brand)]"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ─── 배경 이미지 · 레이아웃 + 이미지 슬롯 ─── */}
                      <div className="pt-3 mt-3 border-t border-gray-200">
                        <p className="text-[11px] font-bold text-gray-700 mb-2">🖼 배경 이미지 · 레이아웃 (자유 배치)</p>
                        {/* 레이아웃 프리셋 */}
                        <div className="mb-3">
                          <label className="text-[10px] text-gray-600 block mb-1">배치 방식</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { key: "single", label: "단일 (1장)", slots: 1 },
                              { key: "hero-2col", label: "1+2 (좌 큰 · 우 2)", slots: 3 },
                              { key: "hero-3col", label: "1+3 (좌 큰 · 우 3)", slots: 4 },
                              { key: "grid-2x2", label: "2×2 (4장)", slots: 4 },
                              { key: "mosaic-5", label: "모자이크 (5장)", slots: 5 },
                              { key: "carousel", label: "슬라이드 (N장)", slots: null },
                            ].map((p) => (
                              <button
                                key={p.key}
                                type="button"
                                onClick={() => {
                                  const nextLayout = p.key as typeof config.mainTop.hero.layout;
                                  const cur = config.mainTop.hero.images;
                                  let nextImages = cur;
                                  if (p.slots !== null && cur.length !== p.slots) {
                                    // 슬롯 개수 맞추기 · 부족하면 빈 슬롯 추가 · 넘치면 자르지 않고 그대로 (사장님이 삭제)
                                    if (cur.length < p.slots) {
                                      nextImages = [...cur, ...Array.from({ length: p.slots - cur.length }, () => ({ url: "", alt: "", link: "", fit: "cover" as const }))];
                                    }
                                  }
                                  updateField("mainTop", "hero", { ...config.mainTop.hero, layout: nextLayout, images: nextImages });
                                }}
                                className={`px-2 py-2 text-[11px] rounded-lg border-2 transition text-left ${
                                  config.mainTop.hero.layout === p.key
                                    ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 font-bold text-[var(--color-brand-dk)]"
                                    : "border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                                }`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1.5">💡 프리셋 선택 후 · 아래에서 이미지 URL/링크/alt 각각 설정</p>
                        </div>
                        {/* 이미지 슬롯 리스트 */}
                        <div className="space-y-2">
                          {config.mainTop.hero.images.map((im, i) => (
                            <div key={i} className="p-2.5 border border-gray-200 rounded-lg bg-gray-50/50">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-semibold text-gray-700">사진 #{i + 1}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (i === 0) return;
                                      const next = [...config.mainTop.hero.images];
                                      [next[i - 1], next[i]] = [next[i], next[i - 1]];
                                      updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                    }}
                                    disabled={i === 0}
                                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    title="위로"
                                  >▲</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (i === config.mainTop.hero.images.length - 1) return;
                                      const next = [...config.mainTop.hero.images];
                                      [next[i], next[i + 1]] = [next[i + 1], next[i]];
                                      updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                    }}
                                    disabled={i === config.mainTop.hero.images.length - 1}
                                    className="p-0.5 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    title="아래로"
                                  >▼</button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = config.mainTop.hero.images.filter((_, idx) => idx !== i);
                                      updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                    }}
                                    className="p-0.5 text-red-500 hover:bg-red-50 rounded"
                                    title="이 사진 삭제"
                                  >
                                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" /></svg>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[9px] text-gray-500 block">이미지 URL</label>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={im.url}
                                      onChange={(e) => {
                                        const next = [...config.mainTop.hero.images];
                                        next[i] = { ...im, url: e.target.value };
                                        updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                      }}
                                      placeholder="/hero-bg.png 또는 https://..."
                                      className="flex-1 px-2 py-1 text-[11px] border border-gray-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                    />
                                    <label className="cursor-pointer px-2 py-1 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100" title="파일 업로드 (Supabase Storage)">
                                      📷
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="sr-only"
                                        onChange={async (e) => {
                                          const file = e.target.files?.[0];
                                          if (!file) return;
                                          const path = `hero/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
                                          const { error: upErr } = await supabase.storage.from("public-images").upload(path, file, { upsert: false });
                                          if (upErr) { alert("업로드 실패: " + upErr.message); e.target.value = ""; return; }
                                          const { data } = supabase.storage.from("public-images").getPublicUrl(path);
                                          const next = [...config.mainTop.hero.images];
                                          next[i] = { ...im, url: data.publicUrl };
                                          updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 block">클릭 시 이동할 링크</label>
                                  <input
                                    type="text"
                                    value={im.link}
                                    onChange={(e) => {
                                      const next = [...config.mainTop.hero.images];
                                      next[i] = { ...im, link: e.target.value };
                                      updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                    }}
                                    placeholder="/?cat=bag · 빈 값이면 링크 없음"
                                    className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded font-mono focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 block">alt 텍스트 (스크린리더 · SEO)</label>
                                  <input
                                    type="text"
                                    value={im.alt}
                                    onChange={(e) => {
                                      const next = [...config.mainTop.hero.images];
                                      next[i] = { ...im, alt: e.target.value };
                                      updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                    }}
                                    placeholder="예: 크림 컬렉션 대표 이미지"
                                    className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)]"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-gray-500 block">비율 처리 (fit)</label>
                                  <div className="flex items-center gap-1">
                                    {(["cover", "contain"] as const).map((f) => (
                                      <button
                                        key={f}
                                        type="button"
                                        onClick={() => {
                                          const next = [...config.mainTop.hero.images];
                                          next[i] = { ...im, fit: f };
                                          updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                                        }}
                                        className={`flex-1 px-2 py-1 text-[10px] rounded border ${im.fit === f ? "border-[var(--color-brand)] bg-[var(--color-brand)]/8 text-[var(--color-brand-dk)] font-bold" : "border-gray-200 bg-white text-gray-600"}`}
                                      >
                                        {f === "cover" ? "꽉 채움" : "비율 유지"}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              {im.url && (
                                <div className="mt-1.5 flex items-center gap-1.5">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={im.url} alt={im.alt || `preview ${i + 1}`} className="w-14 h-14 object-cover rounded border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                  <span className="text-[9px] text-gray-400 truncate flex-1">{im.url}</span>
                                </div>
                              )}
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...config.mainTop.hero.images, { url: "", alt: "", link: "", fit: "cover" as const }];
                              updateField("mainTop", "hero", { ...config.mainTop.hero, images: next });
                            }}
                            className="w-full py-2 text-xs border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)]"
                          >
                            + 사진 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  {mainSection === "benefits" && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎁</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">혜택 강조 배너</h3>
                          <p className="text-[11px] text-gray-500">히어로 아래 · 아이콘 옆 짧은 문구 (예: 배송비 무료)</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                        <span className="text-lg leading-none">🌐</span>
                        <p className="text-[11px] font-bold text-amber-900">한국어 · 영문 서브 라벨 입력 · 일본어는 자동 번역</p>
                      </div>
                      {config.mainTop.benefits.map((b, i) => (
                        <div key={i} className="p-3 border border-gray-200 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-gray-700">혜택 #{i + 1}</span>
                            <button
                              onClick={() => {
                                const next = config.mainTop.benefits.filter((_, idx) => idx !== i);
                                updateField("mainTop", "benefits", next);
                              }}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title="이 혜택 삭제"
                            >
                              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M6 18L18 6" /></svg>
                            </button>
                          </div>
                          <InlineFormatInput
                            value={b.ko}
                            onChange={(nv) => {
                              const next = [...config.mainTop.benefits];
                              next[i] = { ...b, ko: nv };
                              updateField("mainTop", "benefits", next);
                            }}
                            placeholder="한국어 라벨 (예: 배송비 무료)"
                          />
                          <input
                            type="text"
                            value={b.en}
                            onChange={(e) => {
                              const next = [...config.mainTop.benefits];
                              next[i] = { ...b, en: e.target.value };
                              updateField("mainTop", "benefits", next);
                            }}
                            placeholder="영문 서브 라벨 (예: FREE SHIPPING)"
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-brand)] uppercase tracking-widest"
                          />
                          {b.ko && b.ko.trim() && (b.ja && b.ja !== b.ko ? (
                            <p className="text-[10px] text-blue-600 flex items-center gap-1">
                              <span className="inline-block px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-bold">🇯🇵 번역됨</span>
                              <span className="text-gray-600">{b.ja}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-gray-400 italic">💾 저장하면 일본어로 자동 번역됩니다</p>
                          ))}
                        </div>
                      ))}
                      <button
                        onClick={() => updateField("mainTop", "benefits", [...config.mainTop.benefits, { ko: "", ja: "", en: "" }])}
                        className="w-full py-2 text-xs border-2 border-dashed border-gray-300 rounded text-gray-500 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)]"
                      >
                        + 혜택 추가
                      </button>
                    </div>
                  </div>
                  )}

                  {mainSection === "header" && (
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🅲</span>
                        <div>
                          <h3 className="text-sm font-bold text-gray-900">상단바 · 로고 & 브랜드</h3>
                          <p className="text-[11px] text-gray-500">상단 로고 · 브랜드 워드마크 + 짧은 태그라인 (메뉴는 카테고리 관리에서)</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 mb-1 block">브랜드 워드마크 (영문 · 언어 관계 없이 고정)</label>
                        <InlineFormatInput
                          value={config.mainTop.logo.brand}
                          onChange={(nv) => updateField("mainTop", "logo", { ...config.mainTop.logo, brand: nv })}
                          placeholder="예) CREAM"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-700 mb-1 block">태그라인 (한국어) · 저장 시 일본어 자동 번역</label>
                        <InlineFormatInput
                          value={config.mainTop.logo.tagline.ko}
                          onChange={(nv) => updateField("mainTop", "logo", { ...config.mainTop.logo, tagline: { ko: nv, ja: config.mainTop.logo.tagline.ja } })}
                          placeholder="예) 작은 행복"
                        />
                        {config.mainTop.logo.tagline.ko && config.mainTop.logo.tagline.ko.trim() && (
                          config.mainTop.logo.tagline.ja && config.mainTop.logo.tagline.ja !== config.mainTop.logo.tagline.ko ? (
                            <p className="text-[10px] text-blue-600 pl-1 mt-1 flex items-center gap-1">
                              <span className="inline-block px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[9px] font-bold">🇯🇵 번역됨</span>
                              <span className="text-gray-600">{config.mainTop.logo.tagline.ja}</span>
                            </p>
                          ) : (
                            <p className="text-[10px] text-gray-400 pl-1 mt-1 italic">💾 저장하면 일본어로 자동 번역됩니다</p>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {mainSection === "categories" && (() => {
                    // 사장님 지시 · 카테고리 메뉴 편집 카드에서 · categoryTabs 크기/개수 필드를 직접 조절 가능하게
                    // (예전엔 「상품 목록」 편집으로 이동 안내만 있었음 · 이제 여기서 편집 · 한 곳에서만)
                    const categorySec = SHOP_UI_SCHEMA.find((s) => s.key === "categoryTabs");
                    return (
                      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">🗂</span>
                            <div>
                              <h3 className="text-sm font-bold text-gray-900">카테고리 탭</h3>
                              <p className="text-[11px] text-gray-500">상단 메뉴 · 여기서 개수/줄 수를 직접 조절해요</p>
                            </div>
                          </div>
                        </div>
                        {/* 크기/개수 필드 · categoryTabs 섹션의 FieldControl들 */}
                        {categorySec && (
                          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {categorySec.fields
                              .filter((f) => {
                                if (f.hidden && config.linkMobileToDesktop) return false;
                                return true;
                              })
                              .map((field) => {
                                const isMobileOnly = field.key === "columnsMobile" && !config.linkMobileToDesktop;
                                return (
                                  <div key={field.key} className={isMobileOnly ? "p-2 -m-2 rounded-lg bg-amber-50 border border-amber-200 shadow-sm" : ""}>
                                    <FieldControl
                                      field={field}
                                      value={(config.categoryTabs as unknown as Record<string, unknown>)[field.key]}
                                      onChange={(v) => updateField("categoryTabs", field.key, v)}
                                    />
                                    {isMobileOnly && (
                                      <p className="text-[10px] text-amber-800 font-semibold mt-1 flex items-center gap-1">
                                        <span>⚡</span>
                                        <span>이 값은 모바일에서만 적용돼요 · PC는 위에서 별도로</span>
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        )}
                        {/* 카테고리 이름·아이콘·순서 관리 안내 · 별도 얘기 · 유지 */}
                        <div className="p-3 text-[11px] text-gray-600 bg-amber-50 border-t border-amber-200 rounded-b-2xl">
                          💡 카테고리 이름·아이콘·순서 관리는 <a href="/categories" className="underline text-[var(--color-brand-dk)] font-semibold">카테고리 관리</a>에서.
                        </div>
                      </div>
                    );
                  })()}

                  {mainSection === "footer" && (
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">🦶</span>
                          <div>
                            <h3 className="text-sm font-bold text-gray-900">하단바 · 회사 정보</h3>
                            <p className="text-[11px] text-gray-500">회사 소개 · 운영시간 · 사업자 정보 (라벨은 고정 · 값만 편집)</p>
                          </div>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* 안내 · 자동 번역 없이 각 언어별 직접 입력 */}
                        <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 flex items-start gap-2">
                          <span className="text-lg leading-none">🌐</span>
                          <div className="flex-1">
                            <p className="text-[11px] font-bold text-sky-900">한/일 각각 직접 입력</p>
                            <p className="text-[10px] text-sky-700 mt-0.5">회사 소개 · 운영시간 · 휴무 안내는 · <b>일본어와 한국어를 각각 직접 입력</b> 해주세요 (자동 번역 없음).</p>
                          </div>
                        </div>

                        {/* ─── 1) 회사 소개 문구 ─── */}
                        <div className="pt-1">
                          <p className="text-[11px] font-bold text-gray-700 mb-2">📄 회사 소개 (메인 컬럼)</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇯🇵 일본어</label>
                              <textarea
                                value={config.footer.aboutJa}
                                onChange={(e) => updateField("footer", "aboutJa", e.target.value)}
                                rows={3}
                                placeholder="例) 東京から、ときめくアイテムを&#10;あなたへお届けします。"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)] resize-y"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇰🇷 한국어</label>
                              <textarea
                                value={config.footer.aboutKo}
                                onChange={(e) => updateField("footer", "aboutKo", e.target.value)}
                                rows={3}
                                placeholder="예) 도쿄에서, 두근거리는 아이템을&#10;당신에게 전달합니다."
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)] resize-y"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1">💡 엔터로 줄바꿈 가능 · shop에 그대로 반영됩니다.</p>
                        </div>

                        {/* ─── 2) 운영시간 ─── */}
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-[11px] font-bold text-gray-700 mb-2">🕒 운영시간 (CONTACT 컬럼)</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇯🇵 일본어</label>
                              <input
                                type="text"
                                value={config.footer.hoursJa}
                                onChange={(e) => updateField("footer", "hoursJa", e.target.value)}
                                placeholder="例) 月〜金 10:00 - 18:00"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇰🇷 한국어</label>
                              <input
                                type="text"
                                value={config.footer.hoursKo}
                                onChange={(e) => updateField("footer", "hoursKo", e.target.value)}
                                placeholder="예) 월-금 10:00 - 18:00"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* ─── 3) 휴무 안내 ─── */}
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-[11px] font-bold text-gray-700 mb-2">🚫 휴무 안내 (운영시간 아래 작은 글씨)</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇯🇵 일본어</label>
                              <input
                                type="text"
                                value={config.footer.closedJa}
                                onChange={(e) => updateField("footer", "closedJa", e.target.value)}
                                placeholder="例) 土日祝 定休"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">🇰🇷 한국어</label>
                              <input
                                type="text"
                                value={config.footer.closedKo}
                                onChange={(e) => updateField("footer", "closedKo", e.target.value)}
                                placeholder="예) 주말·공휴일 정기휴무"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                          </div>
                        </div>

                        {/* ─── 4) 사업자 정보 (라벨 고정 · 값만 편집) ─── */}
                        <div className="pt-3 border-t border-gray-200">
                          <p className="text-[11px] font-bold text-gray-700 mb-2">🏢 사업자 정보 (하단 · 라벨 고정 · 값만 편집)</p>
                          <div className="space-y-2">
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">대표자명 (CEO)</label>
                              <input
                                type="text"
                                value={config.footer.ceo}
                                onChange={(e) => updateField("footer", "ceo", e.target.value)}
                                placeholder="예) 홍길동 (비어있으면 「―」 로 표시)"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">사업자등록번호</label>
                              <input
                                type="text"
                                value={config.footer.bizNo}
                                onChange={(e) => updateField("footer", "bizNo", e.target.value)}
                                placeholder="예) 123-45-67890 (비어있으면 「―」 로 표시)"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                            <div>
                              <label className="text-[11px] font-semibold text-gray-700 mb-1 block">주소</label>
                              <input
                                type="text"
                                value={config.footer.address}
                                onChange={(e) => updateField("footer", "address", e.target.value)}
                                placeholder="예) 東京都渋谷区... (비어있으면 「―」 로 표시)"
                                className="w-full px-2 py-1.5 text-[12px] border border-gray-200 rounded-lg focus:outline-none focus:border-[var(--color-brand)]"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-1.5">💡 저작권 문구는 언어 파일(t)에서 관리됩니다 · 여기서 편집 안 됩니다.</p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              {SHOP_UI_SCHEMA
                .filter((sec) => {
                  // 상품 목록 화면 편집 중 → productList + pagination 만 (categoryTabs 는 메인/카테고리 편집으로 이동 · 사장님 지시)
                  // 상품 상세 화면 편집 중 → productDetail 만
                  // 메인 상단 편집 중 → 세부 영역별 렌더 (mainTop 위쪽) · categoryTabs 는 mainSection === "categories" 에서 직접 편집
                  if (previewPage === "mainTop") return false;
                  if (previewPage === "list") return sec.key === "productList" || sec.key === "pagination";
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
                      .map((field) => {
                        // 「따로 설정」 상태 · 모바일 전용 필드는 앰버 강조 (시각 인지)
                        const isMobileOnly = field.key === "columnsMobile" && !config.linkMobileToDesktop;
                        return (
                          <div key={field.key} className={isMobileOnly ? "p-2 -m-2 rounded-lg bg-amber-50 border border-amber-200 shadow-sm" : ""}>
                            <FieldControl
                              field={field}
                              value={(config[sec.key as keyof ShopUiConfig] as Record<string, unknown>)[field.key]}
                              onChange={(v) => updateField(sec.key, field.key, v)}
                            />
                            {isMobileOnly && (
                              <p className="text-[10px] text-amber-800 font-semibold mt-1 flex items-center gap-1">
                                <span>⚡</span>
                                <span>이 값은 모바일에서만 적용돼요 · PC는 위에서 별도로</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))}
            </div>

            {/* 우 · 실시간 미리보기 · sticky · 선택된 화면 렌더 */}
            <div className="hidden lg:block">
              <div className="sticky top-6 space-y-3">
                <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-3 py-2">
                  <div className="text-xs font-semibold text-gray-700">
                    🔴 {previewPage === "mainTop" ? "메인" : previewPage === "list" ? "상품 목록" : "상품 상세"} 미리보기 · {previewDevice === "desktop" ? "PC" : "모바일"}
                  </div>
                  <div className="text-[10px] text-gray-400">위에서 화면 선택</div>
                </div>
                <ShopPreview
                  config={config}
                  device={previewDevice}
                  page={previewPage}
                  sampleProductId={sampleProductId}
                />
              </div>
            </div>
          </div>

          <FormActionBar
            hideCancel
            status={(() => {
              if (msg) return <span className="text-emerald-700 font-medium">{msg}</span>;
              if (!dirty) return <span>변경사항 없음</span>;
              // 화면별 실제 dirty 여부 · 메인/상품 목록/상품 상세 각각 판정
              // categoryTabs 편집은 「메인」 뷰 안으로 이동됐으므로 mainTopDirty 에 포함 (사장님 지시)
              const mainTopDirty =
                JSON.stringify(config.mainTop) !== JSON.stringify(originalConfig.mainTop) ||
                JSON.stringify(config.categoryTabs) !== JSON.stringify(originalConfig.categoryTabs) ||
                JSON.stringify(config.footer) !== JSON.stringify(originalConfig.footer);
              const listDirty =
                JSON.stringify(config.productList) !== JSON.stringify(originalConfig.productList) ||
                JSON.stringify(config.pagination) !== JSON.stringify(originalConfig.pagination);
              const detailDirty =
                JSON.stringify(config.productDetail) !== JSON.stringify(originalConfig.productDetail);
              return (
                <span className="text-amber-700 inline-flex items-center gap-2 flex-wrap">
                  🔸 저장하지 않은 변경사항이 있어요
                  {mainTopDirty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 rounded-full text-[11px] font-medium text-amber-800">
                      📣 메인
                    </span>
                  )}
                  {listDirty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 rounded-full text-[11px] font-medium text-amber-800">
                      🛍 상품 목록
                    </span>
                  )}
                  {detailDirty && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 border border-amber-200 rounded-full text-[11px] font-medium text-amber-800">
                      📦 상품 상세
                    </span>
                  )}
                </span>
              );
            })()}
            secondary={[
              { label: "⏱ 현재 적용된 화면으로 돌아가기", onClick: restoreLastLive, disabled: !dirty },
              { label: "↺ 기본값으로 되돌리기", onClick: resetToDefault },
              { label: "👁 미리보기 (새 탭)", onClick: openPreview },
              { label: "💾 다른 이름으로 저장", onClick: () => setShowSaveAs(true), disabled: saving },
              { label: "📦 모든 화면 저장", onClick: saveAll, disabled: saving || !dirty },
            ]}
            primary={{
              label: saving ? "저장 중..." : "✓ 현재 화면만 저장",
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
            <h3 className="text-lg font-bold text-gray-900 mb-2">💾 다른 이름으로 저장</h3>
            <p className="text-xs text-gray-500 mb-4">
              나중에 「저장한 화면 불러오기」 목록에서 이 이름을 선택해 다시 불러올 수 있어요.
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
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 저장된 매장 화면 목록 모달 · 사장님 요청: 별도 페이지 대신 팝업 */}
      {showPresetsModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowPresetsModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">📚 저장한 화면 불러오기</h3>
                <p className="text-xs text-gray-500 mt-0.5">저장한 화면을 불러와 다시 수정할 수 있어요.</p>
              </div>
              <button onClick={() => setShowPresetsModal(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M6 18L18 6" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {presetLoading ? (
                <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
              ) : presetList.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">
                  <p>저장된 화면이 없어요</p>
                  <p className="text-[11px] mt-1">「💾 다른 이름으로 저장」을 눌러 지금 꾸민 화면을 저장해보세요.</p>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {presetList.map((r, idx) => (
                    <div key={r.id} className={`p-3 flex items-center gap-3 flex-wrap ${idx > 0 ? "border-t border-gray-100" : ""} ${r.is_active ? "bg-emerald-50/40" : ""}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                          {r.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">🟢 현재 적용 중</span>}
                          {r.is_default && <span className="text-[10px] px-1.5 py-0.5 bg-gray-500 text-white rounded-full">기본</span>}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">저장 날짜: {new Date(r.updated_at).toLocaleString("ko-KR")}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {!r.is_active && (
                          <button onClick={() => presetActivate(r)} disabled={presetBusyId === r.id} className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium disabled:opacity-40">✓ 불러오기</button>
                        )}
                        {!r.is_default && (
                          <button onClick={() => presetRename(r)} disabled={presetBusyId === r.id} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">이름 바꾸기</button>
                        )}
                        {!r.is_default && !r.is_active && (
                          <button onClick={() => presetDelete(r)} disabled={presetBusyId === r.id} className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">🗑 삭제</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-end">
              <button onClick={() => setShowPresetsModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
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
          <span>{on ? "표시" : "숨김"}</span>
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
