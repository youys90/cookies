"use client";
// 인라인 편집 셀 - 클릭하면 input, Enter=저장, Esc=취소

import { useEffect, useRef, useState } from "react";

interface InlineEditCellProps {
  value: number | string;
  onSave: (newValue: number | string) => Promise<void>;
  type?: "number" | "text";
  suffix?: string;
  className?: string;
  format?: (v: number | string) => string;
  min?: number;
}

export default function InlineEditCell({
  value,
  onSave,
  type = "text",
  suffix,
  className,
  format,
  min,
}: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(String(value));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = async () => {
    if (busy) return;
    let next: number | string = draft;
    if (type === "number") {
      const n = Number(draft);
      if (Number.isNaN(n)) {
        setDraft(String(value));
        setEditing(false);
        return;
      }
      if (min !== undefined && n < min) next = min;
      else next = n;
    }
    if (next === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onSave(next);
      setEditing(false);
    } catch (e) {
      console.error(e);
      setDraft(String(value));
    }
    setBusy(false);
  };

  if (editing) {
    return (
      <div className="inline-flex items-center gap-1">
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") {
              setDraft(String(value));
              setEditing(false);
            }
          }}
          disabled={busy}
          className={
            "px-2 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-900 " +
            (type === "number" ? "w-24 text-right" : "w-40") +
            (className ? " " + className : "")
          }
        />
        {suffix && <span className="text-xs text-gray-400">{suffix}</span>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={
        "text-sm text-left hover:bg-yellow-50 rounded px-1 -mx-1 transition cursor-pointer " +
        (className || "")
      }
      title="클릭하여 편집"
    >
      {format ? format(value) : value}
      {suffix && <span className="text-xs text-gray-400 ml-0.5">{suffix}</span>}
    </button>
  );
}
