"use client";
// 여러 상품을 한 페이지에서 동시에 등록 (판석이형/YYS 제안)
// 각 행: 이미지 드래그&드롭 + 상품명 + 카테고리 + 가격 + 재고
// [일괄 등록] 버튼 → 각 행 순차 저장 + 성공/실패 리포트

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { translateKoJa } from "@/lib/translate";
import ImageLibraryPicker from "@/components/ImageLibraryPicker";
import FormActionBar from "@/components/FormActionBar";
import { SESSION_KEYS, loadSession, saveSession, clearSession, clearManySessions } from "@/lib/sessionPersistence";
import DraftSaveButton from "@/components/DraftSaveButton";
import { upsertDraft, listDrafts } from "@/lib/adminDrafts";

const PAGE_KEY = "bulk-new";
const PAGE_LABEL = "상품 일괄 등록";
import { downloadProductTemplate, parseXlsxToObjects } from "@/lib/xlsxTemplate";
import { parseCsvToObjects } from "@/lib/csv";

const categoriesJa = [
  "アクセサリー",
  "ヘアアクセサリー",
  "冬物アイテム",
  "キーリング",
  "メガネ／サングラス",
  "ファッション雑貨",
  "その他（ETC）",
  "➡ Premium High-Quality ✨",
];
const categoriesKo = [
  "악세사리",
  "헤어",
  "겨울상품",
  "키링",
  "안경/선글라스",
  "패션잡화",
  "기타",
  "➡ Premium High-Quality ✨",
];

interface RowOption {
  option_name: string;
  additional_price: number;
  stock: number;
  is_active: boolean;
}

interface Row {
  key: number;
  images: { file: File | null; preview: string; url?: string }[];
  nameJa: string;
  nameKo: string;
  categoryJa: string;
  subCategoryJa: string;
  price: string;
  originalPrice: string;
  stock: string;
  descriptionJa: string;
  descriptionKo: string;
  isActive: boolean;
  options: RowOption[];
  status?: "pending" | "uploading" | "ok" | "error";
  error?: string;
}

const INITIAL_ROWS = 5;

function makeRow(key: number): Row {
  return {
    key,
    images: [],
    nameJa: "",
    nameKo: "",
    categoryJa: categoriesJa[0],
    subCategoryJa: "",
    price: "",
    originalPrice: "",
    stock: "",
    descriptionJa: "",
    descriptionKo: "",
    isActive: true,
    options: [],
    status: "pending",
  };
}

// sessionStorage 저장용 · File 객체는 시리얼라이즈 불가하므로 URL/preview 값만 유지
type SerializableRow = Omit<Row, "images"> & { images: { preview: string; url?: string }[] };
function toSerializable(rows: Row[]): SerializableRow[] {
  return rows.map((r) => ({
    ...r,
    images: r.images.map(({ preview, url }) => ({ preview, url })),
  }));
}
function fromSerializable(rows: SerializableRow[]): Row[] {
  return rows.map((r) => ({
    ...r,
    images: r.images.map((i) => ({ file: null, preview: i.preview, url: i.url })),
  }));
}

export default function BulkNewProductsPage() {
  const router = useRouter();
  // 항상 fresh 5행으로 시작 · 진입 후 사용자가 「불러오기」 선택 시 복원
  const [rows, setRows] = useState<Row[]>(() => Array.from({ length: INITIAL_ROWS }, (_, i) => makeRow(i)));
  const [uploading, setUploading] = useState(false);
  const nextKeyRef = useRef(INITIAL_ROWS);
  const [dragOverKey, setDragOverKey] = useState<number | null>(null);

  // 임시저장 복원 팝업 · 메일 스타일
  const [restorePrompt, setRestorePrompt] = useState<{ rowCount: number; poolCount: number } | null>(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false); // 팝업 결정 전엔 자동저장 OFF
  useEffect(() => {
    // 마운트 시 · 임시저장 데이터 확인
    const savedRows = loadSession<SerializableRow[] | null>(SESSION_KEYS.BULK_NEW_ROWS, null);
    const savedPool = loadSession<string[]>(SESSION_KEYS.IMAGE_POOL, []);
    const hasRowContent = !!(savedRows && Array.isArray(savedRows) && savedRows.some((r) => r.nameJa || r.nameKo || r.images.length > 0 || r.price || r.descriptionJa || r.descriptionKo));
    const hasPool = savedPool.length > 0;
    if (hasRowContent || hasPool) {
      const filledRows = savedRows ? savedRows.filter((r) => r.nameJa || r.nameKo || r.images.length > 0 || r.price).length : 0;
      setRestorePrompt({ rowCount: filledRows, poolCount: savedPool.length });
    } else {
      setAutoSaveEnabled(true);
    }
  }, []);

  const doRestore = () => {
    const savedRows = loadSession<SerializableRow[] | null>(SESSION_KEYS.BULK_NEW_ROWS, null);
    if (savedRows && Array.isArray(savedRows) && savedRows.length > 0) {
      setRows(fromSerializable(savedRows));
    }
    setRestorePrompt(null);
    setAutoSaveEnabled(true);
  };
  const doDiscard = () => {
    clearManySessions([SESSION_KEYS.BULK_NEW_ROWS, SESSION_KEYS.IMAGE_POOL]);
    setSessionPool([]);
    setRestorePrompt(null);
    setAutoSaveEnabled(true);
  };

  // 마지막 「임시저장 버튼」 누른 시각 · 사장님에게 표시용
  // ⚠ 주의: 아래 sessionStorage 자동 저장 (브라우저 새로고침 대비용) 은 · 이 값에 영향을 주지 않음
  //         → 사장님이 「💾 임시 저장」 버튼을 명시적으로 눌러야만 lastSavedAt 갱신
  //         → 「저장한 목록 불러오기」에 실제 항목이 남는 것도 · 명시 저장 시에만
  //         (이전 버그: 자동저장에서도 lastSavedAt을 세팅해서 · 배지는 「방금 저장됨」인데 목록은 비어있는 불일치)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [savedTick, setSavedTick] = useState(0); // 「방금 저장됨」 애니메이션 트리거

  // rows 자동 저장 (500ms debounce) · 브라우저 새로고침 시 복원용 sessionStorage 저장
  // - 실제 「임시저장 목록」에는 반영 안 됨 (그건 manualSave에서만)
  // - lastSavedAt 도 세팅 안 함 (사장님이 명시 저장 안 눌렀는데 「방금 저장됨」 배지 뜨는 문제 방지)
  useEffect(() => {
    if (uploading || !autoSaveEnabled) return;
    const t = setTimeout(() => {
      saveSession(SESSION_KEYS.BULK_NEW_ROWS, toSerializable(rows));
    }, 500);
    return () => clearTimeout(t);
  }, [rows, uploading, autoSaveEnabled]);

  // 「임시저장」 버튼 · 세션(브라우저 유지) + adminDrafts(임시저장 목록 페이지에서 관리) 동시 저장
  const currentDraftIdRef = useRef<string | null>(null);

  // 「저장한 목록 불러오기」 · 이 페이지 (bulk-new) 임시저장만 필터해서 팝업
  const [showDraftListModal, setShowDraftListModal] = useState(false);
  const [draftList, setDraftList] = useState<Array<{ id: string; title: string; updatedAt: number; data: unknown }>>([]);
  const openDraftList = () => {
    const all = listDrafts(PAGE_KEY);
    setDraftList(all.map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt, data: d.data })));
    setShowDraftListModal(true);
  };
  const loadDraft = (draftId: string) => {
    const d = draftList.find((x) => x.id === draftId);
    if (!d) return;
    const data = d.data as { rows?: SerializableRow[]; pool?: string[] } | undefined;
    if (Array.isArray(data?.rows) && data.rows.length > 0) {
      setRows(fromSerializable(data.rows));
      // key 충돌 방지 · nextKeyRef 갱신
      const maxKey = Math.max(...data.rows.map((r) => r.key), 0);
      nextKeyRef.current = Math.max(nextKeyRef.current, maxKey + 1);
    }
    if (Array.isArray(data?.pool)) setSessionPool(data.pool);
    currentDraftIdRef.current = draftId;
    setShowDraftListModal(false);
  };

  const manualSave = () => {
    saveSession(SESSION_KEYS.BULK_NEW_ROWS, toSerializable(rows));
    saveSession(SESSION_KEYS.IMAGE_POOL, sessionPool);
    const d = upsertDraft({
      id: currentDraftIdRef.current || undefined,
      pageKey: PAGE_KEY,
      pageLabel: PAGE_LABEL,
      data: { rows: toSerializable(rows), pool: sessionPool },
    });
    if (!d) { alert("임시 저장 실패 · 브라우저 저장 공간 부족 또는 프라이빗 모드"); return; }
    currentDraftIdRef.current = d.id;
    setLastSavedAt(new Date());
    setSavedTick((n) => n + 1);
  };

  // 새로 시작 · 모든 임시저장 · 사진 풀 · 폼 초기화
  const resetAll = () => {
    if (!confirm("작성 중인 모든 내용을 지우고 처음부터 시작합니다.\n\n계속하시겠어요?")) return;
    clearManySessions([SESSION_KEYS.BULK_NEW_ROWS, SESSION_KEYS.IMAGE_POOL]);
    setRows(Array.from({ length: INITIAL_ROWS }, (_, i) => makeRow(i)));
    setSessionPool([]);
  };

  // 카테고리 실시간 로드 (라이브 데이터) · 최상위 + 하위 모두
  const [liveCategories, setLiveCategories] = useState<Array<{ id: number; name_ja: string; name_ko: string; parent_id: number | null }>>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, name_ja, name_ko, parent_id, sort_order")
        .eq("is_active", true)
        .order("sort_order");
      setLiveCategories(((data as Array<{ id: number; name_ja: string; name_ko: string | null; parent_id: number | null }> ) || []).map((c) => ({
        id: c.id,
        name_ja: c.name_ja,
        name_ko: c.name_ko || c.name_ja,
        parent_id: c.parent_id,
      })));
    })();
  }, []);
  const topCats = useMemo(() => liveCategories.filter((c) => c.parent_id === null), [liveCategories]);
  const subCatsFor = (parentJa: string) => {
    const parent = liveCategories.find((c) => c.parent_id === null && c.name_ja === parentJa);
    if (!parent) return [];
    return liveCategories.filter((c) => c.parent_id === parent.id);
  };

  const addRow = () => {
    setRows((prev) => [...prev, makeRow(nextKeyRef.current++)]);
  };

  // ── 엑셀 업로드 (excel-import 기능 통합) ─────────────────────
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const [excelParsing, setExcelParsing] = useState(false);
  const [excelMsg, setExcelMsg] = useState<string>("");
  const excelInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = async () => {
    setDownloadingTpl(true);
    try {
      if (topCats.length > 0) {
        // DB 상위/하위 트리 조립 · 상위 선택 시 · 해당 하위만 드롭다운 (종속 드롭다운)
        const tree = topCats.map((t) => ({
          top: t.name_ko,
          subs: liveCategories.filter((c) => c.parent_id === t.id).map((c) => c.name_ko),
        }));
        await downloadProductTemplate({ categoryTree: tree });
      } else {
        await downloadProductTemplate({ topCategories: categoriesKo });
      }
    } catch (e) {
      alert("양식 다운로드 실패: " + String(e));
    }
    setDownloadingTpl(false);
  };

  // Row가 비어있는지 (사용자가 손대지 않았는지) 판정
  const isRowEmpty = (r: Row) =>
    !r.nameJa.trim() && !r.nameKo.trim() && r.images.length === 0 &&
    !r.price.trim() && !r.originalPrice.trim() &&
    !r.descriptionJa.trim() && !r.descriptionKo.trim() && r.options.length === 0;

  // 파싱된 raw 데이터 → Row 로 변환
  const rawToRow = (raw: Record<string, string>, key: number): Row => {
    const norm = (s: string) => s.replace(/\s+/g, "").replace(/[()（）]/g, "");
    const pick = (candidates: string[]): string => {
      for (const cand of candidates) {
        for (const k of Object.keys(raw)) {
          if (norm(k) === norm(cand)) return String(raw[k] ?? "").trim();
        }
      }
      return "";
    };
    const nameKo = pick(["상품명", "商品名", "name_ko", "name"]);
    const priceStr = pick(["가격", "판매가", "price"]);
    const origStr = pick(["정가", "original_price"]);
    const catKo = pick(["카테고리", "category"]);
    const subKo = pick(["하위카테고리", "sub_category"]);
    const descKo = pick(["상품설명", "description"]);
    const saleStr = pick(["판매상태", "판매", "status", "is_active"]);
    // 옵션 · 쉼표(,) 구분 · 옵션명과 추가금액 · 순서대로 매칭
    const optNamesStr = pick(["옵션명", "option_names", "options"]);
    const optPricesStr = pick(["옵션추가금액", "옵션가격", "option_prices"]);
    const optNames = optNamesStr ? optNamesStr.split(/[,、，]/).map((s) => s.trim()).filter(Boolean) : [];
    const optPrices = optPricesStr ? optPricesStr.split(/[,、，]/).map((s) => Number(s.replace(/[^\d-]/g, "")) || 0) : [];
    const parsedOptions: RowOption[] = optNames.map((n, i) => ({
      option_name: n,
      additional_price: optPrices[i] || 0,
      stock: 99,
      is_active: true,
    }));
    // 한국어 카테고리명 → 일본어명 매핑 (DB 기준 · 없으면 하드코딩 fallback)
    const findCatJa = (koName: string): string => {
      const dbCat = liveCategories.find((c) => c.parent_id === null && c.name_ko === koName);
      if (dbCat) return dbCat.name_ja;
      const idx = categoriesKo.indexOf(koName);
      if (idx >= 0) return categoriesJa[idx];
      return categoriesJa[0];
    };
    const catJa = catKo ? findCatJa(catKo) : categoriesJa[0];
    const subCatJa = subKo || "";
    const isActive = !saleStr || /^(on|✓|판매|판매중|active|true|1)$/i.test(saleStr.trim());
    return {
      key,
      images: [],
      nameJa: "",
      nameKo,
      categoryJa: catJa,
      subCategoryJa: subCatJa,
      price: priceStr.replace(/[^\d]/g, ""),
      originalPrice: origStr.replace(/[^\d]/g, ""),
      stock: "",
      descriptionJa: "",
      descriptionKo: descKo,
      isActive,
      options: parsedOptions,
      status: "pending",
    };
  };

  const handleExcelFile = async (file: File) => {
    setExcelParsing(true);
    setExcelMsg("");
    const nm = file.name.toLowerCase();
    let parsed: Record<string, string>[] = [];
    try {
      if (nm.endsWith(".xlsx") || nm.endsWith(".xls")) parsed = await parseXlsxToObjects(file);
      else parsed = parseCsvToObjects(await file.text());
    } catch (e) {
      setExcelParsing(false);
      alert("파일을 읽지 못했어요. 엑셀 양식이 맞는지 확인해주세요.\n\n오류: " + String(e));
      return;
    }
    if (parsed.length === 0) {
      setExcelParsing(false);
      setExcelMsg("파일이 비어있어요.");
      return;
    }
    // 새 Row 생성
    const newRows: Row[] = parsed.map((raw) => rawToRow(raw, nextKeyRef.current++));
    // 자동 번역 · 엑셀은 한국어로만 작성하니 · 일본어 필드 즉시 자동 채움
    setExcelMsg(`🌐 ${newRows.length}건 · 일본어 자동 번역 중...`);
    let translated = 0;
    for (const nr of newRows) {
      if (nr.nameKo && !nr.nameJa) {
        try { nr.nameJa = await translateKoJa(nr.nameKo, "ko", "ja"); translated++; } catch {}
      }
      if (nr.descriptionKo && !nr.descriptionJa) {
        try { nr.descriptionJa = await translateKoJa(nr.descriptionKo, "ko", "ja"); } catch {}
      }
    }
    setExcelMsg(`🌐 자동 번역 완료 · ${translated}건 채움 · 카드 정리 중...`);
    // 기존 rows 병합 · 첫 비어있는 위치부터 채움 · 부족하면 append
    setRows((prev) => {
      const merged: Row[] = [...prev];
      let insertIdx = 0;
      for (const nr of newRows) {
        // 첫 비어있는 위치 찾기 (insertIdx 이후)
        while (insertIdx < merged.length && !isRowEmpty(merged[insertIdx])) insertIdx++;
        if (insertIdx < merged.length) {
          // key 유지 · 데이터만 교체
          merged[insertIdx] = { ...nr, key: merged[insertIdx].key };
          insertIdx++;
        } else {
          merged.push(nr);
        }
      }
      return merged;
    });
    setExcelParsing(false);
    setExcelMsg(`✓ ${newRows.length}건 불러왔어요`);
    setTimeout(() => setShowExcelModal(false), 900);
  };

  // 일괄 자동 번역 · JP → KO or KO → JP · 빈 필드만 채움
  const [translating, setTranslating] = useState(false);
  const [translateMsg, setTranslateMsg] = useState<string>("");
  const bulkTranslate = async () => {
    if (translating) return;
    setTranslating(true);
    setTranslateMsg("");
    let done = 0;
    let skipped = 0;
    const targets = rows.filter((r) => (r.nameJa && !r.nameKo) || (r.nameKo && !r.nameJa) || (r.descriptionJa && !r.descriptionKo) || (r.descriptionKo && !r.descriptionJa));
    if (targets.length === 0) {
      setTranslating(false);
      setTranslateMsg("번역할 항목이 없습니다 (양쪽 다 입력됐거나 · 둘 다 비어있음)");
      setTimeout(() => setTranslateMsg(""), 3000);
      return;
    }
    for (const r of targets) {
      try {
        const patch: Partial<Row> = {};
        if (r.nameJa && !r.nameKo) patch.nameKo = await translateKoJa(r.nameJa, "ja", "ko");
        else if (r.nameKo && !r.nameJa) patch.nameJa = await translateKoJa(r.nameKo, "ko", "ja");
        if (r.descriptionJa && !r.descriptionKo) patch.descriptionKo = await translateKoJa(r.descriptionJa, "ja", "ko");
        else if (r.descriptionKo && !r.descriptionJa) patch.descriptionJa = await translateKoJa(r.descriptionKo, "ko", "ja");
        if (Object.keys(patch).length > 0) {
          updateRow(r.key, patch);
          done++;
        } else {
          skipped++;
        }
      } catch {
        skipped++;
      }
    }
    setTranslating(false);
    setTranslateMsg(`번역 완료 · 성공 ${done}건${skipped ? ` · 스킵 ${skipped}건` : ""}`);
    setTimeout(() => setTranslateMsg(""), 4000);
  };

  const removeRow = (key: number) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const updateRow = (key: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  // ── 옵션 편집 (개별 편집과 동일) ─────────────────────
  const addRowOption = (key: number) => {
    setRows((prev) => prev.map((r) => r.key === key
      ? { ...r, options: [...r.options, { option_name: "", additional_price: 0, stock: 99, is_active: true }] }
      : r));
  };
  const updateRowOption = (key: number, idx: number, patch: Partial<RowOption>) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const list = [...r.options];
      list[idx] = { ...list[idx], ...patch };
      return { ...r, options: list };
    }));
  };
  const removeRowOption = (key: number, idx: number) => {
    setRows((prev) => prev.map((r) => r.key === key
      ? { ...r, options: r.options.filter((_, i) => i !== idx) }
      : r));
  };

  // ── COLOR 옵션 재정렬 (화살표 + 드래그) ─────────────────────
  // 옵션 객체 전체(옵션명+추가금액+stock+is_active)를 하나의 단위로 이동
  const moveRowOptionUp = (key: number, idx: number) => {
    if (idx === 0) return;
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const arr = [...r.options];
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      return { ...r, options: arr };
    }));
  };
  const moveRowOptionDown = (key: number, idx: number) => {
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      if (idx === r.options.length - 1) return r;
      const arr = [...r.options];
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      return { ...r, options: arr };
    }));
  };
  // 행(key)마다 독립적인 드래그 상태 · Map으로 관리
  const [optDrag, setOptDrag] = useState<{ key: number | null; index: number | null; overIndex: number | null }>({ key: null, index: null, overIndex: null });
  const onRowOptDragStart = (key: number, i: number) => setOptDrag({ key, index: i, overIndex: null });
  const onRowOptDragOver = (e: React.DragEvent, key: number, i: number) => {
    e.preventDefault();
    if (optDrag.key === key && optDrag.index !== null && optDrag.index !== i && optDrag.overIndex !== i) {
      setOptDrag((prev) => ({ ...prev, overIndex: i }));
    }
  };
  const onRowOptDragLeave = () => setOptDrag((prev) => ({ ...prev, overIndex: null }));
  const onRowOptDrop = (key: number, targetIndex: number) => {
    if (optDrag.key !== key || optDrag.index === null || optDrag.index === targetIndex) {
      setOptDrag({ key: null, index: null, overIndex: null });
      return;
    }
    const from = optDrag.index;
    setRows((prev) => prev.map((r) => {
      if (r.key !== key) return r;
      const arr = [...r.options];
      const [moved] = arr.splice(from, 1);
      arr.splice(targetIndex, 0, moved);
      return { ...r, options: arr };
    }));
    setOptDrag({ key: null, index: null, overIndex: null });
  };
  const onRowOptDragEnd = () => setOptDrag({ key: null, index: null, overIndex: null });

  const addImagesToRow = (key: number, files: FileList | File[]) => {
    const arr = Array.from(files);
    const readers = arr.map(
      (file) =>
        new Promise<{ file: File; preview: string }>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve({ file, preview: reader.result as string });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((imgs) => {
      setRows((prev) =>
        prev.map((r) => (r.key === key ? { ...r, images: [...r.images, ...imgs] } : r))
      );
    });
  };

  // 라이브러리 피커 활성 행 · null이면 닫힘
  const [pickerRowKey, setPickerRowKey] = useState<number | null>(null);

  // 세션 이미지 풀 · 이 브라우저 세션에서 업로드된 URL만 · sessionStorage로 페이지 이동 시에도 유지
  const [sessionPool, setSessionPool] = useState<string[]>(() => loadSession<string[]>(SESSION_KEYS.IMAGE_POOL, []));
  const [sessionUploading, setSessionUploading] = useState(false);
  const sessionBulkInputRef = useRef<HTMLInputElement>(null);

  // 세션 풀 변경 시 자동 저장
  useEffect(() => { saveSession(SESSION_KEYS.IMAGE_POOL, sessionPool); }, [sessionPool]);

  const uploadToSessionPool = async (files: File[]) => {
    setSessionUploading(true);
    const newUrls: string[] = [];
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, file);
      if (error) { console.error("세션 업로드 실패:", error); continue; }
      const { data: pub } = supabase.storage.from("product-images").getPublicUrl(path);
      newUrls.push(pub.publicUrl);
    }
    if (newUrls.length > 0) setSessionPool((prev) => [...newUrls, ...prev]);
    setSessionUploading(false);
  };

  // 행 내부 이미지 드래그 순서 변경 상태
  const [rowDrag, setRowDrag] = useState<{ rowKey: number | null; from: number | null; over: number | null }>({ rowKey: null, from: null, over: null });
  const moveRowImage = (key: number, from: number, to: number) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const a = [...r.images];
        const [moved] = a.splice(from, 1);
        a.splice(to, 0, moved);
        return { ...r, images: a };
      })
    );
  };

  const removeImage = (key: number, imgIndex: number) => {
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, images: r.images.filter((_, i) => i !== imgIndex) } : r
      )
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const path = `products/${Date.now()}_${Math.random().toString(36).slice(2, 9)}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file);
    if (error) return null;
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return data.publicUrl;
  };

  const validRows = () =>
    rows.filter((r) => r.images.length > 0 && r.nameJa.trim() && r.price.trim());

  const handleSubmit = async () => {
    const valid = validRows();
    if (valid.length === 0) {
      alert("최소 1행 이상: 이미지 + 상품명(일본어) + 가격 이 채워져야 합니다");
      return;
    }
    if (!confirm(`${valid.length}건 일괄 등록합니다. 진행할까요?`)) return;

    setUploading(true);
    let ok = 0;
    const failed: { key: number; nameJa: string; reason: string }[] = [];

    for (const row of valid) {
      updateRow(row.key, { status: "uploading" });

      // 이미지 업로드
      const urls: string[] = [];
      for (const img of row.images) {
        if (img.file) {
          const u = await uploadImage(img.file);
          if (u) urls.push(u);
        } else if (img.url) {
          urls.push(img.url);
        }
      }
      if (urls.length === 0) {
        updateRow(row.key, { status: "error", error: "이미지 업로드 실패" });
        failed.push({ key: row.key, nameJa: row.nameJa, reason: "이미지 업로드 실패" });
        continue;
      }

      // 카테고리 매핑
      const catIdx = categoriesJa.indexOf(row.categoryJa);
      const catKo = catIdx >= 0 ? categoriesKo[catIdx] : categoriesKo[0];

      const { data: inserted, error } = await supabase.from("products").insert({
        name: row.nameJa || row.nameKo,
        name_ja: row.nameJa,
        name_ko: row.nameKo,
        price: Number(row.price),
        original_price: row.originalPrice ? Number(row.originalPrice) : null,
        stock: 2147483647,
        category: row.categoryJa,
        category_ja: row.categoryJa,
        category_ko: catKo,
        sub_category: row.subCategoryJa || null,
        image: urls[0],
        images: urls,
        description: row.descriptionJa || row.descriptionKo || null,
        description_ja: row.descriptionJa || null,
        description_ko: row.descriptionKo || null,
        is_active: !!row.isActive,
        source: "일괄",
      }).select("id").single();

      if (error || !inserted) {
        updateRow(row.key, { status: "error", error: error?.message || "insert 실패" });
        failed.push({ key: row.key, nameJa: row.nameJa, reason: error?.message || "insert 실패" });
        continue;
      }

      // 옵션 insert · 이름 있는 옵션만
      const validOpts = row.options.filter((o) => o.option_name.trim());
      if (validOpts.length > 0) {
        const optPayload = validOpts.map((o, oi) => ({
          product_id: inserted.id,
          option_name: o.option_name.trim(),
          additional_price: Number(o.additional_price) || 0,
          stock: Number(o.stock) || 99,
          is_active: o.is_active !== false,
          sort_order: oi,
        }));
        const { error: optErr } = await supabase.from("product_options").insert(optPayload);
        if (optErr) {
          updateRow(row.key, { status: "error", error: "옵션 저장 실패: " + optErr.message });
          failed.push({ key: row.key, nameJa: row.nameJa, reason: "옵션: " + optErr.message });
          continue;
        }
      }

      updateRow(row.key, { status: "ok" });
      ok++;
    }

    setUploading(false);

    if (failed.length === 0) {
      // 성공 시 임시저장 초기화
      clearManySessions([SESSION_KEYS.BULK_NEW_ROWS, SESSION_KEYS.IMAGE_POOL]);
      alert(`✓ ${ok}건 모두 등록 완료`);
      router.push("/products");
    } else {
      alert(`성공 ${ok}건 / 실패 ${failed.length}건\n실패 항목은 삭제 후 재시도해주세요.`);
    }
  };

  return (
    <div className="pb-8">
      {/* 메일 스타일 · 임시저장 복원 안내 팝업 */}
      {restorePrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center text-2xl flex-shrink-0">💾</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">이전에 작성 중인 내용이 있어요</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {restorePrompt.rowCount > 0 && <>작성 중인 상품 <b className="text-gray-700">{restorePrompt.rowCount}건</b></>}
                  {restorePrompt.rowCount > 0 && restorePrompt.poolCount > 0 && <> · </>}
                  {restorePrompt.poolCount > 0 && <>담아둔 사진 <b className="text-gray-700">{restorePrompt.poolCount}장</b></>}
                  <br />불러와서 이어서 작업하시겠어요?
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={doDiscard}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                🗑 새로 시작
              </button>
              <button
                onClick={doRestore}
                className="px-5 py-2 text-sm bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] font-semibold"
              >
                ✎ 불러오기
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-medium text-gray-900">상품 일괄 등록</h1>
          <p className="text-sm text-gray-500 mt-1">
            여러 상품을 한 번에 등록합니다. 각 행에 이미지를 드래그&드롭 하세요.
          </p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <DraftSaveButton
              onSave={manualSave}
              lastSavedAt={lastSavedAt}
              savedTick={savedTick}
            />
            <button
              type="button"
              onClick={openDraftList}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-full border-2 border-gray-200 bg-white text-gray-700 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-dk)] transition"
              title="이 페이지에서 저장한 임시저장을 불러오기"
            >
              📂 저장한 목록 불러오기
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {translateMsg && (
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-3 py-1 font-medium">{translateMsg}</span>
          )}
          {/* 사진 미리 담아두기 · 이번 등록에서만 재사용 가능 · 눈에 확 띄는 디자인 */}
          <button
            type="button"
            onClick={() => sessionBulkInputRef.current?.click()}
            disabled={sessionUploading}
            className={`group relative flex items-center gap-2.5 pl-3 pr-3.5 py-2 rounded-xl font-medium text-sm shadow-md transition-all disabled:opacity-60 ${
              sessionPool.length === 0
                ? "bg-gradient-to-br from-[var(--color-brand)] via-[#D6A490] to-[var(--color-brand-dk)] text-white hover:shadow-lg hover:-translate-y-0.5 animate-pulse-slow"
                : "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg"
            }`}
            title={sessionPool.length === 0
              ? "여러 장 사진을 한 번에 올려두면 · 아래 각 상품 행에서 클릭 한 번으로 골라 넣을 수 있어요"
              : `이번 등록에 담아둔 사진 ${sessionPool.length}장 · 아래 상품 행에서 「사진 고르기」로 재사용 가능`}
          >
            {/* 아이콘 · 사진 여러 장 겹친 이미지 */}
            <span className="text-xl leading-none">📸</span>
            <div className="flex flex-col items-start leading-tight">
              <span className="text-[13px] font-bold">
                {sessionUploading ? "올리는 중..." : sessionPool.length === 0 ? "사진 미리 담기" : `담긴 사진 ${sessionPool.length}장`}
              </span>
              <span className="text-[10px] opacity-90">
                {sessionPool.length === 0 ? "▼ 클릭해서 여러 장 한 번에 올리기" : "▼ 사진 더 담으려면 클릭"}
              </span>
            </div>
            {/* 새로 담긴 사진 배지 (담긴 상태일 때 강조) */}
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
            disabled={translating || uploading}
            className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 shadow-sm transition"
            title="비어있는 반대 언어 필드 자동 채움 (상품명 · 상품설명)"
          >
            {translating ? "🌐 번역 중..." : "🌐 일괄 자동번역"}
          </button>
          {/* 엑셀 업로드 (excel-import 통합) · 별도 페이지 대신 · 여기서 모달로 처리 */}
          <button
            onClick={() => setShowExcelModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium shadow-sm transition"
            title="엑셀 파일로 여러 상품을 한꺼번에 불러오기"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2" fill="#FFFFFF" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#107C41" /></svg>
            엑셀 업로드
          </button>
        </div>
      </div>

      {/* 엑셀 업로드 모달 · 양식 다운로드 + 파일 업로드 */}
      {showExcelModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => !excelParsing && setShowExcelModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center">
                  <svg viewBox="0 0 24 24" className="w-6 h-6"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">엑셀로 상품 불러오기</h3>
                  <p className="text-xs text-gray-500 mt-0.5">엑셀 파일을 올리면 아래 카드가 자동으로 채워져요</p>
                </div>
              </div>
              <button onClick={() => !excelParsing && setShowExcelModal(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100" disabled={excelParsing}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M6 18L18 6" /></svg>
              </button>
            </div>

            {/* ① 엑셀 양식 다운로드 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">①</span>
              <button
                onClick={downloadTemplate}
                disabled={downloadingTpl}
                className="flex-1 px-3 py-2.5 text-xs bg-white border border-[var(--color-brand)]/40 text-[var(--color-brand-dk)] rounded-lg hover:bg-[var(--color-brand)]/5 font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4"><rect x="2" y="4" width="20" height="16" rx="2" fill="#107C41" /><path d="M7 8l3.2 4L7 16h2.2l2-2.7L13.2 16h2.2L12.2 12l3.2-4h-2.2l-2 2.7L9.2 8H7z" fill="#FFFFFF" /></svg>
                {downloadingTpl ? "양식을 만드는 중이에요..." : "엑셀 양식 내려받기 (상품 정보 입력)"}
              </button>
            </div>

            {/* ② 엑셀 파일 업로드 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">②</span>
              <button
                onClick={() => excelInputRef.current?.click()}
                disabled={excelParsing}
                className="flex-1 px-3 py-2.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                {excelParsing ? "불러오는 중..." : "작성한 엑셀 파일 올리기 (xlsx, csv)"}
              </button>
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            {excelMsg && (
              <div className="mt-2 p-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg text-center font-medium">
                {excelMsg}
              </div>
            )}

            <p className="text-[10px] text-gray-400 mt-4 leading-relaxed">
              💡 아래 편집 중이던 카드에는 영향을 주지 않아요. 비어있는 카드부터 채우고 · 부족하면 새 카드가 자동 추가됩니다. 사진은 여기서 안 넣어져요 · 위 「사진 미리 담기」로 담아 두시고 각 카드에 골라 넣어주세요.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <div
            key={row.key}
            className={`bg-white rounded-xl shadow-sm p-4 border-2 transition ${
              row.status === "ok"
                ? "border-green-400"
                : row.status === "error"
                  ? "border-red-400"
                  : row.status === "uploading"
                    ? "border-blue-400 animate-pulse"
                    : "border-transparent"
            }`}
          >
            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_auto] gap-4 items-stretch">
              {/* 이미지 영역 · 빈 상태는 단일 클릭+드롭 박스 · 채워지면 그리드 · 우측 폼과 높이 맞춤 */}
              {row.images.length === 0 ? (
                <div className={`h-full min-h-[240px] ${sessionPool.length > 0 ? "grid grid-rows-2 gap-2" : ""}`}>
                  {/* 클릭+드래그 통합 · 하나의 박스 = 하나의 반응 영역 */}
                  <label
                    onDragOver={(e) => {
                      if (rowDrag.from !== null) return;
                      if (!e.dataTransfer.types.includes("Files")) return;
                      e.preventDefault();
                      setDragOverKey(row.key);
                    }}
                    onDragLeave={() => setDragOverKey(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverKey(null);
                      if (rowDrag.from !== null) return;
                      if (!e.dataTransfer.types.includes("Files")) return;
                      if (e.dataTransfer.files.length > 0) addImagesToRow(row.key, e.dataTransfer.files);
                    }}
                    className={`cursor-pointer flex flex-col items-center justify-center text-center border-2 border-dashed rounded-lg transition py-4 px-3 h-full ${sessionPool.length > 0 ? "min-h-[110px]" : "min-h-[240px]"} ${
                      dragOverKey === row.key
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 bg-gray-50 hover:border-gray-500 hover:bg-white"
                    }`}
                  >
                    <svg className="w-7 h-7 text-gray-400 mb-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                    </svg>
                    <p className="text-xs text-gray-700 font-medium leading-tight">사진 올리기</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">드래그 또는 클릭</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)}
                    />
                  </label>
                  {/* 세션 풀에서 선택 · 담긴 사진이 있을 때만 우측 노출 */}
                  {sessionPool.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickerRowKey(row.key)}
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
                  onDragOver={(e) => {
                    if (rowDrag.from !== null) return;
                    if (!e.dataTransfer.types.includes("Files")) return;
                    e.preventDefault();
                    setDragOverKey(row.key);
                  }}
                  onDragLeave={() => setDragOverKey(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    if (rowDrag.from !== null) return;
                    if (!e.dataTransfer.types.includes("Files")) return;
                    if (e.dataTransfer.files.length > 0) addImagesToRow(row.key, e.dataTransfer.files);
                  }}
                  className={`border-2 border-dashed rounded-lg p-2.5 h-full min-h-[240px] transition ${
                    dragOverKey === row.key
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {row.images.map((img, i) => {
                      const isDragging = rowDrag.rowKey === row.key && rowDrag.from === i;
                      const isOver = rowDrag.rowKey === row.key && rowDrag.over === i && rowDrag.from !== i;
                      return (
                      <div
                        key={i}
                        className={`relative aspect-square group transition-transform ${isDragging ? "opacity-30 scale-95" : ""} ${isOver ? "scale-105" : ""}`}
                        draggable
                        onDragStart={() => setRowDrag({ rowKey: row.key, from: i, over: null })}
                        onDragOver={(e) => { e.preventDefault(); if (rowDrag.rowKey === row.key && rowDrag.from !== null && rowDrag.from !== i && rowDrag.over !== i) setRowDrag({ ...rowDrag, over: i }); }}
                        onDragLeave={() => rowDrag.over === i && setRowDrag({ ...rowDrag, over: null })}
                        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (rowDrag.rowKey === row.key && rowDrag.from !== null && rowDrag.from !== i) moveRowImage(row.key, rowDrag.from, i); setRowDrag({ rowKey: null, from: null, over: null }); }}
                        onDragEnd={() => setRowDrag({ rowKey: null, from: null, over: null })}
                      >
                        {isOver && <div className="absolute -left-1 top-0 bottom-0 w-0.5 bg-blue-500 rounded z-20"></div>}
                        <div className={`relative w-full h-full rounded overflow-hidden border-2 cursor-move transition-all ${
                          isOver ? "border-blue-500 ring-2 ring-blue-200 shadow" :
                          i === 0 ? "border-blue-500" : "border-gray-200 hover:border-blue-400"
                        }`}>
                          <Image src={img.preview} alt={`img${i}`} fill className="object-cover" unoptimized />
                          {/* 순번 배지 · 우상단 · 등록/수정과 동일 스타일 */}
                          <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-gray-900/85 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow ring-1 ring-white/20">
                            {i + 1}
                          </div>
                          {i === 0 && (
                            <span className="absolute top-0.5 left-0.5 bg-blue-500 text-white text-[9px] font-bold px-1 rounded shadow">M</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImage(row.key, i)}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10"
                        >
                          ✕
                        </button>
                      </div>
                      );
                    })}
                    <label className="cursor-pointer aspect-square border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center text-gray-400 hover:border-gray-500">
                      <span className="text-lg leading-none">+</span>
                      <span className="text-[8px] mt-0.5">업로드</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => e.target.files && addImagesToRow(row.key, e.target.files)}
                      />
                    </label>
                    {sessionPool.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setPickerRowKey(row.key)}
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

              {/* 입력 필드들 */}
              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 JP *</label>
                  <input
                    type="text"
                    value={row.nameJa}
                    onChange={(e) => updateRow(row.key, { nameJa: e.target.value })}
                    placeholder="ゴールドチェーンネックレス"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품명 KR</label>
                  <input
                    type="text"
                    value={row.nameKo}
                    onChange={(e) => updateRow(row.key, { nameKo: e.target.value })}
                    placeholder="골드 체인 목걸이"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">카테고리</label>
                  <select
                    value={row.categoryJa}
                    onChange={(e) => updateRow(row.key, { categoryJa: e.target.value, subCategoryJa: "" })}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  >
                    {(topCats.length > 0 ? topCats.map(c => c.name_ja) : categoriesJa).map((cJa) => {
                      const cat = topCats.find(c => c.name_ja === cJa);
                      return <option key={cJa} value={cJa}>{cat ? `${cat.name_ko} / ${cat.name_ja}` : cJa}</option>;
                    })}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">가격 *</label>
                  <input
                    type="number"
                    value={row.price}
                    onChange={(e) => updateRow(row.key, { price: e.target.value })}
                    placeholder="10000"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div className="col-span-3 sm:col-span-1">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">정가</label>
                  <input
                    type="number"
                    value={row.originalPrice}
                    onChange={(e) => updateRow(row.key, { originalPrice: e.target.value })}
                    placeholder="-"
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>

                {/* 하위 카테고리 · 라이브 · 상위 선택 시 그 하위만 · 판매상태 드롭다운 */}
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">
                    하위 카테고리 ({subCatsFor(row.categoryJa).length}건)
                  </label>
                  <select
                    value={row.subCategoryJa}
                    onChange={(e) => updateRow(row.key, { subCategoryJa: e.target.value })}
                    className="mt-1 w-full px-2 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white disabled:bg-gray-100"
                    disabled={subCatsFor(row.categoryJa).length === 0}
                  >
                    <option value="">— 선택 안 함 —</option>
                    {subCatsFor(row.categoryJa).map((s) => (
                      <option key={s.id} value={s.name_ja}>{s.name_ko} / {s.name_ja}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">판매 상태</label>
                  <select
                    value={row.isActive ? "on" : "off"}
                    onChange={(e) => updateRow(row.key, { isActive: e.target.value === "on" })}
                    className={`mt-1 w-full px-2 py-1.5 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium ${
                      row.isActive ? "bg-green-50 border-green-300 text-green-800" : "bg-gray-100 border-gray-300 text-gray-600"
                    }`}
                  >
                    <option value="on">✓ 판매중 (shop 노출)</option>
                    <option value="off">숨김 (shop 미노출)</option>
                  </select>
                </div>

                {/* 상품설명 JP / KO */}
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (일본어)</label>
                  <textarea
                    value={row.descriptionJa}
                    onChange={(e) => updateRow(row.key, { descriptionJa: e.target.value })}
                    placeholder="商品説明 (일본어)"
                    rows={2}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y"
                  />
                </div>
                <div className="col-span-6 sm:col-span-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">상품설명 (한국어)</label>
                  <textarea
                    value={row.descriptionKo}
                    onChange={(e) => updateRow(row.key, { descriptionKo: e.target.value })}
                    placeholder="상품 설명 (한국어)"
                    rows={2}
                    className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900 resize-y"
                  />
                </div>

                {/* COLOR 옵션 · 개별 편집과 동일 · 여러 옵션 · 등록 시 반영 */}
                <div className="col-span-6 border border-gray-200 rounded-lg p-3 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">🎨 COLOR 옵션</span>
                      <span className="text-[11px] text-gray-500">{row.options.length}건</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => addRowOption(row.key)}
                      className="text-[11px] px-3 py-1 bg-gray-900 text-white rounded-full hover:bg-gray-800 font-medium"
                    >
                      + 옵션 추가
                    </button>
                  </div>
                  {row.options.length === 0 ? (
                    <p className="text-[11px] text-gray-400 text-center py-2">등록된 옵션이 없습니다. 필요시 「+ 옵션 추가」</p>
                  ) : (
                    <div className="space-y-1.5">
                      {row.options.map((opt, oi) => {
                        const isOptDragging = optDrag.key === row.key && optDrag.index === oi;
                        const isOptOver = optDrag.key === row.key && optDrag.overIndex === oi && optDrag.index !== null && optDrag.index !== oi;
                        return (
                        <div
                          key={oi}
                          data-testid={`color-option-row-${row.key}-${oi}`}
                          onDragOver={(e) => onRowOptDragOver(e, row.key, oi)}
                          onDragLeave={onRowOptDragLeave}
                          onDrop={() => onRowOptDrop(row.key, oi)}
                          onDragEnd={onRowOptDragEnd}
                          className={`relative grid grid-cols-12 gap-1.5 items-center bg-white border rounded p-1.5 transition-all ${
                            isOptDragging ? "opacity-40 scale-95" : ""
                          } ${isOptOver ? "border-blue-500 ring-1 ring-blue-200 shadow" : "border-gray-200"}`}
                        >
                          {isOptOver && <div className="absolute -left-1 top-0 bottom-0 w-1 bg-blue-500 rounded-full z-20"></div>}
                          {/* 드래그 핸들 · 이 영역만 draggable */}
                          <span
                            draggable
                            onDragStart={() => onRowOptDragStart(row.key, oi)}
                            className="col-span-1 cursor-move text-gray-400 hover:text-gray-700 text-center select-none"
                            title="드래그로 순서 변경"
                            aria-label="드래그 핸들"
                            data-testid={`color-drag-handle-${row.key}-${oi}`}
                          >
                            ⋮⋮
                          </span>
                          <input
                            type="text"
                            placeholder="옵션명 (예: ゴールド)"
                            value={opt.option_name}
                            onChange={(e) => updateRowOption(row.key, oi, { option_name: e.target.value })}
                            className="col-span-5 text-[12px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            type="number"
                            placeholder="추가금액"
                            value={opt.additional_price || ""}
                            onChange={(e) => updateRowOption(row.key, oi, { additional_price: Number(e.target.value) })}
                            className="col-span-3 text-[12px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-900"
                          />
                          {/* 재고 필드 · 사장님 요청으로 UI 숨김 · 옵션 생성 시 stock 기본 99로 저장 */}
                          <div className="col-span-2 flex gap-0.5 justify-center">
                            <button
                              type="button"
                              onClick={() => moveRowOptionUp(row.key, oi)}
                              disabled={oi === 0}
                              className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="위로"
                              aria-label="위로 이동"
                              data-testid={`color-move-up-${row.key}-${oi}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => moveRowOptionDown(row.key, oi)}
                              disabled={oi === row.options.length - 1}
                              className="w-5 h-5 flex items-center justify-center text-[10px] text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                              title="아래로"
                              aria-label="아래로 이동"
                              data-testid={`color-move-down-${row.key}-${oi}`}
                            >
                              ▼
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeRowOption(row.key, oi)}
                            className="col-span-1 text-red-500 hover:bg-red-50 rounded p-1 flex items-center justify-center"
                            title="옵션 삭제"
                          >
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {row.error && (
                  <div className="col-span-6 text-[11px] text-red-600 bg-red-50 px-2 py-1 rounded">
                    ⚠ {row.error}
                  </div>
                )}
                {row.status === "ok" && (
                  <div className="col-span-6 text-[11px] text-green-600 bg-green-50 px-2 py-1 rounded">
                    ✓ 등록 완료
                  </div>
                )}
              </div>

              {/* 행 삭제 */}
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-gray-400 font-medium">#{idx + 1}</span>
                <button
                  onClick={() => removeRow(row.key)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:bg-red-50 hover:text-red-600 rounded transition"
                  title="행 삭제"
                  disabled={uploading}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M6 6l12 12M6 18L18 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 행 추가 */}
      <button
        onClick={addRow}
        disabled={uploading}
        className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-500 hover:text-gray-700 transition disabled:opacity-50"
      >
        + 행 추가
      </button>

      {/* 표준 하단 sticky 액션 바 · 관리자 포털 전체 공통 */}
      <FormActionBar
        cancelHref="/products"
        cancelLabel="취소"
        status={
          <span>
            <span className="font-medium text-gray-700">{rows.length}행</span> 중 등록 가능{" "}
            <span className="font-semibold text-gray-900">{validRows().length}건</span>
            <span className="text-gray-400 ml-2">(이미지 + 상품명 + 가격 필수)</span>
          </span>
        }
        primary={{
          label: uploading ? "등록 중..." : `🆕 일괄 등록 (${validRows().length}건)`,
          onClick: handleSubmit,
          disabled: uploading || validRows().length === 0,
        }}
      />

      <ImageLibraryPicker
        open={pickerRowKey !== null}
        onClose={() => setPickerRowKey(null)}
        sessionUrls={sessionPool}
        titleOverride="📸 세션 이미지 풀에서 선택"
        descriptionOverride="이번 세션에서 업로드한 이미지들 · 스토리지 전체 X"
        onSelect={(urls) => {
          if (pickerRowKey === null) return;
          setRows((prev) => prev.map((r) => r.key === pickerRowKey
            ? { ...r, images: [...r.images, ...urls.map((u) => ({ file: null, preview: u, url: u }))] }
            : r
          ));
        }}
      />

      {/* 저장한 목록 불러오기 모달 · 이 페이지 (bulk-new) 임시저장만 필터 */}
      {showDraftListModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowDraftListModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900">📂 저장한 목록 불러오기</h3>
                <p className="text-[11px] text-gray-500 mt-0.5">이 페이지에서 임시저장한 목록만 표시돼요</p>
              </div>
              <button onClick={() => setShowDraftListModal(false)} className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 6l12 12M6 18L18 6" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {draftList.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <p>임시저장한 목록이 없어요</p>
                  <p className="text-[11px] mt-1">「💾 임시 저장」을 눌러 저장해두세요</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {draftList.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => loadDraft(d.id)}
                      className="w-full text-left p-3 bg-white border border-gray-200 rounded-lg hover:border-[var(--color-brand)] hover:bg-[var(--color-brand)]/5 transition"
                    >
                      <p className="text-sm font-semibold text-gray-900 truncate">{d.title}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">저장 시각: {new Date(d.updatedAt).toLocaleString("ko-KR")}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end">
              <button onClick={() => setShowDraftListModal(false)} className="px-4 py-2 text-xs text-gray-600 hover:bg-gray-100 rounded-lg">닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
