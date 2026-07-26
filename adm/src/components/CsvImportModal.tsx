"use client";
// CSV 일괄 등록 모달
// 드래그&드롭 파일 → 미리보기 → 등록 → 결과 리포트

import { useRef, useState } from "react";
import { parseCsvToObjects, downloadCsv } from "@/lib/csv";

export interface CsvImportResult {
  ok: number;
  failed: { row: number; reason: string }[];
}

interface CsvImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (rows: Record<string, string>[]) => Promise<CsvImportResult>;
  templateHeader: string[];
  templateSample?: Record<string, string>;
  title?: string;
}

export default function CsvImportModal({
  open,
  onClose,
  onImport,
  templateHeader,
  templateSample,
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
    const text = await file.text();
    const parsed = parseCsvToObjects(text);
    setRows(parsed);
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

  const downloadTemplate = () => {
    const sampleRow = templateSample || Object.fromEntries(templateHeader.map((h) => [h, ""]));
    const csvContent =
      "﻿" +
      templateHeader.join(",") +
      "\r\n" +
      templateHeader
        .map((h) => {
          const v = sampleRow[h] || "";
          return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        })
        .join(",");
    downloadCsv(csvContent, "template.csv");
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
          <h3 className="text-lg font-medium text-gray-900">{title || "CSV 일괄 등록"}</h3>
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
          {/* 템플릿 다운로드 */}
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-700 font-medium">먼저 템플릿을 받으세요</p>
              <p className="text-xs text-gray-500 mt-0.5">
                컬럼: {templateHeader.join(" · ")}
              </p>
            </div>
            <button
              onClick={downloadTemplate}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition whitespace-nowrap"
            >
              📥 템플릿 CSV
            </button>
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
                CSV 파일을 <span className="font-medium">드래그&드롭</span>하거나 클릭
              </p>
              <p className="text-xs text-gray-400 mt-1">UTF-8, 첫 줄 = 컬럼명</p>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,text/csv"
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
