"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

interface AuthContextType {
  isLoggedIn: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  resetPassword: () => Promise<{ success: boolean; message: string; defaultPassword?: string }>;
  updatePhone: (phone: string) => Promise<{ success: boolean; message: string }>;
  getProfile: () => Promise<{ username: string; phone: string | null } | null>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 로컬스토리지에서 로그인 상태 확인
    const savedUser = localStorage.getItem("admin_user");
    if (savedUser) {
      setIsLoggedIn(true);
      setUsername(savedUser);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // 로그인 안 되어 있으면 로그인 페이지로 리다이렉트
    if (!loading && !isLoggedIn && pathname !== "/login") {
      router.push("/login");
    }
  }, [loading, isLoggedIn, pathname, router]);

  const login = async (inputUsername: string, inputPassword: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("*")
        .eq("username", inputUsername)
        .single();

      if (error || !data) {
        return false;
      }

      // bcrypt 해시된 비밀번호 또는 평문 비밀번호 비교
      const storedPassword = data.password;
      let isValid = false;

      if (storedPassword.startsWith("$2")) {
        // bcrypt 해시된 비밀번호
        isValid = await bcrypt.compare(inputPassword, storedPassword);
      } else {
        // 평문 비밀번호 (마이그레이션 전)
        isValid = storedPassword === inputPassword;
      }

      if (!isValid) {
        return false;
      }

      setIsLoggedIn(true);
      setUsername(data.username);
      localStorage.setItem("admin_user", data.username);
      return true;
    } catch (error) {
      console.error("로그인 실패:", error);
      return false;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
    if (!username) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    try {
      // 현재 사용자 정보 조회
      const { data: user, error: fetchError } = await supabase
        .from("admin_users")
        .select("*")
        .eq("username", username)
        .single();

      if (fetchError || !user) {
        return { success: false, message: "사용자 정보를 찾을 수 없습니다." };
      }

      // 현재 비밀번호 확인
      const storedPassword = user.password;
      let isValid = false;

      if (storedPassword.startsWith("$2")) {
        isValid = await bcrypt.compare(currentPassword, storedPassword);
      } else {
        isValid = storedPassword === currentPassword;
      }

      if (!isValid) {
        return { success: false, message: "현재 비밀번호가 일치하지 않습니다." };
      }

      // 새 비밀번호 해시
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 비밀번호 업데이트
      const { error: updateError } = await supabase
        .from("admin_users")
        .update({ password: hashedPassword, updated_at: new Date().toISOString() })
        .eq("username", username);

      if (updateError) {
        return { success: false, message: "비밀번호 변경에 실패했습니다." };
      }

      return { success: true, message: "비밀번호가 변경되었습니다." };
    } catch (error) {
      console.error("비밀번호 변경 실패:", error);
      return { success: false, message: "오류가 발생했습니다." };
    }
  };

  const resetPassword = async (): Promise<{ success: boolean; message: string; defaultPassword?: string }> => {
    if (!username) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    const defaultPassword = "Cookies12#$";

    try {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const { error } = await supabase
        .from("admin_users")
        .update({ password: hashedPassword, updated_at: new Date().toISOString() })
        .eq("username", username);

      if (error) {
        return { success: false, message: "비밀번호 초기화에 실패했습니다." };
      }

      return { success: true, message: "비밀번호가 초기화되었습니다.", defaultPassword };
    } catch (error) {
      console.error("비밀번호 초기화 실패:", error);
      return { success: false, message: "오류가 발생했습니다." };
    }
  };

  const updatePhone = async (phone: string): Promise<{ success: boolean; message: string }> => {
    if (!username) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    try {
      const { error } = await supabase
        .from("admin_users")
        .update({ phone, updated_at: new Date().toISOString() })
        .eq("username", username);

      if (error) {
        return { success: false, message: "전화번호 저장에 실패했습니다." };
      }

      return { success: true, message: "전화번호가 저장되었습니다." };
    } catch (error) {
      console.error("전화번호 저장 실패:", error);
      return { success: false, message: "오류가 발생했습니다." };
    }
  };

  const getProfile = async (): Promise<{ username: string; phone: string | null } | null> => {
    if (!username) return null;

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("username, phone")
        .eq("username", username)
        .single();

      if (error || !data) return null;

      return { username: data.username, phone: data.phone || null };
    } catch {
      return null;
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUsername(null);
    localStorage.removeItem("admin_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, username, login, logout, changePassword, resetPassword, updatePhone, getProfile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
