// CSV 유틸 - 상품 대량 등록/내보내기용
// RFC 4180 준거 (컴마·따옴표·개행 처리)

export interface CsvColumn<T> {
  key: keyof T | string;
  label: string;
  toCell?: (row: T) => string | number | null | undefined;
  fromCell?: (value: string) => unknown;
}

// ── 이스케이프 ─────────────────────────────────────────
function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ── 생성 ───────────────────────────────────────────────
export function generateCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = c.toCell ? c.toCell(row) : (row as Record<string, unknown>)[c.key as string];
          return escapeCell(raw);
        })
        .join(",")
    )
    .join("\r\n");
  return "﻿" + header + "\r\n" + body; // BOM (엑셀 UTF-8 인식)
}

// ── 다운로드 ───────────────────────────────────────────
export function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 파싱 (한 줄 = 한 레코드, 큰따옴표 안 개행 지원) ─────
export function parseCsv(text: string): string[][] {
  // BOM 제거
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuote = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];

    if (inQuote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        cur.push(cell);
        cell = "";
      } else if (ch === "\r") {
        // CRLF 처리
      } else if (ch === "\n") {
        cur.push(cell);
        rows.push(cur);
        cur = [];
        cell = "";
      } else {
        cell += ch;
      }
    }
  }
  if (cell !== "" || cur.length > 0) {
    cur.push(cell);
    rows.push(cur);
  }
  return rows.filter((r) => r.length > 0 && r.some((c) => c !== ""));
}

// ── 파싱 → 객체 배열 (header 자동) ─────────────────────
export function parseCsvToObjects(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0];
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      obj[h.trim()] = (r[i] ?? "").trim();
    });
    return obj;
  });
}
