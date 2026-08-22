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

const COLUMNS: Column[] = [
  { label: "상품명 (일본어)", key: "name_ja", width: 26, sample: "ゴールドチェーンネックレス", required: true, hint: "필수 · 고객에게 노출됨" },
  { label: "상품명 (한국어)", key: "name_ko", width: 26, sample: "골드 체인 목걸이", required: false, hint: "관리자 · 검색 · 관리용" },
  { label: "가격 (¥)", key: "price", width: 12, sample: 10000, required: true, hint: "숫자만 · 판매가" },
  { label: "정가 (¥)", key: "original_price", width: 12, sample: 12000, required: false, hint: "숫자 · 취소선 표시용" },
  { label: "카테고리", key: "category", width: 18, sample: "アクセサリー", required: true, hint: "일본어 명칭 정확히 일치" },
  { label: "하위 카테고리", key: "sub_category", width: 18, sample: "ネックレス", required: false, hint: "일본어 명칭 정확히" },
  { label: "상품 설명 (일본어)", key: "description_ja", width: 40, sample: "シンプルで上品なゴールドチェーン", required: false },
  { label: "상품 설명 (한국어)", key: "description_ko", width: 40, sample: "심플하고 고급스러운 골드 체인", required: false },
  { label: "재고", key: "stock", width: 10, sample: 10, required: false, hint: "숫자 · 공란=미관리" },
  { label: "판매상태", key: "is_active", width: 12, sample: "판매중", required: false, hint: "판매중 / 숨김" },
];

export async function downloadProductTemplate(): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "CREAM Admin";
  wb.created = new Date();

  const ws = wb.addWorksheet("상품 일괄 등록", {
    views: [{ state: "frozen", ySplit: 5, xSplit: 0 }],
    properties: { defaultRowHeight: 20 },
  });

  ws.columns = COLUMNS.map((c) => ({ header: c.label, key: c.key, width: c.width }));

  // ── 1행 · 타이틀 배너 (풀 폭 병합) ─────────────────────────────
  ws.mergeCells(1, 1, 1, COLUMNS.length);
  const title = ws.getCell(1, 1);
  title.value = "🛍️  CREAM  상품 일괄 등록 템플릿";
  title.font = { name: "맑은 고딕", size: 18, bold: true, color: { argb: HEADER_FONT } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND } };
  ws.getRow(1).height = 44;

  // ── 2행 · 서브타이틀 ───────────────────────────────────────
  ws.mergeCells(2, 1, 2, COLUMNS.length);
  const subtitle = ws.getCell(2, 1);
  subtitle.value = "6행부터 실제 데이터를 입력하세요 · 4행 예시는 자동 제외됩니다 (그대로 두거나 삭제 무관)";
  subtitle.font = { name: "맑은 고딕", size: 11, color: { argb: "FF6B7280" }, italic: true };
  subtitle.alignment = { vertical: "middle", horizontal: "center" };
  subtitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
  ws.getRow(2).height = 24;

  // ── 3행 · 안내 배너 ───────────────────────────────────────
  ws.mergeCells(3, 1, 3, COLUMNS.length);
  const note = ws.getCell(3, 1);
  note.value = "⚠  이미지는 이 파일로 등록되지 않습니다 · 등록 후 상품 목록에서 「이미지 라이브러리」로 첨부";
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

  // ── 데이터 검증 · 판매상태 드롭다운 ────────────────────────
  const isActiveCol = COLUMNS.findIndex((c) => c.key === "is_active") + 1;
  for (let r = 6; r < 6 + INPUT_ROWS; r++) {
    ws.getCell(r, isActiveCol).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: ['"판매중,숨김"'],
      showErrorMessage: true,
      errorStyle: "warning",
      errorTitle: "잘못된 값",
      error: "「판매중」 또는 「숨김」 중 하나를 선택하세요",
    };
  }

  // ── 데이터 검증 · 숫자 필드 ─────────────────────────────
  const priceCol = COLUMNS.findIndex((c) => c.key === "price") + 1;
  const originalPriceCol = COLUMNS.findIndex((c) => c.key === "original_price") + 1;
  const stockCol = COLUMNS.findIndex((c) => c.key === "stock") + 1;
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
    ws.getCell(r, stockCol).dataValidation = numericValidation;
    // 숫자 포맷 (통화 아님 · 순수 숫자 · 소수점 없음)
    ws.getCell(r, priceCol).numFmt = "#,##0";
    ws.getCell(r, originalPriceCol).numFmt = "#,##0";
    ws.getCell(r, stockCol).numFmt = "#,##0";
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
    ["📝 입력 시작 위치", "「상품 일괄 등록」 시트의 6행부터 실제 데이터 입력. 4행 예시는 자동 제외됩니다."],
    ["✅ 필수 항목", "상품명(일본어) · 가격 · 카테고리"],
    ["🈶 카테고리", "관리자포털 「카테고리 관리」에 등록된 일본어 명칭과 정확히 일치해야 함 (예: アクセサリー)"],
    ["🖼 이미지", "이 파일로는 등록되지 않습니다. 등록 후 상품 목록 → 상품 클릭 → 「이미지 라이브러리에서 선택」 또는 신규 업로드"],
    ["🔢 숫자 필드", "가격 · 정가 · 재고 → 0 이상의 정수만. 공란 허용."],
    ["🏷 판매상태", "「판매중」 또는 「숨김」 · 셀 클릭 시 드롭다운 표시"],
    ["💾 저장", "엑셀에서 저장할 때 → CSV(UTF-8) 로 저장하시거나 · xlsx 그대로 업로드 가능"],
    ["📤 업로드", "관리자포털 → 상품 관리 → 「CSV 일괄 등록」 → 파일 선택"],
    ["⚠ 주의", "예시 행([예시] 접두 · 노란색)은 절대 등록되지 않으니 안심하고 남겨두세요"],
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

// xlsx 업로드 → 파싱 · CSV와 동일한 { 한글헤더: 값 } 객체 배열 반환
export async function parseXlsxToObjects(file: File): Promise<Record<string, string>[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];

  // 헤더 행 · 5행 (템플릿 규격) · 다만 임의 xlsx는 1행 가정
  // 첫 유효 행 = 헤더 로 자동 탐지
  let headerRowIdx = -1;
  const headerCandidates = ["상품명(일본어)", "상품명 (일본어)", "상품명(한국어)", "상품명 (한국어)", "가격", "카테고리"];
  ws.eachRow((row, rowNumber) => {
    if (headerRowIdx > 0) return;
    const values = row.values as (string | number | undefined)[];
    if (!values) return;
    const strs = values.map((v) => String(v ?? "").trim());
    if (headerCandidates.some((h) => strs.includes(h))) headerRowIdx = rowNumber;
  });
  if (headerRowIdx < 0) return [];

  // 헤더 배열 · "필수*" 표기 정리 · 공백 통일
  const headerRow = ws.getRow(headerRowIdx);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const raw = String(cell.value ?? "").trim();
    // "상품명 (일본어) *" → "상품명(일본어)" 로 정규화
    const cleaned = raw.replace(/\s*\*\s*$/, "").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").trim();
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
