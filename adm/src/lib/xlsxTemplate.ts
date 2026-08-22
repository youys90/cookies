// 상품 일괄 등록 · 스타일링된 xlsx 템플릿 생성 · 관리자 친화 디자인
// 브랜드 컬러 헤더 · 예시 행 · 데이터 검증 드롭다운 · 컬럼 폭 · 프리즈 · 안내 배너

import ExcelJS from "exceljs";

const BRAND = "FFC8907F";
const BRAND_DARK = "FFA97862";
const SAMPLE_BG = "FFFEF3C7";
const INSTRUCTION_BG = "FFFFFBEB";
const EMPTY_BG = "FFFFFFFF";
const HEADER_FONT = "FFFFFFFF";

interface Column {
  label: string;
  key: string;
  width: number;
  sample: string | number;
  required: boolean;
  hint?: string;
}

// 한국어만 입력 · 일본어는 등록 시 자동 번역/매핑
// 재고 · 판매상태는 등록 후 개별 편집 (등록 시 = 판매중 · 재고 미관리)
const COLUMNS: Column[] = [
  { label: "No.", key: "row_no", width: 6, sample: 1, required: false, hint: "자동 순번 · 입력 안 하셔도 돼요" },
  { label: "상품명", key: "name_ko", width: 32, sample: "골드 체인 목걸이", required: true, hint: "필수 · 한국어로 입력 · 일본어는 자동 번역" },
  { label: "가격 (¥)", key: "price", width: 14, sample: 10000, required: true, hint: "숫자만 · 판매가" },
  { label: "정가 (¥)", key: "original_price", width: 14, sample: 12000, required: false, hint: "숫자 · 취소선 표시용" },
  { label: "카테고리", key: "category_ko", width: 22, sample: "액세서리", required: true, hint: "드롭다운 · 한국어 · 일본어는 자동 매핑" },
  { label: "하위 카테고리", key: "sub_category_ko", width: 22, sample: "목걸이", required: false, hint: "드롭다운 · 한국어 · 일본어는 자동 매핑" },
  { label: "상품 설명", key: "description_ko", width: 50, sample: "심플하고 고급스러운 골드 체인", required: false, hint: "한국어로 입력 · 일본어는 자동 번역" },
  { label: "옵션명", key: "option_names", width: 30, sample: "골드,실버,로즈골드", required: false, hint: "선택 · 여러 개는 쉼표(,)로 구분 · 예: 골드,실버,로즈골드" },
  { label: "옵션 추가금액", key: "option_prices", width: 24, sample: "0,1000,2000", required: false, hint: "선택 · 옵션 순서대로 · 쉼표(,)로 구분 · 예: 0,1000,2000" },
];

export interface TemplateOptions {
  /** 최상위 카테고리 명칭 · 「카테고리」 컬럼 드롭다운 (호환용 · categoryTree 있으면 무시) */
  topCategories?: string[];
  /** 하위 카테고리 명칭 · 「하위 카테고리」 컬럼 드롭다운 (호환용) */
  subCategories?: string[];
  /** 카테고리 트리 · 상위 선택 시 하위 자동 필터링 (종속 드롭다운) */
  categoryTree?: { top: string; subs: string[] }[];
}

// 엑셀 정의 이름(named range)에 유효한 문자만 유지 · 공백/특수문자 → 밑줄
function sanitizeExcelName(s: string): string {
  return s.replace(/[^A-Za-z0-9가-힣]/g, "_");
}

export async function downloadProductTemplate(opts: TemplateOptions = {}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CREAM Admin";
  wb.created = new Date();

  // 트리 우선 · 없으면 flat 리스트로 fallback
  const tree = opts.categoryTree && opts.categoryTree.length > 0
    ? opts.categoryTree
    : (opts.topCategories ?? []).map((t) => ({ top: t, subs: opts.subCategories ?? [] }));
  const topCats = tree.map((t) => t.top).filter((s) => s && s.trim().length > 0);

  const ws = wb.addWorksheet("상품 일괄 등록", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 0 }],
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.width }));

  // ── 1행 · 타이틀 배너 (풀 폭 병합) ─────────────────────────────
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const title = ws.getCell(1, 1);
  title.value = "🛍️  CREAM  상품 일괄 등록 양식";
  title.font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: HEADER_FONT } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  ws.getRow(1).height = 44;

  // ── 2행 · 서브타이틀 ───────────────────────────────────────
  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const subtitle = ws.getCell(2, 1);
  subtitle.value = "6행부터 상품 정보를 입력해주세요 · 4행의 노란색 예시는 자동으로 빠지니 지우지 않으셔도 돼요";
  subtitle.font = { name: "맑은 고딕", size: 11, color: { argb: "FF6B7280" }, italic: true };
  subtitle.alignment = { vertical: "middle", horizontal: "center" };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  ws.getRow(2).height = 24;

  // ── 3행 · 안내 배너 ───────────────────────────────────────
  ws.mergeCells(3, 1, 3, COLUMNS.length);
  const note = ws.getCell(3, 1);
  note.value = "⚠  상품 이미지는 이 파일로 등록되지 않아요 · 관리자 화면에서 이미지를 올려 상품에 연결해주세요";
  note.font = { name: "맑은 고딕", size: 10, color: { argb: "FF92400E" }, bold: true };
  note.alignment = { vertical: "middle", horizontal: "center" };
  note.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INSTRUCTION_BG } };
  note.border = { top: { style: "thin", color: { argb: "FFFCD34D" } }, bottom: { style: "thin", color: { argb: "FFFCD34D" } } };
  ws.getRow(3).height = 22;

  // ── 4행 · 예시 행 ────────────────────────────────────────
  const sampleRow = ws.getRow(4);
  COLUMNS.forEach((c, i) => {
    const cell = sampleRow.getCell(i + 1);
    // 첫 컬럼에 [예시] 접두어 (업로드 시 자동 스킵 트리거)
    cell.value = i === 0 ? `[예시] ${c.sample}` : c.sample;
    cell.font = { name: "맑은 고딕", size: 10, italic: true, color: { argb: "FF92400E" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SAMPLE_BG } };
    cell.alignment = { vertical: "middle", horizontal: typeof c.sample === "number" ? "right" : "left", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFFCD34D" } },
      bottom: { style: "thin", color: { argb: "FFFCD34D" } },
      left: { style: "thin", color: { argb: "FFFCD34D" } },
      right: { style: "thin", color: { argb: "FFFCD34D" } },
    };
  });
  sampleRow.height = 28;

  // ── 5행 · 헤더 (브랜드 컬러) ──────────────────────────────
  const headerRow = ws.getRow(5);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.required ? `${c.label} *` : c.label;
    cell.font = { name: "맑은 고딕", size: 11, bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "medium", color: { argb: BRAND_DARK } },
      bottom: { style: "medium", color: { argb: BRAND_DARK } },
      left: { style: "thin", color: { argb: HEADER_FONT } },
      right: { style: "thin", color: { argb: HEADER_FONT } },
    };
    // 헤더 셀 주석 · 힌트 표시
    if (c.hint) {
      cell.note = {
        texts: [
          { font: { bold: true, color: { argb: "FF111827" } }, text: c.label + "\n" },
          { font: { color: { argb: "FF4B5563" } }, text: c.hint },
        ],
        margins: { insetmode: "custom", inset: [0.15, 0.15, 0.15, 0.15] },
      };
    }
  });
  headerRow.height = 32;

  // ── 6~55행 · 입력 행 (50행 · 얇은 회색 스트라이프) ─────────
  const INPUT_ROWS = 50;
  for (let r = 6; r < 6 + INPUT_ROWS; r++) {
    const row = ws.getRow(r);
    row.height = 22;
    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      cell.font = { name: "맑은 고딕", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: c.key === "price" || c.key === "original_price" || c.key === "stock" ? "right" : "left", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE5E7EB" } },
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        left: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
      // 짝수 행 은은한 배경
      if (r % 2 === 1) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      } else {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
      }
    });
  }

  // ── 숨김 「_lookup」 시트 · 상위 컬럼 A · 각 상위의 하위는 별도 컬럼 ──
  // Row 1: 헤더 (A: 카테고리, B~: 각 상위 카테고리명)
  // Row 2+: A열에 상위 목록 · B+열에 해당 상위의 하위 목록
  const lookup = wb.addWorksheet("_lookup", { state: "hidden" });
  lookup.getCell(1, 1).value = "카테고리";
  topCats.forEach((v, i) => { lookup.getCell(i + 2, 1).value = v; });

  // 각 상위 카테고리별로 별도 컬럼에 하위 목록 · 정의된 이름 등록 (INDIRECT 참조용)
  tree.forEach((entry, idx) => {
    const colIdx = idx + 2; // B, C, D, ...
    const colLetter = colIdx <= 26 ? String.fromCharCode(64 + colIdx) : `A${String.fromCharCode(64 + colIdx - 26)}`;
    lookup.getCell(1, colIdx).value = entry.top;
    entry.subs.forEach((s, si) => { lookup.getCell(si + 2, colIdx).value = s; });
    if (entry.subs.length > 0) {
      const sanitized = "_sub_" + sanitizeExcelName(entry.top);
      const range = `_lookup!$${colLetter}$2:$${colLetter}$${entry.subs.length + 1}`;
      try {
        wb.definedNames.add(range, sanitized);
      } catch (e) {
        console.warn("definedName 등록 실패:", entry.top, e);
      }
    }
  });

  const topRange = topCats.length > 0 ? `_lookup!$A$2:$A$${topCats.length + 1}` : null;

  // ── 데이터 검증 · 카테고리 드롭다운 ────────────────────────
  const categoryCol = COLUMNS.findIndex((c) => c.key === "category_ko") + 1;
  const subCategoryCol = COLUMNS.findIndex((c) => c.key === "sub_category_ko") + 1;
  const categoryColLetter = String.fromCharCode(64 + categoryCol);

  for (let r = 6; r < 6 + INPUT_ROWS; r++) {
    if (topRange) {
      ws.getCell(r, categoryCol).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`=${topRange}`],
        showErrorMessage: true,
        errorStyle: "stop",
        errorTitle: "카테고리 선택",
        error: "「카테고리 관리」에 등록된 명칭만 사용 가능합니다",
      };
    }
    // 하위 · 상위 셀 값에 따라 종속 (INDIRECT + 정의된 이름)
    ws.getCell(r, subCategoryCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`=INDIRECT("_sub_" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${categoryColLetter}${r}," ","_"),"/","_"),"-","_"))`],
      showErrorMessage: true,
      errorStyle: "stop",
      errorTitle: "하위 카테고리 선택",
      error: "상위 카테고리를 먼저 선택한 뒤 · 해당 상위의 하위만 선택 가능",
    };
  }

  // ── 데이터 검증 · 숫자 필드 (가격 · 정가) ─────────────────
  const priceCol = COLUMNS.findIndex((c) => c.key === "price") + 1;
  const originalPriceCol = COLUMNS.findIndex((c) => c.key === "original_price") + 1;
  const numericValidation = {
    type: "whole" as const,
    operator: "greaterThanOrEqual" as const,
    allowBlank: true,
    formulae: [0],
    showErrorMessage: true,
    errorStyle: "warning" as const,
    errorTitle: "숫자만 입력",
    error: "0 이상의 정수만 입력 가능합니다",
  };
  for (let r = 6; r < 6 + INPUT_ROWS; r++) {
    ws.getCell(r, priceCol).dataValidation = numericValidation;
    ws.getCell(r, originalPriceCol).dataValidation = numericValidation;
    ws.getCell(r, priceCol).numFmt = "#,##0";
    ws.getCell(r, originalPriceCol).numFmt = "#,##0";
  }

  // 시트 보호 없음 (편집 가능) · 인쇄 영역만 세팅
  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ── 안내 시트 (2번째) ─────────────────────────────────
  const help = wb.addWorksheet("📖 사용 안내", { views: [{ state: "frozen", ySplit: 1 }] });
  help.columns = [
    { header: "항목", key: "topic", width: 24 },
    { header: "설명", key: "detail", width: 90 },
  ];
  const helpHeader = help.getRow(1);
  helpHeader.font = { bold: true, color: { argb: HEADER_FONT }, name: "맑은 고딕", size: 12 };
  helpHeader.height = 30;
  helpHeader.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  const helpRows: [string, string][] = [
    ["📝 어디부터 입력하나요?", "「상품 일괄 등록」 시트의 6행부터 상품 정보를 넣어주세요. 4행에 있는 노란색 예시는 자동으로 빠지니 지우지 않으셔도 돼요."],
    ["✅ 꼭 넣어야 하는 항목", "상품명 · 가격 · 카테고리"],
    ["🌐 언어", "모두 한국어로만 입력해주세요. 일본어 이름은 등록할 때 자동으로 만들어드려요."],
    ["🈶 카테고리 · 하위 카테고리", "카테고리를 먼저 선택하면 · 하위 카테고리는 그 카테고리에 맞는 것만 목록에 나와요."],
    ["🖼 상품 이미지", "이 파일로는 이미지가 등록되지 않아요. 관리자 화면의 「엑셀로 한꺼번에 등록」에서 왼쪽에 이미지를 올린 뒤 상품 카드를 눌러 연결해주세요."],
    ["🔢 가격 · 정가", "숫자만 넣어주세요. 정가는 비워두셔도 돼요."],
    ["🏷 판매상태", "모두 「판매중」으로 자동 등록돼요. 나중에 개별 상품 편집에서 「숨김」으로 바꿀 수 있어요."],
    ["📦 재고", "재고는 이 파일에 없어요. 개별 상품 편집에서 관리해주세요."],
    ["💾 저장하기", "엑셀에서 그대로 저장하시면 돼요. .xlsx 나 .csv 둘 다 올릴 수 있어요."],
    ["📤 다음 단계", "관리자 → 상품 관리 → 「엑셀로 한꺼번에 등록」 → 이 파일 올리기"],
    ["⚠ 주의사항", "노란색 예시 행([예시] 표시)은 자동으로 빠지니 그대로 두셔도 안전해요."],
  ];
  helpRows.forEach(([topic, detail], idx) => {
    const row = help.addRow({ topic, detail });
    row.height = 32;
    row.getCell(1).font = { name: "맑은 고딕", size: 11, bold: true };
    row.getCell(2).font = { name: "맑은 고딕", size: 11 };
    row.getCell(1).alignment = { vertical: "middle", horizontal: "left" };
    row.getCell(2).alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    const bg = idx % 2 === 0 ? "FFFAFAFA" : "FFFFFFFF";
    row.eachCell((cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bg } };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `CREAM_상품_일괄등록_${today}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 상품 목록을 「일괄 등록」 템플릿과 동일한 xlsx 양식으로 내보내기
// - 같은 헤더 · 같은 컬럼 폭 · 같은 드롭다운 검증
// - 다운받아 편집 후 그대로 「Excel로 일괄업로드」 재등록 가능
// - 예시 행 없음 · 실제 데이터로 채움
export interface ExportRow {
  name_ko?: string | null;
  price?: number | null;
  original_price?: number | null;
  category_ko?: string | null;
  sub_category_ko?: string | null;
  description_ko?: string | null;
  stock?: number | null;
  is_active?: boolean | null;
  /** category_ko 없을 때 폴백 */
  category?: string | null;
  sub_category?: string | null;
  /** 옵션 쉼표 구분 문자열 · 예: "골드,실버,로즈골드" */
  option_names?: string | null;
  /** 옵션 추가금액 쉼표 구분 · 예: "0,1000,2000" · option_names 순서 대응 */
  option_prices?: string | null;
}

export async function exportProductsToXlsx(rows: ExportRow[], opts: TemplateOptions = {}): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CREAM Admin";
  wb.created = new Date();

  const tree = opts.categoryTree && opts.categoryTree.length > 0
    ? opts.categoryTree
    : (opts.topCategories ?? []).map((t) => ({ top: t, subs: opts.subCategories ?? [] }));
  const topCats = tree.map((t) => t.top).filter((s) => s && s.trim().length > 0);

  const ws = wb.addWorksheet("상품 목록", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 0 }],
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.width }));

  // ── 1행 · 타이틀 ─────
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const title = ws.getCell(1, 1);
  title.value = `📦  CREAM  상품 목록 (총 ${rows.length}개)`;
  title.font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: HEADER_FONT } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  ws.getRow(1).height = 44;

  // ── 2행 · 서브타이틀 ────
  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const subtitle = ws.getCell(2, 1);
  subtitle.value = "현재 상품 목록입니다 · 필터 조건에 맞는 상품만 포함되어 있어요";
  subtitle.font = { name: "맑은 고딕", size: 11, color: { argb: "FF6B7280" }, italic: true };
  subtitle.alignment = { vertical: "middle", horizontal: "center" };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  ws.getRow(2).height = 24;

  // ── 3행 · 안내 ─────
  ws.mergeCells(3, 1, 3, COLUMNS.length);
  const note = ws.getCell(3, 1);
  note.value = `⚠  카테고리는 셀을 눌러 선택해주세요 · 상품 이미지는 이 파일에 포함되지 않아요`;
  note.font = { name: "맑은 고딕", size: 10, color: { argb: "FF92400E" }, bold: true };
  note.alignment = { vertical: "middle", horizontal: "center" };
  note.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INSTRUCTION_BG } };
  note.border = { top: { style: "thin", color: { argb: "FFFCD34D" } }, bottom: { style: "thin", color: { argb: "FFFCD34D" } } };
  ws.getRow(3).height = 22;

  // ── 4행 · 안내 (여백) ─────
  ws.mergeCells(4, 1, 4, COLUMNS.length);
  ws.getCell(4, 1).value = "";
  ws.getRow(4).height = 6;

  // ── 5행 · 헤더 ─────
  const headerRow = ws.getRow(5);
  COLUMNS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.required ? `${c.label} *` : c.label;
    cell.font = { name: "맑은 고딕", size: 11, bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND_DARK } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "medium", color: { argb: BRAND_DARK } },
      bottom: { style: "medium", color: { argb: BRAND_DARK } },
      left: { style: "thin", color: { argb: HEADER_FONT } },
      right: { style: "thin", color: { argb: HEADER_FONT } },
    };
  });
  headerRow.height = 32;

  // ── 6~ · 데이터 행 ─────
  const priceCol = COLUMNS.findIndex((c) => c.key === "price") + 1;
  const originalPriceCol = COLUMNS.findIndex((c) => c.key === "original_price") + 1;

  rows.forEach((rec, idx) => {
    const r = 6 + idx;
    const row = ws.getRow(r);
    row.height = 22;

    const values: Record<string, string | number | null> = {
      row_no: idx + 1,
      name_ko: rec.name_ko || "",
      price: rec.price ?? null,
      original_price: rec.original_price ?? null,
      category_ko: rec.category_ko || rec.category || "",
      sub_category_ko: rec.sub_category_ko || rec.sub_category || "",
      description_ko: rec.description_ko || "",
      option_names: rec.option_names || "",
      option_prices: rec.option_prices || "",
    };

    COLUMNS.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      const v = values[c.key];
      cell.value = v as string | number | null;
      cell.font = { name: "맑은 고딕", size: 10 };
      cell.alignment = { vertical: "middle", horizontal: (c.key === "price" || c.key === "original_price") ? "right" : "left", wrapText: true };
      cell.border = {
        top: { style: "hair", color: { argb: "FFE5E7EB" } },
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
        left: { style: "hair", color: { argb: "FFE5E7EB" } },
        right: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
      if (r % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
      else cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EMPTY_BG } };
    });

    row.getCell(priceCol).numFmt = "#,##0";
    row.getCell(originalPriceCol).numFmt = "#,##0";
  });

  // ── 숨김 「_lookup」 시트 + 종속 드롭다운 (업로드 템플릿과 동일 구조) ─────
  const lookup = wb.addWorksheet("_lookup", { state: "hidden" });
  lookup.getCell(1, 1).value = "카테고리";
  topCats.forEach((v, i) => { lookup.getCell(i + 2, 1).value = v; });

  tree.forEach((entry, idx) => {
    const colIdx = idx + 2;
    const colLetter = colIdx <= 26 ? String.fromCharCode(64 + colIdx) : `A${String.fromCharCode(64 + colIdx - 26)}`;
    lookup.getCell(1, colIdx).value = entry.top;
    entry.subs.forEach((s, si) => { lookup.getCell(si + 2, colIdx).value = s; });
    if (entry.subs.length > 0) {
      const sanitized = "_sub_" + sanitizeExcelName(entry.top);
      const range = `_lookup!$${colLetter}$2:$${colLetter}$${entry.subs.length + 1}`;
      try { wb.definedNames.add(range, sanitized); } catch (e) { console.warn("definedName 등록 실패:", entry.top, e); }
    }
  });

  const topRange = topCats.length > 0 ? `_lookup!$A$2:$A$${topCats.length + 1}` : null;
  const categoryCol = COLUMNS.findIndex((c) => c.key === "category_ko") + 1;
  const subCategoryCol = COLUMNS.findIndex((c) => c.key === "sub_category_ko") + 1;
  const categoryColLetter = String.fromCharCode(64 + categoryCol);

  for (let r = 6; r < 6 + rows.length; r++) {
    if (topRange) {
      ws.getCell(r, categoryCol).dataValidation = {
        type: "list", allowBlank: true, formulae: [`=${topRange}`],
        showErrorMessage: true, errorStyle: "stop", errorTitle: "카테고리 선택", error: "카테고리 관리 등록 명칭만 사용",
      };
    }
    ws.getCell(r, subCategoryCol).dataValidation = {
      type: "list", allowBlank: true,
      formulae: [`=INDIRECT("_sub_" & SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(${categoryColLetter}${r}," ","_"),"/","_"),"-","_"))`],
      showErrorMessage: true, errorStyle: "stop", errorTitle: "하위 카테고리 선택", error: "상위를 먼저 선택 · 해당 상위의 하위만 선택 가능",
    };
  }

  ws.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const today = new Date().toISOString().slice(0, 10);
  a.download = `CREAM_상품목록_${today}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// xlsx 업로드 → 파싱 · CSV와 동일한 { 한글헤더: 값 } 객체 배열 반환
export async function parseXlsxToObjects(file: File): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // 헤더 행 자동 탐지 · 「상품명」과 「가격」이 모두 있는 행만 헤더로 인정
  // (안내문에 「카테고리」 · 「상품」 단어가 있어도 헤더로 오인식되지 않도록 강화)
  // (템플릿 규격: 5행 · 임의 xlsx: 1행 · CSV → xlsx 변환: 1행)
  const REQUIRED_HEADER_KEYWORDS = ["상품명", "가격"];
  let headerRowIdx = -1;
  ws.eachRow((row, rowNumber) => {
    if (headerRowIdx > 0) return;
    const values = row.values as (string | number | undefined)[];
    if (!values) return;
    const strs = values.map((v) => String(v ?? "").trim());
    // 필수 키워드 모두 있는 행 · 안내문/제목 오인식 방지
    if (REQUIRED_HEADER_KEYWORDS.every((kw) => strs.some((s) => s.includes(kw)))) {
      headerRowIdx = rowNumber;
    }
  });
  if (headerRowIdx < 0) return [];

  // 헤더 배열 · "필수*", "(¥)", 공백 등 정리 → 대표 키로 정규화
  const headerRow = ws.getRow(headerRowIdx);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = String(cell.value ?? "").trim();
    // 정규화: 필수 * 제거 · (¥) 등 괄호 안 통화기호 제거 · 공백 정리
    let cleaned = raw
      .replace(/\s*\*\s*$/, "") // 끝의 " *" 제거
      .replace(/\s*\([^)]*[¥$₩€£]\s*\)\s*/g, "") // (¥), (₩), ($) 등 통화 포함 괄호 삭제
      .replace(/\s+/g, " ") // 연속 공백 하나로
      .trim();
    // 자주 쓰는 별칭 매핑
    const aliases: Record<string, string> = {
      "상품명": "상품명",
      "상품 명": "상품명",
      "상품명 (한국어)": "상품명",
      "상품명(한국어)": "상품명",
      "가격": "가격",
      "판매가": "가격",
      "정가": "정가",
      "카테고리": "카테고리",
      "하위 카테고리": "하위 카테고리",
      "하위카테고리": "하위 카테고리",
      "상품 설명": "상품 설명",
      "상품설명": "상품 설명",
      "설명": "상품 설명",
      "재고": "재고",
      "판매상태": "판매상태",
    };
    cleaned = aliases[cleaned] || cleaned;
    headers[colNumber - 1] = cleaned;
  });

  // 데이터 행 · 헤더 다음부터
  const objects: Record<string, string>[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowIdx) return;
    const values = row.values as (string | number | Date | undefined)[];
    if (!values || values.length <= 1) return;
    const rec: Record<string, string> = {};
    let hasAny = false;
    headers.forEach((h, i) => {
      if (!h) return;
      const cellVal = values[i + 1];
      if (cellVal === undefined || cellVal === null) {
        rec[h] = "";
        return;
      }
      let s: string;
      if (cellVal instanceof Date) {
        s = cellVal.toISOString().slice(0, 10);
      } else if (typeof cellVal === "object" && cellVal !== null && "text" in (cellVal as Record<string, unknown>)) {
        s = String((cellVal as { text: unknown }).text ?? "");
      } else {
        s = String(cellVal);
      }
      rec[h] = s.trim();
      if (rec[h]) hasAny = true;
    });
    // 빈 행 · [예시] 접두 · # 주석 스킵
    if (!hasAny) return;
    const firstVal = Object.values(rec)[0] || "";
    if (firstVal.startsWith("[예시]") || firstVal.startsWith("[샘플]") || firstVal.startsWith("#")) return;
    objects.push(rec);
  });
  return objects;
}
