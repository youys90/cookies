"use client";

// 리뷰 스케줄 설정 · 대기목록에서 실제 리뷰로 · 몇 개씩 · 몇 시간마다 발행할지

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import FormActionBar from "@/components/FormActionBar";

interface Schedule {
  id: number;
  name: string;
  rate_per_unit: number;
  unit: "hour" | "day" | "week" | "month";
  order_mode: "sequential" | "random";
  active_from: string | null;
  active_to: string | null;
  is_enabled: boolean;
  last_tick_at: string | null;
  last_published_at: string | null;
  published_count: number;
}

const UNIT_LABEL: Record<Schedule["unit"], string> = {
  hour: "시간",
  day: "일",
  week: "주",
  month: "월",
};

export default function ReviewSchedulePage() {
  const [s, setS] = useState<Schedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("review_schedule").select("*").eq("id", 1).maybeSingle();
    if (data) setS(data as Schedule);
    const { count } = await supabase.from("review_drafts").select("*", { count: "exact", head: true }).eq("status", "queued");
    setQueuedCount(count ?? 0);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const update = (patch: Partial<Schedule>) => {
    if (!s) return;
    setS({ ...s, ...patch });
    setMsg("");
  };

  const save = async () => {
    if (!s) return;
    setSaving(true);
    const { error } = await supabase.from("review_schedule").update({
      name: s.name,
      rate_per_unit: s.rate_per_unit,
      unit: s.unit,
      order_mode: s.order_mode,
      active_from: s.active_from || null,
      active_to: s.active_to || null,
      is_enabled: s.is_enabled,
    }).eq("id", 1);
    setSaving(false);
    if (error) setMsg("저장 실패: " + error.message);
    else { setMsg("저장 완료"); load(); }
  };

  const tickNow = async () => {
    if (!confirm("지금 즉시 · 스케줄 규칙 1회 실행합니다.\n대기목록에서 설정한 개수만큼 실제 리뷰로 발행됩니다.\n\n계속하시겠어요?")) return;
    setSaving(true);
    const res = await fetch("/api/reviews/tick", { method: "POST" });
    const json = await res.json();
    setSaving(false);
    if (res.ok) setMsg(`실행 완료 · ${json.published}건 발행`);
    else setMsg("실행 실패: " + (json.error || "알 수 없는 오류"));
    load();
  };

  if (loading || !s) return <div className="p-10 text-center text-gray-400 text-sm">불러오는 중...</div>;

  const nextTick = s.last_tick_at
    ? new Date(new Date(s.last_tick_at).getTime() + msPerUnit(s.unit)).toLocaleString("ko-KR")
    : "다음 실행 시 즉시";

  return (
    <div className="p-6 max-w-3xl mx-auto pb-24">
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">
          <Link href="/reviews/staging" className="hover:text-gray-700">← 대기목록으로</Link>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">⚙ 리뷰 스케줄 설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          대기목록의 리뷰를 몇 개씩 · 얼마 간격으로 · 어떤 순서로 발행할지 설정
        </p>
      </div>

      {/* 상태 요약 */}
      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-[11px] text-blue-800/70 font-medium">현재 상태</p>
            <p className="text-lg font-bold mt-0.5">{s.is_enabled ? "🟢 실행 중" : "⏸ 정지"}</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-800/70 font-medium">대기 리뷰</p>
            <p className="text-lg font-bold mt-0.5">{queuedCount}건</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-800/70 font-medium">발행 누계</p>
            <p className="text-lg font-bold mt-0.5">{s.published_count}건</p>
          </div>
          <div>
            <p className="text-[11px] text-blue-800/70 font-medium">다음 실행 예정</p>
            <p className="text-[11px] font-mono mt-0.5">{s.is_enabled ? nextTick : "-"}</p>
          </div>
        </div>
      </div>

      {msg && <div className="mb-3 p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">{msg}</div>}

      {/* 설정 폼 */}
      <div className="space-y-4">
        {/* 활성 스위치 */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={s.is_enabled}
              onChange={(e) => update({ is_enabled: e.target.checked })}
              className="w-5 h-5 accent-emerald-500"
            />
            <div>
              <p className="text-sm font-bold text-gray-900">스케줄 활성화</p>
              <p className="text-xs text-gray-500">체크 시 · 아래 규칙대로 자동 발행 시작 · 해제 시 정지</p>
            </div>
          </label>
        </div>

        {/* 발행 속도 */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">📅 발행 속도</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              min={1}
              max={500}
              value={s.rate_per_unit}
              onChange={(e) => update({ rate_per_unit: Number(e.target.value) || 1 })}
              className="w-20 px-3 py-2 text-center border border-gray-200 rounded-lg font-semibold"
            />
            <span className="text-sm text-gray-700">개씩 ·</span>
            <select
              value={s.unit}
              onChange={(e) => update({ unit: e.target.value as Schedule["unit"] })}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            >
              <option value="hour">1시간</option>
              <option value="day">1일</option>
              <option value="week">1주</option>
              <option value="month">1개월</option>
            </select>
            <span className="text-sm text-gray-700">마다 발행</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            예 · 「3개씩 1일 마다」 → 하루에 3건씩 · 대기 리뷰가 100건이면 약 34일에 걸쳐 발행
          </p>
        </div>

        {/* 발행 순서 */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">🔀 발행 순서</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => update({ order_mode: "sequential" })}
              className={`p-3 rounded-lg border-2 text-left ${s.order_mode === "sequential" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <p className="text-sm font-bold text-gray-900">순서대로 (오래된 것부터)</p>
              <p className="text-[11px] text-gray-500 mt-0.5">먼저 대기한 리뷰가 먼저 나가요</p>
            </button>
            <button
              onClick={() => update({ order_mode: "random" })}
              className={`p-3 rounded-lg border-2 text-left ${s.order_mode === "random" ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
            >
              <p className="text-sm font-bold text-gray-900">랜덤</p>
              <p className="text-[11px] text-gray-500 mt-0.5">대기 리뷰 중 무작위로</p>
            </button>
          </div>
        </div>

        {/* 활성 기간 */}
        <div className="p-4 rounded-2xl bg-white border border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-3">🗓 활성 기간 (선택)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-gray-500">시작</label>
              <input
                type="datetime-local"
                value={s.active_from ? s.active_from.slice(0, 16) : ""}
                onChange={(e) => update({ active_from: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
            <div>
              <label className="text-[11px] text-gray-500">종료</label>
              <input
                type="datetime-local"
                value={s.active_to ? s.active_to.slice(0, 16) : ""}
                onChange={(e) => update({ active_to: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">비워두면 · 상시 활성</p>
        </div>

        {/* 지금 즉시 실행 */}
        <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 text-center">
          <p className="text-xs text-gray-500 mb-2">테스트 · 지금 스케줄 규칙대로 1회 즉시 실행</p>
          <button
            onClick={tickNow}
            disabled={saving || queuedCount === 0}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-40"
          >
            🚀 지금 즉시 실행 (1회)
          </button>
        </div>
      </div>

      <FormActionBar
        cancelHref="/reviews/staging"
        cancelLabel="취소"
        primary={{
          label: saving ? "저장 중..." : "✓ 저장",
          onClick: save,
          disabled: saving,
        }}
      />
    </div>
  );
}

function msPerUnit(u: Schedule["unit"]): number {
  switch (u) {
    case "hour": return 60 * 60 * 1000;
    case "day": return 24 * 60 * 60 * 1000;
    case "week": return 7 * 24 * 60 * 60 * 1000;
    case "month": return 30 * 24 * 60 * 60 * 1000;
  }
}
