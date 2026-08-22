"use client";

// 리뷰 대기목록 · 발행 전 리뷰 draft 관리
// - 소스별 필터 (엑셀/AI/수동) · 상태별 필터
// - 다중 선택 · 삭제 · 즉시 발행
// - 스케줄 설정 화면 · 발행 링크
// - AI 이상하면 여기서 걸러내기 → 사장님 요청 시나리오

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

interface Draft {
  id: number;
  product_id: number | null;
  rating: number;
  author_name: string | null;
  content: string;
  images: string[];
  source: "manual" | "excel" | "ai" | "bulk";
  status: "queued" | "published" | "rejected" | "error";
  scheduled_at: string | null;
  published_at: string | null;
  error_message: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const SOURCE_LABEL: Record<Draft["source"], string> = {
  manual: "수동",
  excel: "엑셀",
  ai: "AI",
  bulk: "일괄",
};
const SOURCE_COLOR: Record<Draft["source"], string> = {
  manual: "bg-blue-100 text-blue-700",
  excel: "bg-emerald-100 text-emerald-700",
  ai: "bg-purple-100 text-purple-700",
  bulk: "bg-amber-100 text-amber-700",
};
const STATUS_LABEL: Record<Draft["status"], string> = {
  queued: "대기 중",
  published: "발행됨",
  rejected: "반려",
  error: "오류",
};

export default function ReviewStagingPage() {
  const [rows, setRows] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<Draft["status"] | "all">("queued");
  const [filterSource, setFilterSource] = useState<Draft["source"] | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("review_drafts").select("*").order("created_at", { ascending: false }).limit(500);
    if (filterStatus !== "all") q = q.eq("status", filterStatus);
    if (filterSource !== "all") q = q.eq("source", filterSource);
    const { data, error } = await q;
    if (error) setMsg("불러오지 못했어요: " + error.message);
    else setRows((data as Draft[]) ?? []);
    setLoading(false);
  }, [filterStatus, filterSource]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      r.content.toLowerCase().includes(q) ||
      (r.author_name || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    const s = { queued: 0, published: 0, rejected: 0, error: 0 };
    rows.forEach((r) => { s[r.status]++; });
    return s;
  }, [rows]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.id)));
  };

  const publishSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개 리뷰를 지금 즉시 발행합니다.\n\n대기목록에서 실제 매장 리뷰로 이관됩니다.\n계속하시겠어요?`)) return;
    setBusy(true);
    const res = await fetch("/api/reviews/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    const json = await res.json();
    setBusy(false);
    if (res.ok) {
      setMsg(`즉시 발행 완료 · ${json.ok}건 성공${json.failed ? ` · ${json.failed}건 실패` : ""}`);
      setSelected(new Set());
      load();
    } else {
      setMsg("발행 실패: " + (json.error || "알 수 없는 오류"));
    }
  };

  const rejectSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개를 반려 처리합니다.\n대기목록에서 빠집니다. (기록은 남음)`)) return;
    setBusy(true);
    const { error } = await supabase.from("review_drafts").update({ status: "rejected" }).in("id", Array.from(selected));
    setBusy(false);
    if (error) setMsg("반려 실패: " + error.message);
    else { setMsg(`${selected.size}건 반려됨`); setSelected(new Set()); load(); }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`선택한 ${selected.size}개를 영구 삭제합니다.\n\n이 작업은 되돌릴 수 없어요.`)) return;
    setBusy(true);
    const { error } = await supabase.from("review_drafts").delete().in("id", Array.from(selected));
    setBusy(false);
    if (error) setMsg("삭제 실패: " + error.message);
    else { setMsg(`${selected.size}건 영구 삭제됨`); setSelected(new Set()); load(); }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">
            <Link href="/reviews" className="hover:text-gray-700">← 리뷰 관리</Link>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">📋 리뷰 대기목록</h1>
          <p className="text-sm text-gray-500 mt-1">
            발행 전 리뷰를 여기서 확인 · 이상하면 반려 · 이상 없으면 스케줄대로 자동 발행
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/reviews/schedule" className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded-lg hover:bg-gray-800 font-medium">⚙ 스케줄 설정</Link>
          <Link href="/reviews/import" className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium">📥 엑셀로 대기 리뷰 올리기</Link>
        </div>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatCard label="대기 중" value={stats.queued} color="amber" />
        <StatCard label="발행됨" value={stats.published} color="emerald" />
        <StatCard label="반려" value={stats.rejected} color="gray" />
        <StatCard label="오류" value={stats.error} color="red" />
      </div>

      {msg && (
        <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">{msg}</div>
      )}

      {/* 필터 */}
      <div className="mb-3 p-3 bg-white rounded-xl border border-gray-200 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-500">상태:</span>
        {(["queued", "published", "rejected", "error", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-2.5 py-1 text-xs rounded border ${filterStatus === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {s === "all" ? "전체" : STATUS_LABEL[s as Draft["status"]]}
          </button>
        ))}
        <span className="mx-2 text-gray-300">|</span>
        <span className="text-xs text-gray-500">소스:</span>
        {(["all", "manual", "excel", "ai", "bulk"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterSource(s)}
            className={`px-2.5 py-1 text-xs rounded border ${filterSource === s ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
          >
            {s === "all" ? "전체" : SOURCE_LABEL[s as Draft["source"]]}
          </button>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="내용 · 작성자 검색"
          className="ml-auto text-xs px-3 py-1.5 border border-gray-200 rounded-lg w-52"
        />
      </div>

      {/* 액션 바 */}
      {selected.size > 0 && (
        <div className="mb-3 p-3 rounded-lg bg-gray-900 text-white flex items-center justify-between gap-2">
          <span className="text-sm">{selected.size}개 선택</span>
          <div className="flex items-center gap-2">
            <button onClick={publishSelected} disabled={busy} className="px-3 py-1 text-xs bg-emerald-500 rounded hover:bg-emerald-600 disabled:opacity-40">
              🚀 즉시 발행
            </button>
            <button onClick={rejectSelected} disabled={busy} className="px-3 py-1 text-xs bg-amber-500 rounded hover:bg-amber-600 disabled:opacity-40">
              🚫 반려
            </button>
            <button onClick={deleteSelected} disabled={busy} className="px-3 py-1 text-xs bg-red-500 rounded hover:bg-red-600 disabled:opacity-40">
              🗑 영구 삭제
            </button>
            <button onClick={() => setSelected(new Set())} className="px-3 py-1 text-xs text-gray-300 hover:text-white">해제</button>
          </div>
        </div>
      )}

      {/* 리스트 */}
      {loading ? (
        <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          <p>대기 리뷰가 없어요</p>
          <p className="text-[11px] mt-1">「📥 엑셀로 대기 리뷰 올리기」 로 여러 개를 미리 담아두실 수 있어요</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50 flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleAll}
              className="accent-gray-900"
            />
            <span className="text-gray-500">전체 선택 · 총 {filtered.length}건</span>
          </div>
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`p-3 border-t border-gray-100 flex items-start gap-3 ${selected.has(r.id) ? "bg-blue-50/40" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
                className="mt-1 accent-gray-900"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${SOURCE_COLOR[r.source]}`}>{SOURCE_LABEL[r.source]}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${
                    r.status === "queued" ? "bg-amber-100 text-amber-800"
                    : r.status === "published" ? "bg-emerald-100 text-emerald-800"
                    : r.status === "rejected" ? "bg-gray-200 text-gray-700"
                    : "bg-red-100 text-red-800"
                  }`}>{STATUS_LABEL[r.status]}</span>
                  <span className="text-xs">
                    {"★".repeat(r.rating)}<span className="text-gray-300">{"★".repeat(5 - r.rating)}</span>
                  </span>
                  <span className="text-xs text-gray-500">{r.author_name || "익명"}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{new Date(r.created_at).toLocaleString("ko-KR")}</span>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap line-clamp-3">{r.content}</p>
                {r.images.length > 0 && (
                  <div className="mt-1.5 flex gap-1">
                    {r.images.slice(0, 5).map((u, i) => (
                      <div key={i} className="relative w-12 h-12 rounded border border-gray-200 overflow-hidden bg-gray-50">
                        <Image src={u} alt="" fill unoptimized className="object-cover" />
                      </div>
                    ))}
                  </div>
                )}
                {r.error_message && (
                  <p className="text-[10.5px] text-red-600 mt-1">오류: {r.error_message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: "amber" | "emerald" | "gray" | "red" }) {
  const cls = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
    red: "bg-red-50 border-red-200 text-red-800",
  }[color];
  return (
    <div className={`p-3 rounded-xl border ${cls}`}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="text-2xl font-bold mt-0.5">{value.toLocaleString()}</p>
    </div>
  );
}
