"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SchedulerJob {
  name: string;
  description: string;
  apiPath: string;
  cronTime: string;
}

interface SchedulerLog {
  id: string;
  job_name: string;
  executed_at: string;
  executed_by: string;
  result: {
    created?: number;
    target?: number;
    replied?: number;
    hidden?: number;
    errors?: string[];
  } | null;
}

const SCHEDULER_JOBS: SchedulerJob[] = [
  {
    name: "fake-reviews",
    description: "AI 리뷰 자동 생성 (하루 15개)",
    apiPath: "/api/cron/fake-reviews",
    cronTime: "매일 새벽 1시",
  },
  {
    name: "auto-reply",
    description: "저평점 리뷰 자동 답변 + 1주 후 숨김",
    apiPath: "/api/cron/auto-reply",
    cronTime: "매일 자정",
  },
];

export default function SchedulerPage() {
  const [logs, setLogs] = useState<SchedulerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState<string | null>(null);
  const [todayExecuted, setTodayExecuted] = useState<Record<string, boolean>>({});

  // AI 리뷰 생성 갯수 모달
  const [showCountModal, setShowCountModal] = useState(false);
  const [reviewCount, setReviewCount] = useState(1);
  const [pendingJob, setPendingJob] = useState<SchedulerJob | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    // 최근 실행 기록 조회
    const { data, error } = await supabase
      .from("scheduler_logs")
      .select("*")
      .order("executed_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("스케쥴러 로그 조회 실패:", error);
    } else {
      setLogs(data || []);

      // 오늘 실행 여부 체크
      const today = new Date().toISOString().split("T")[0];
      const todayStatus: Record<string, boolean> = {};

      SCHEDULER_JOBS.forEach((job) => {
        const todayLog = (data || []).find(
          (log) =>
            log.job_name === job.name &&
            log.executed_at.startsWith(today)
        );
        todayStatus[job.name] = !!todayLog;
      });

      setTodayExecuted(todayStatus);
    }
    setLoading(false);
  };

  const executeJob = async (job: SchedulerJob) => {
    if (todayExecuted[job.name]) {
      alert("오늘은 이미 실행되었습니다. 내일 다시 시도해주세요.");
      return;
    }

    // AI 리뷰 생성인 경우 갯수 모달 표시
    if (job.name === "fake-reviews") {
      setPendingJob(job);
      setReviewCount(1);
      setShowCountModal(true);
      return;
    }

    // 다른 작업은 기존 방식
    if (!confirm(`"${job.description}" 작업을 실행하시겠습니까?`)) {
      return;
    }

    await runJob(job);
  };

  const handleReviewCountSubmit = async () => {
    if (!pendingJob) return;

    // 2개 이상일 때 경고 2번
    if (reviewCount >= 2) {
      const warning1 = confirm(
        `⚠️ 경고: ${reviewCount}개의 리뷰가 동시에 생성됩니다.\n\n` +
        `동시에 여러 개의 리뷰가 생성되면 작성 시간이 같아서 인위적으로 보일 수 있습니다.\n\n` +
        `계속하시겠습니까?`
      );
      if (!warning1) {
        setShowCountModal(false);
        setPendingJob(null);
        return;
      }

      const warning2 = confirm(
        `⚠️ 최종 확인: 정말로 ${reviewCount}개를 한번에 생성하시겠습니까?\n\n` +
        `자연스러운 리뷰 분포를 위해서는 1개씩 여러 날에 걸쳐 생성하는 것을 권장합니다.`
      );
      if (!warning2) {
        setShowCountModal(false);
        setPendingJob(null);
        return;
      }
    }

    setShowCountModal(false);
    await runJob(pendingJob, reviewCount);
    setPendingJob(null);
  };

  const runJob = async (job: SchedulerJob, count?: number) => {
    setExecuting(job.name);

    try {
      // shop 서버의 cron API 호출
      const shopUrl = process.env.NEXT_PUBLIC_SHOP_URL || "https://cookies-git-dev-youyeongsiks-projects.vercel.app";
      const url = count ? `${shopUrl}${job.apiPath}?count=${count}` : `${shopUrl}${job.apiPath}`;
      const response = await fetch(url);
      const result = await response.json();

      // 실행 기록 저장
      await supabase.from("scheduler_logs").insert({
        job_name: job.name,
        executed_by: "admin",
        result: result,
      });

      alert(`실행 완료!\n결과: ${JSON.stringify(result, null, 2)}`);
      fetchLogs();
    } catch (error) {
      console.error("스케쥴러 실행 실패:", error);
      alert("실행 중 오류가 발생했습니다.");
    } finally {
      setExecuting(null);
    }
  };

  const getLastExecution = (jobName: string): SchedulerLog | undefined => {
    return logs.find((log) => log.job_name === jobName);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getNextAvailableDate = (jobName: string): string => {
    if (!todayExecuted[jobName]) {
      return "지금 실행 가능";
    }
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return `${tomorrow.toLocaleDateString("ko-KR")} 00:00 이후`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">스케쥴러</h1>
        <p className="text-sm text-gray-500 mt-1">
          자동화 작업을 관리하고 수동으로 실행할 수 있습니다
        </p>
      </div>

      {/* 스케쥴러 작업 카드 */}
      <div className="grid gap-6 mb-8">
        {SCHEDULER_JOBS.map((job) => {
          const lastExecution = getLastExecution(job.name);
          const isExecuted = todayExecuted[job.name];
          const isExecuting = executing === job.name;

          return (
            <div
              key={job.name}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-gray-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {job.description}
                      </h3>
                      <p className="text-sm text-gray-500">
                        자동 실행: {job.cronTime}
                      </p>
                    </div>
                  </div>

                  {/* 마지막 실행 정보 */}
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm">
                      <div className="flex justify-between mb-1">
                        <span className="text-gray-500">마지막 실행:</span>
                        <span className="text-gray-900">
                          {lastExecution
                            ? formatDate(lastExecution.executed_at)
                            : "기록 없음"}
                        </span>
                      </div>
                      {lastExecution?.result && (
                        <div className="flex justify-between mb-1">
                          <span className="text-gray-500">실행 결과:</span>
                          <span className="text-gray-900">
                            {lastExecution.result.created !== undefined &&
                              `생성 ${lastExecution.result.created}개`}
                            {lastExecution.result.replied !== undefined &&
                              `답변 ${lastExecution.result.replied}개`}
                            {lastExecution.result.hidden !== undefined &&
                              `, 숨김 ${lastExecution.result.hidden}개`}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-500">실행자:</span>
                        <span className="text-gray-900">
                          {lastExecution?.executed_by || "-"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 다음 실행 가능 날짜 */}
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isExecuted
                          ? "bg-gray-100 text-gray-600"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {isExecuted ? "오늘 실행됨" : "실행 가능"}
                    </span>
                    <span className="text-xs text-gray-500">
                      다음 실행: {getNextAvailableDate(job.name)}
                    </span>
                  </div>
                </div>

                {/* 실행 버튼 */}
                <button
                  onClick={() => executeJob(job)}
                  disabled={isExecuted || isExecuting}
                  className={`ml-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isExecuted || isExecuting
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-gray-900 text-white hover:bg-gray-800"
                  }`}
                >
                  {isExecuting ? "실행 중..." : isExecuted ? "실행 완료" : "수동 실행"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* 주의사항 */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
        <div className="flex">
          <svg
            className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-yellow-800">주의사항</h4>
            <p className="text-sm text-yellow-700 mt-1">
              각 작업은 <strong>하루에 1번만</strong> 실행할 수 있습니다.
              자동 실행 시간에 이미 실행되었다면 수동 실행이 불가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* AI 리뷰 갯수 입력 모달 */}
      {showCountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              AI 리뷰 생성 갯수
            </h3>
            <p className="text-sm text-gray-500 mb-4">
              생성할 리뷰 갯수를 입력하세요.
            </p>
            <input
              type="number"
              min={1}
              max={20}
              value={reviewCount}
              onChange={(e) => setReviewCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {reviewCount >= 2 && (
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700">
                  ⚠️ 2개 이상 생성 시 동시 생성으로 인해 인위적으로 보일 수 있습니다.
                </p>
              </div>
            )}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCountModal(false);
                  setPendingJob(null);
                }}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReviewCountSubmit}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
              >
                실행
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 실행 기록 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-medium text-gray-900">실행 기록</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  작업
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실행 시간
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  실행자
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  결과
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    실행 기록이 없습니다
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {SCHEDULER_JOBS.find((j) => j.name === log.job_name)
                        ?.description || log.job_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(log.executed_at)}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          log.executed_by === "cron"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                        }`}
                      >
                        {log.executed_by === "cron" ? "자동" : "수동"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {log.result ? (
                        <>
                          {log.result.created !== undefined &&
                            `생성 ${log.result.created}개`}
                          {log.result.replied !== undefined &&
                            `답변 ${log.result.replied}개`}
                          {log.result.hidden !== undefined &&
                            `, 숨김 ${log.result.hidden}개`}
                          {log.result.errors &&
                            log.result.errors.length > 0 && (
                              <span className="text-red-500 ml-2">
                                (에러 {log.result.errors.length}건)
                              </span>
                            )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
