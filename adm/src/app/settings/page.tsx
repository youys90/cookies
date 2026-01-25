"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface NotifyUser {
  id: string;
  user_id: string;
  display_name: string | null;
  is_approved: boolean;
  requested_at: string;
  created_at: string;
}

export default function SettingsPage() {
  const [notifyUsers, setNotifyUsers] = useState<NotifyUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifyUsers();
  }, []);

  const fetchNotifyUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("line_notify_users")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("알림 수신자 조회 에러:", error);
    } else {
      setNotifyUsers(data || []);
    }
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    const { error } = await supabase
      .from("line_notify_users")
      .update({ is_approved: true })
      .eq("id", id);

    if (error) {
      console.error("승인 에러:", error);
      alert("승인에 실패했습니다.");
    } else {
      fetchNotifyUsers();
    }
  };

  const handleReject = async (id: string) => {
    const { error } = await supabase
      .from("line_notify_users")
      .update({ is_approved: false })
      .eq("id", id);

    if (error) {
      console.error("거절 에러:", error);
      alert("거절에 실패했습니다.");
    } else {
      fetchNotifyUsers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    const { error } = await supabase
      .from("line_notify_users")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("삭제 에러:", error);
      alert("삭제에 실패했습니다.");
    } else {
      fetchNotifyUsers();
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingUsers = notifyUsers.filter((u) => !u.is_approved);
  const approvedUsers = notifyUsers.filter((u) => u.is_approved);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">설정</h1>
        <p className="text-gray-500 mt-1">LINE 알림 수신자를 관리합니다.</p>
      </div>

      {/* LINE 알림 수신자 관리 */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">LINE 알림 수신자</h2>
          <button
            onClick={fetchNotifyUsers}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            새로고침
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-amber-800">
            <strong>알림 등록 방법:</strong> LINE 공식계정에서 <code className="bg-amber-100 px-1 rounded">알림등록</code> 메시지를 보내면 신청됩니다.
            관리자가 승인하면 주문 알림을 받을 수 있습니다.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">로딩 중...</div>
        ) : (
          <>
            {/* 대기 중 (승인 필요) */}
            {pendingUsers.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full mr-2"></span>
                  승인 대기 ({pendingUsers.length}명)
                </h3>
                <div className="space-y-2">
                  {pendingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.display_name || "이름 없음"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          신청: {formatDate(user.requested_at || user.created_at)}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          ID: {user.user_id.slice(0, 10)}...
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          승인
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 승인됨 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                승인됨 ({approvedUsers.length}명)
              </h3>
              {approvedUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-lg">
                  승인된 수신자가 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.display_name || "이름 없음"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          승인일: {formatDate(user.created_at)}
                        </p>
                        <p className="text-xs text-gray-400 font-mono mt-1">
                          ID: {user.user_id.slice(0, 10)}...
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                        >
                          승인 취소
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
