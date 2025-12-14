"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

interface AdminUser {
  id: number;
  username: string;
  phone: string | null;
  created_at: string;
}

// 전화번호 포맷팅 함수 (숫자만 입력, 자동 하이픈)
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export default function AccountPage() {
  const router = useRouter();
  const { isAdmin, getAllUsers, createUser, deleteUser, resetPasswordForUser } = useAuth();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // 새 계정 생성
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createMessage, setCreateMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 삭제 확인
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // 비밀번호 초기화
  const [resetTarget, setResetTarget] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; password: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      router.push("/");
      return;
    }
    loadUsers();
  }, [isAdmin]);

  const loadUsers = async () => {
    setLoading(true);
    const data = await getAllUsers();
    setUsers(data);
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateMessage(null);

    if (!newUsername || !newPassword || !newPhone) {
      setCreateMessage({ type: "error", text: "모든 항목을 입력해주세요." });
      return;
    }

    if (newUsername.length < 3) {
      setCreateMessage({ type: "error", text: "아이디는 3자 이상이어야 합니다." });
      return;
    }

    if (newPassword.length < 4) {
      setCreateMessage({ type: "error", text: "비밀번호는 4자 이상이어야 합니다." });
      return;
    }

    if (newPhone.length < 13) {
      setCreateMessage({ type: "error", text: "전화번호를 올바르게 입력해주세요." });
      return;
    }

    setCreateLoading(true);
    const result = await createUser(newUsername, newPassword, newPhone);
    setCreateLoading(false);

    if (result.success) {
      setCreateMessage({ type: "success", text: result.message });
      setNewUsername("");
      setNewPassword("");
      setNewPhone("");
      loadUsers();
      setTimeout(() => {
        setShowCreateModal(false);
        setCreateMessage(null);
      }, 1500);
    } else {
      setCreateMessage({ type: "error", text: result.message });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setDeleteLoading(true);
    const result = await deleteUser(deleteTarget);
    setDeleteLoading(false);

    if (result.success) {
      loadUsers();
    }
    setDeleteTarget(null);
  };

  const handleReset = async () => {
    if (!resetTarget) return;

    setResetLoading(true);
    const result = await resetPasswordForUser(resetTarget);
    setResetLoading(false);

    if (result.success && result.defaultPassword) {
      setResetResult({ username: resetTarget, password: result.defaultPassword });
    }
    setResetTarget(null);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">계정관리</h1>
          <p className="text-gray-500 mt-1">관리자 계정을 생성하고 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          계정 추가
        </button>
      </div>

      {/* User List */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="p-8 text-center text-gray-500">로딩 중...</div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-gray-500">등록된 계정이 없습니다.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">아이디</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">전화번호</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">권한</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <span className="text-xs font-medium text-gray-600">
                          {user.username.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-gray-900">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{user.phone || "-"}</td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-6 py-4">
                    {user.username === "admin" ? (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                        최고관리자
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        관리자
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setResetTarget(user.username)}
                      className="text-sm text-gray-500 hover:text-gray-700 mr-3"
                    >
                      비번 초기화
                    </button>
                    {user.username !== "admin" && (
                      <button
                        onClick={() => setDeleteTarget(user.username)}
                        className="text-sm text-red-500 hover:text-red-700"
                      >
                        삭제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">새 계정 추가</h3>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  아이디 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  placeholder="3자 이상"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="4자 이상"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  전화번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
                  placeholder="010-0000-0000"
                  maxLength={13}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {createMessage && (
                <p className={`text-sm ${createMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {createMessage.text}
                </p>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateMessage(null);
                    setNewUsername("");
                    setNewPassword("");
                    setNewPhone("");
                  }}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {createLoading ? "생성 중..." : "생성"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">계정 삭제</h3>
            <p className="text-gray-500 mb-6">
              <span className="font-medium text-gray-900">{deleteTarget}</span> 계정을 삭제하시겠습니까?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
              >
                {deleteLoading ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirm Modal */}
      {resetTarget && !resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-2">비밀번호 초기화</h3>
            <p className="text-gray-500 mb-6">
              <span className="font-medium text-gray-900">{resetTarget}</span> 계정의 비밀번호를 초기화하시겠습니까?
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={resetLoading}
                className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
              >
                {resetLoading ? "처리 중..." : "초기화"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Result Modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4 text-center">
            <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">초기화 완료</h3>
            <p className="text-sm text-gray-500 mb-4">
              <span className="font-medium">{resetResult.username}</span> 계정의 비밀번호가 초기화되었습니다.
            </p>
            <div className="bg-gray-100 rounded-lg p-4 mb-6">
              <p className="text-xs text-gray-500 mb-1">새 비밀번호</p>
              <p className="text-lg font-mono font-bold text-gray-900">{resetResult.password}</p>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
