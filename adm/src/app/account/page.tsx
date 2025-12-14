"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function AccountPage() {
  const { username, changePassword, resetPassword, updatePhone, getProfile } = useAuth();

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // 전화번호
  const [phone, setPhone] = useState("");
  const [phoneMessage, setPhoneMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // 비밀번호 초기화 팝업
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetResult, setResetResult] = useState<{ success: boolean; password?: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    const profile = await getProfile();
    if (profile) {
      setPhone(profile.phone || "");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMessage(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwMessage({ type: "error", text: "모든 항목을 입력해주세요." });
      return;
    }

    if (newPassword.length < 4) {
      setPwMessage({ type: "error", text: "새 비밀번호는 4자 이상이어야 합니다." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwMessage({ type: "error", text: "새 비밀번호가 일치하지 않습니다." });
      return;
    }

    if (currentPassword === newPassword) {
      setPwMessage({ type: "error", text: "현재 비밀번호와 다른 비밀번호를 입력해주세요." });
      return;
    }

    setPwLoading(true);
    const result = await changePassword(currentPassword, newPassword);
    setPwLoading(false);

    if (result.success) {
      setPwMessage({ type: "success", text: result.message });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setPwMessage({ type: "error", text: result.message });
    }
  };

  const handlePhoneSave = async () => {
    setPhoneMessage(null);
    setPhoneLoading(true);
    const result = await updatePhone(phone);
    setPhoneLoading(false);

    if (result.success) {
      setPhoneMessage({ type: "success", text: result.message });
    } else {
      setPhoneMessage({ type: "error", text: result.message });
    }
  };

  const handleResetPassword = async () => {
    setResetLoading(true);
    const result = await resetPassword();
    setResetLoading(false);

    if (result.success) {
      setResetResult({ success: true, password: result.defaultPassword });
    } else {
      setResetResult({ success: false });
    }
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetResult(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-gray-900">계정관리</h1>
        <p className="text-gray-500 mt-1">계정 정보를 확인하고 비밀번호를 변경할 수 있습니다.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 계정 정보 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">계정 정보</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">아이디 *</label>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-sm font-medium text-gray-600">
                    {username?.slice(0, 2).toUpperCase() || "AD"}
                  </span>
                </div>
                <span className="text-gray-900 font-medium">{username || "-"}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">전화번호 (선택)</label>
              <div className="flex space-x-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
                <button
                  onClick={handlePhoneSave}
                  disabled={phoneLoading}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400"
                >
                  {phoneLoading ? "저장 중..." : "저장"}
                </button>
              </div>
              {phoneMessage && (
                <p className={`text-sm mt-2 ${phoneMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {phoneMessage.text}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">권한</label>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                관리자
              </span>
            </div>
          </div>
        </div>

        {/* 비밀번호 변경 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">비밀번호 변경</h2>

          {pwMessage && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm ${
                pwMessage.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "bg-red-50 text-red-700 border border-red-200"
              }`}
            >
              {pwMessage.text}
            </div>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                현재 비밀번호 *
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="현재 비밀번호 입력"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 *
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="새 비밀번호 입력 (4자 이상)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                새 비밀번호 확인 *
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                placeholder="새 비밀번호 다시 입력"
              />
            </div>

            <button
              type="submit"
              disabled={pwLoading}
              className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {pwLoading ? "변경 중..." : "비밀번호 변경"}
            </button>
          </form>

          {/* 비밀번호 초기화 */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <button
              onClick={() => setShowResetModal(true)}
              className="w-full py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
            >
              비밀번호 초기화
            </button>
            <p className="text-xs text-gray-400 mt-2 text-center">
              비밀번호를 잊어버린 경우 기본 비밀번호로 초기화합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 비밀번호 초기화 모달 */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            {!resetResult ? (
              <>
                <h3 className="text-lg font-medium text-gray-900 mb-2">비밀번호 초기화</h3>
                <p className="text-sm text-gray-500 mb-6">
                  비밀번호를 기본값으로 초기화하시겠습니까?
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={closeResetModal}
                    className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resetLoading}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                  >
                    {resetLoading ? "처리 중..." : "초기화"}
                  </button>
                </div>
              </>
            ) : resetResult.success ? (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">초기화 완료</h3>
                  <p className="text-sm text-gray-500 mb-4">비밀번호가 초기화되었습니다.</p>
                  <div className="bg-gray-100 rounded-lg p-4 mb-6">
                    <p className="text-xs text-gray-500 mb-1">새 비밀번호</p>
                    <p className="text-lg font-mono font-bold text-gray-900">{resetResult.password}</p>
                  </div>
                  <button
                    onClick={closeResetModal}
                    className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">초기화 실패</h3>
                  <p className="text-sm text-gray-500 mb-6">오류가 발생했습니다. 다시 시도해주세요.</p>
                  <button
                    onClick={closeResetModal}
                    className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
