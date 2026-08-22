"use client";

// 매장 화면 커스터마이징 · 휴지통
// - 소프트 삭제된 프리셋 목록
// - 20일 경과 시 자동 영구 삭제 안내
// - 되돌리기 · 지금 영구 삭제

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { TRASH_RETENTION_DAYS } from "@/lib/shopUiSchema";

interface Preset {
  id: number;
  name: string;
  description: string | null;
  deleted_at: string;
  updated_at: string;
}

export default function TrashPage() {
  const [rows, setRows] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error } = await supabase
      .from("shop_ui_presets")
      .select("*")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) setError(error.message);
    else setRows((data as Preset[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const restore = async (row: Preset) => {
    if (!confirm(`「${row.name}」 을 되돌립니다.\n\n계속하시겠어요?`)) return;
    setBusy(row.id);
    const { error } = await supabase.from("shop_ui_presets").update({ deleted_at: null }).eq("id", row.id);
    setBusy(null);
    if (error) setMsg("되돌리기 실패: " + error.message);
    else { setMsg(`「${row.name}」 을 되돌렸어요`); load(); }
  };

  const purge = async (row: Preset) => {
    if (!confirm(`「${row.name}」 을 영구 삭제합니다.\n\n이 작업은 되돌릴 수 없어요.\n계속하시겠어요?`)) return;
    setBusy(row.id);
    const { error } = await supabase.from("shop_ui_presets").delete().eq("id", row.id);
    setBusy(null);
    if (error) setMsg("영구 삭제 실패: " + error.message);
    else { setMsg("영구 삭제되었어요"); load(); }
  };

  const daysLeft = (deletedAt: string): number => {
    const deleted = new Date(deletedAt).getTime();
    const gone = new Date().getTime() - deleted;
    const passedDays = Math.floor(gone / (1000 * 60 * 60 * 24));
    return Math.max(0, TRASH_RETENTION_DAYS - passedDays);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/customize" className="hover:text-gray-700">← 편집으로</Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">🗑 휴지통</h1>
        <p className="text-sm text-gray-500 mt-1">
          삭제한 화면은 <b>{TRASH_RETENTION_DAYS}일</b> 뒤에 자동으로 영구 삭제돼요. 그 전에 되돌리실 수 있어요.
        </p>
      </div>

      {msg && (
        <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{msg}</div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">휴지통이 비어있어요</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {rows.map((r, idx) => {
            const left = daysLeft(r.deleted_at);
            return (
              <div key={r.id} className={`p-4 flex items-center gap-3 flex-wrap ${idx > 0 ? "border-t border-gray-100" : ""}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-700">{r.name}</p>
                  {r.description && <p className="text-[11px] text-gray-500 mt-0.5">{r.description}</p>}
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    삭제일: {new Date(r.deleted_at).toLocaleString("ko-KR")}
                    <span className={`ml-2 font-semibold ${left <= 3 ? "text-red-600" : left <= 7 ? "text-amber-600" : "text-gray-500"}`}>
                      · 영구 삭제까지 {left}일 남음
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => restore(r)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium disabled:opacity-40"
                  >
                    ↺ 되돌리기
                  </button>
                  <button
                    onClick={() => purge(r)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    지금 영구 삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800 leading-relaxed">
        💡 자동 영구 삭제는 시스템이 매일 새벽에 확인해요. {TRASH_RETENTION_DAYS}일이 지난 화면은 그때 지워집니다.
      </div>
    </div>
  );
}
