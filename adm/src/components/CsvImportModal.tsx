"use client";
// 상품 일괄 등록 모달 · xlsx + csv 지원
// 드래그&드롭 파일 → 미리보기 → 등록 → 결과 리포트
// 템플릿: 스타일링된 xlsx (브랜드 컬러 · 안내시트 · 데이터 검증 드롭다운)

import { useRef, useState } from "react";
import { parseCsvToObjects } from "@/lib/csv";
import { downloadProductTemplate, parseXlsxToObjects } from "@/lib/xlsxTemplate";

export interface CsvImportResult {
  ok: number;
  failed: { row: number; reason: string }[];
  /** 등록 성공한 상품 ID 목록 · 이미지 매핑 페이지 진입에 사용 */
  okIds?: number[];
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<CsvImportResult>;
  /** 하위호환용 · 신규 UI에서는 xlsxTemplate.ts 고정 정의 사용 */
  templateHeader?: string[];
  templateSample?: Record<string, string>;
  title?: string;
}

export default function CsvImportModal({
  open,
  onClose,
  onImport,
  title,
}: CsvImportModalProps) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setResult(null);
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
        const parsed = await parseXlsxToObjects(file);
        setRows(parsed);
      } else {
        const text = await file.text();
        const parsed = parseCsvToObjects(text);
        setRows(parsed);
      }
    } catch (err) {
      console.error("파일 파싱 실패:", err);
      alert("파일을 읽을 수 없습니다. 템플릿 형식을 확인해주세요.");
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setBusy(true);
    try {
      const r = await onImport(rows);
      setResult(r);
    } catch (e) {
      console.error(e);
      setResult({ ok: 0, failed: [{ row: 0, reason: String(e) }] });
    }
    setBusy(false);
  };

  const downloadTemplate = async () => {
    await downloadProductTemplate();
  };

  const reset = () => {
    setRows([]);
    setFileName("");
    setResult(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">{title || "파일 일괄 등록 · xlsx / csv"}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* 템플릿 다운로드 · 재설계 */}
          <div className="rounded-xl border border-[var(--color-brand)]/25 bg-gradient-to-br from-[var(--color-brand)]/5 to-transparent overflow-hidden">
            {/* 헤더 · 브랜드 배너 */}
            <div className="px-4 py-3 bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-dk)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛍️</span>
                <div>
                  <p className="text-[13px] font-semibold text-white leading-tight">1️⃣ 스타일링된 xlsx 템플릿 다운로드</p>
                  <p className="text-[10.5px] text-white/85 mt-0.5">엑셀에서 열면 · 드롭다운 · 안내시트 · 컬럼 폭 세팅 완료</p>
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="px-3.5 py-2 text-[12.5px] bg-white text-[var(--color-brand-dk)] rounded-lg hover:bg-white/90 transition whitespace-nowrap font-semibold shadow-md flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                XLSX 다운로드
              </button>
            </div>
            {/* 특징 · 3분할 카드 */}
            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="rounded-lg bg-white border border-gray-100 p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">디자인</p>
                <p className="text-[11.5px] text-gray-700 font-medium mt-0.5">브랜드 컬러 헤더</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">타이틀 · 서브 · 컬럼 배너</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">편의</p>
                <p className="text-[11.5px] text-gray-700 font-medium mt-0.5">드롭다운 검증</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">판매상태 · 숫자 필드</p>
              </div>
              <div className="rounded-lg bg-white border border-gray-100 p-2.5">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider">안심</p>
                <p className="text-[11.5px] text-gray-700 font-medium mt-0.5">예시 자동 제외</p>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">노란색 [예시] 행</p>
              </div>
            </div>
            {/* 안내 배너 */}
            <div className="mx-3 mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-[11px] text-amber-900 leading-relaxed">
                📌 <b>이미지</b>는 파일에 포함하지 않습니다 · 등록 후 상품 목록에서 「이미지 라이브러리」로 첨부<br />
                📌 <b>카테고리 · 하위카테고리</b>는 「카테고리 관리」의 <b>일본어 명칭</b>과 정확히 일치<br />
                📌 <b>업로드 파일</b>: <code>.xlsx</code> · <code>.csv</code> 모두 지원 (엑셀에서 「다른 이름으로 저장」 가능)
              </p>
            </div>
          </div>

          {/* 업로드 영역 */}
          {rows.length === 0 && !result && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files[0];
                if (file) handleFile(file);
              }}
              onClick={() => inputRef.current?.click()}
              className={
                "border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition " +
                (dragOver
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-400")
              }
            >
              <svg
                className="w-10 h-10 mx-auto text-gray-400 mb-3"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M12 15V3M7 8l5-5 5 5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              <p className="text-sm text-gray-700">
                파일을 <span className="font-medium">드래그&드롭</span>하거나 클릭
              </p>
              <p className="text-xs text-gray-400 mt-1">.xlsx · .csv (UTF-8)</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
                className="hidden"
              />
            </div>
          )}

          {/* 미리보기 */}
          {rows.length > 0 && !result && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  <span className="font-medium">{fileName}</span> —{" "}
                  <span className="text-gray-500">{rows.length}행 로드됨</span>
                </p>
                <button
                  onClick={reset}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  다시 선택
                </button>
              </div>
              <div className="border border-gray-200 rounded-lg overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      {Object.keys(rows[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-medium text-gray-500 whitespace-nowrap">
                          {k}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i}>
                        {Object.keys(rows[0]).map((k) => (
                          <td key={k} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                            {r[k]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length > 10 && (
                <p className="text-xs text-gray-400">... 그 외 {rows.length - 10}행 (미리보기 생략)</p>
              )}
            </div>
          )}

          {/* 결과 리포트 */}
          {result && (
            <div className="space-y-3">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm">
                  <span className="text-green-700 font-medium">성공 {result.ok}건</span>
                  {result.failed.length > 0 && (
                    <>
                      {" · "}
                      <span className="text-red-700 font-medium">실패 {result.failed.length}건</span>
                    </>
                  )}
                </p>
              </div>
              {/* 매핑 페이지 진입 CTA · 성공 등록 건이 있을 때만 */}
              {result.ok > 0 && result.okIds && result.okIds.length > 0 && (
                <div className="p-4 rounded-xl border border-[var(--color-brand)]/25 bg-gradient-to-br from-[var(--color-brand)]/10 to-transparent">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-brand-dk)] mb-1">📸 다음 단계 · 이미지 매핑</p>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        방금 등록된 <b>{result.ok}건</b>은 이미지가 없습니다.<br />
                        매핑 페이지에서 이미지를 업로드하고 한 번에 여러 상품에 연결하세요.
                      </p>
                    </div>
                    <a
                      href={`/products/image-mapping?scope=ids&ids=${result.okIds.join(",")}`}
                      className="px-4 py-2 text-sm bg-[var(--color-brand)] text-white rounded-lg hover:bg-[var(--color-brand-dk)] font-medium shadow-sm whitespace-nowrap flex items-center gap-1.5"
                    >
                      매핑하러 가기 →
                    </a>
                  </div>
                </div>
              )}
              {result.failed.length > 0 && (
                <div className="border border-red-200 rounded-lg overflow-auto max-h-48">
                  <table className="w-full text-xs">
                    <thead className="bg-red-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-red-700">행</th>
                        <th className="px-3 py-2 text-left font-medium text-red-700">사유</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {result.failed.map((f, i) => (
                        <tr key={i}>
                          <td className="px-3 py-2 text-red-800">{f.row}</td>
                          <td className="px-3 py-2 text-red-700">{f.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            닫기
          </button>
          {rows.length > 0 && !result && (
            <button
              onClick={handleImport}
              disabled={busy}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {busy ? "등록 중..." : `${rows.length}건 등록`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
