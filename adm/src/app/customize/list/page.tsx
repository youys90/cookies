"use client";

// 매장 화면 커스터마이징 · 저장된 프리셋 목록
// - 활성화 · 편집 · 이름 바꾸기 · 삭제(휴지통으로)

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

interface Preset {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export default function PresetListPage() {
  const [rows, setRows] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    // 목록에 표시할 대상:
    // - 사장님이 「이름 붙여 저장」한 프리셋 (description 마커 있음)
    // - 그 외 사장님이 명시적으로 만든 이름 (name이 자동 이름 「관리자 저장 화면 · 」로 시작하지 않는 것)
    // 자동 저장 (doSave)로 만들어진 「관리자 저장 화면 · ...」 이름 프리셋은 · 매장 반영용 · 목록에서 제외
    const { data, error } = await supabase
      .from("shop_ui_presets")
      .select("*")
      .is("deleted_at", null)
      .order("is_active", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) {
      setError(error.message);
    } else {
      const all = (data as Preset[]) ?? [];
      const shown = all.filter((p) => !p.name.startsWith("관리자 저장 화면 ·"));
      setRows(shown);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activate = async (id: number, name: string) => {
    if (!confirm(`「${name}」 화면으로 매장을 바꿉니다.\n\n계속하시겠어요?`)) return;
    setBusy(id);
    // 다른 프리셋 비활성화
    await supabase.from("shop_ui_presets").update({ is_active: false }).eq("is_active", true).is("deleted_at", null);
    // 이 프리셋 활성화
    const { error } = await supabase.from("shop_ui_presets").update({ is_active: true }).eq("id", id);
    setBusy(null);
    if (error) setMsg("변경 실패: " + error.message);
    else {
      setMsg(`「${name}」 화면으로 매장이 바뀌었어요`);
      load();
    }
  };

  const rename = async (row: Preset) => {
    const name = prompt("새 이름을 입력해주세요", row.name);
    if (!name || name === row.name) return;
    setBusy(row.id);
    const { error } = await supabase.from("shop_ui_presets").update({ name }).eq("id", row.id);
    setBusy(null);
    if (error) setMsg("변경 실패: " + error.message);
    else { setMsg("이름을 바꿨어요"); load(); }
  };

  const softDelete = async (row: Preset) => {
    if (row.is_default) return alert("기본 화면은 삭제할 수 없어요");
    if (row.is_active) return alert("지금 매장에 반영된 화면은 삭제할 수 없어요.\n먼저 다른 화면을 활성화해주세요.");
    if (!confirm(`「${row.name}」 을 휴지통으로 옮깁니다.\n\n20일 안에 휴지통에서 되돌릴 수 있어요.\n\n계속하시겠어요?`)) return;
    setBusy(row.id);
    const { error } = await supabase.from("shop_ui_presets").update({ deleted_at: new Date().toISOString() }).eq("id", row.id);
    setBusy(null);
    if (error) setMsg("삭제 실패: " + error.message);
    else { setMsg("휴지통으로 옮겼어요"); load(); }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">
            <Link href="/customize" className="hover:text-gray-700">← 편집으로</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">📚 저장된 매장 화면 목록</h1>
          <p className="text-sm text-gray-500 mt-1">
            사장님이 만들어둔 화면들이에요. 언제든 활성화해서 매장에 다시 반영할 수 있어요.
          </p>
        </div>
        <Link href="/customize/trash" className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">🗑 휴지통</Link>
      </div>

      {msg && (
        <div className="mb-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
          {msg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">저장된 화면이 아직 없어요</div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {rows.map((r, idx) => (
            <div
              key={r.id}
              className={`p-4 flex items-center gap-3 flex-wrap ${idx > 0 ? "border-t border-gray-100" : ""} ${r.is_active ? "bg-emerald-50/40" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-gray-900">{r.name}</p>
                  {r.is_active && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500 text-white rounded-full">🟢 지금 매장에 반영됨</span>}
                  {r.is_default && <span className="text-[10px] px-1.5 py-0.5 bg-gray-500 text-white rounded-full">기본</span>}
                </div>
                {r.description && <p className="text-[11px] text-gray-500 mt-0.5">{r.description}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  마지막 저장: {new Date(r.updated_at).toLocaleString("ko-KR")}
                </p>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!r.is_active && (
                  <button
                    onClick={() => activate(r.id, r.name)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 text-xs bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 font-medium disabled:opacity-40"
                  >
                    ✓ 이 화면으로 바꾸기
                  </button>
                )}
                <Link
                  href={`/customize?load=${r.id}`}
                  className="px-3 py-1.5 text-xs text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  ✎ 편집
                </Link>
                {!r.is_default && (
                  <button
                    onClick={() => rename(r)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    이름 바꾸기
                  </button>
                )}
                {!r.is_default && !r.is_active && (
                  <button
                    onClick={() => softDelete(r)}
                    disabled={busy === r.id}
                    className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    🗑 삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
