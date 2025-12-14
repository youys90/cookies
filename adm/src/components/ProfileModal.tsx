"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { username, changePassword, resetPasswordForUser, updatePhone, getProfile } = useAuth();

  const [activeTab, setActiveTab] = useState<"info" | "password">("info");

  // 내 정보
  const [phone, setPhone] = useState("");
  const [phoneMessage, setPhoneMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [phoneLoading, setPhoneLoading] = useState(false);

  // 비밀번호 변경
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  // 비밀번호 초기화
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetResult, setResetResult] = useState<{ password: string } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      // 모달 열릴 때 초기화
      setActiveTab("info");
      setPhoneMessage(null);
      setPwMessage(null);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowResetConfirm(false);
      setResetResult(null);
    }
  }, [isOpen]);

  const loadProfile = async () => {
    const profile = await getProfile();
    if (profile) {
      setPhone(profile.phone || "");
    }
  };

  const handlePhoneSave = async () => {
    setPhoneMessage(null);
    setPhoneLoading(true);
    const result = await updatePhone(phone);
    setPhoneLoading(false);

    setPhoneMessage({
      type: result.success ? "success" : "error",
      text: result.message,
    });
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

  const handleResetPassword = async () => {
    if (!username) return;

    setResetLoading(true);
    const result = await resetPasswordForUser(username);
    setResetLoading(false);

    if (result.success && result.defaultPassword) {
      setResetResult({ password: result.defaultPassword });
    } else {
      setPwMessage({ type: "error", text: result.message });
    }
    setShowResetConfirm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">내 정보</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "info"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            기본 정보
          </button>
          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-3 text-sm font-medium ${
              activeTab === "password"
                ? "text-gray-900 border-b-2 border-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            비밀번호
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {activeTab === "info" ? (
            <div className="space-y-4">
              {/* 아이디 (읽기 전용) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">아이디</label>
                <input
                  type="text"
                  value={username || ""}
                  disabled
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
                />
              </div>

              {/* 전화번호 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {phoneMessage && (
                <p className={`text-sm ${phoneMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                  {phoneMessage.text}
                </p>
              )}

              <button
                onClick={handlePhoneSave}
                disabled={phoneLoading}
                className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
              >
                {phoneLoading ? "저장 중..." : "저장"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 비밀번호 초기화 결과 */}
              {resetResult ? (
                <div className="text-center py-4">
                  <div className="w-12 h-12 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium mb-2">비밀번호가 초기화되었습니다</p>
                  <div className="bg-gray-100 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-500 mb-1">새 비밀번호</p>
                    <p className="text-lg font-mono font-bold">{resetResult.password}</p>
                  </div>
                  <button
                    onClick={() => setResetResult(null)}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    비밀번호 변경하기
                  </button>
                </div>
              ) : showResetConfirm ? (
                <div className="text-center py-4">
                  <p className="text-gray-700 mb-4">비밀번호를 초기화하시겠습니까?</p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetLoading}
                      className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                    >
                      {resetLoading ? "처리 중..." : "초기화"}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="4자 이상"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>

                  {pwMessage && (
                    <p className={`text-sm ${pwMessage.type === "success" ? "text-green-600" : "text-red-600"}`}>
                      {pwMessage.text}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="w-full py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                  >
                    {pwLoading ? "변경 중..." : "비밀번호 변경"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                  >
                    비밀번호를 잊으셨나요? 초기화하기
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
