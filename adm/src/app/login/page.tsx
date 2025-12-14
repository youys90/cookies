"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

// 전화번호 포맷팅 함수 (숫자만 입력, 자동 하이픈)
const formatPhoneNumber = (value: string): string => {
  const numbers = value.replace(/[^0-9]/g, "");
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
};

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();

  // 아이디 찾기 모달
  const [showFindModal, setShowFindModal] = useState(false);
  const [findPhone, setFindPhone] = useState("");
  const [findResult, setFindResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [findLoading, setFindLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const success = await login(username, password);

    if (success) {
      router.push("/");
    } else {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
    setLoading(false);
  };

  const handleFindId = async () => {
    if (!findPhone || findPhone.length < 13) {
      setFindResult({ type: "error", text: "전화번호를 올바르게 입력해주세요." });
      return;
    }

    setFindLoading(true);
    setFindResult(null);

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("username")
        .eq("phone", findPhone)
        .single();

      if (error || !data) {
        setFindResult({ type: "error", text: "등록된 전화번호가 없습니다." });
      } else {
        setFindResult({ type: "success", text: `아이디: ${data.username}` });
      }
    } catch {
      setFindResult({ type: "error", text: "오류가 발생했습니다." });
    }

    setFindLoading(false);
  };

  const closeFindModal = () => {
    setShowFindModal(false);
    setFindPhone("");
    setFindResult(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Cookies Admin</h1>
          <p className="text-sm text-gray-500 mt-2">관리자 로그인</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              아이디
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              placeholder="아이디를 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              비밀번호
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none"
              placeholder="비밀번호를 입력하세요"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:bg-gray-400"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        {/* 아이디 찾기 링크 */}
        <div className="flex justify-center mt-6 text-sm">
          <button
            onClick={() => setShowFindModal(true)}
            className="text-gray-500 hover:text-gray-700"
          >
            아이디 찾기
          </button>
        </div>
      </div>

      {/* 아이디 찾기 모달 */}
      {showFindModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">아이디 찾기</h3>
            <p className="text-sm text-gray-500 mb-4">가입 시 등록한 전화번호를 입력하세요.</p>

            <div className="space-y-4">
              <input
                type="tel"
                value={findPhone}
                onChange={(e) => setFindPhone(formatPhoneNumber(e.target.value))}
                placeholder="010-0000-0000"
                maxLength={13}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              />

              {findResult && (
                <div className={`p-3 rounded-lg text-sm whitespace-pre-line ${
                  findResult.type === "success"
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  {findResult.text}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={closeFindModal}
                  className="flex-1 py-2.5 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
                >
                  닫기
                </button>
                <button
                  onClick={handleFindId}
                  disabled={findLoading}
                  className="flex-1 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:bg-gray-400"
                >
                  {findLoading ? "조회 중..." : "조회"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
