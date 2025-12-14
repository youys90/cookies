"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import bcrypt from "bcryptjs";

interface AdminUser {
  id: number;
  username: string;
  phone: string | null;
  created_at: string;
}

interface AuthContextType {
  isLoggedIn: boolean;
  username: string | null;
  isAdmin: boolean;  // admin 계정인지 여부
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
  resetPasswordForUser: (targetUsername: string) => Promise<{ success: boolean; message: string; defaultPassword?: string }>;
  updatePhone: (phone: string) => Promise<{ success: boolean; message: string }>;
  getProfile: () => Promise<{ username: string; phone: string | null } | null>;
  // 계정 관리 (admin 전용)
  getAllUsers: () => Promise<AdminUser[]>;
  createUser: (username: string, password: string, phone?: string) => Promise<{ success: boolean; message: string }>;
  deleteUser: (targetUsername: string) => Promise<{ success: boolean; message: string }>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 로컬스토리지에서 로그인 상태 확인
    const savedUser = localStorage.getItem("admin_user");
    if (savedUser) {
      setIsLoggedIn(true);
      setUsername(savedUser);
      setIsAdmin(savedUser === "admin");
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
      setIsAdmin(data.username === "admin");
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

  const resetPasswordForUser = async (targetUsername: string): Promise<{ success: boolean; message: string; defaultPassword?: string }> => {
    if (!username) {
      return { success: false, message: "로그인이 필요합니다." };
    }

    // 본인 비밀번호 초기화 또는 admin이 다른 사용자 초기화
    if (targetUsername !== username && !isAdmin) {
      return { success: false, message: "권한이 없습니다." };
    }

    const defaultPassword = "Cookies12#$";

    try {
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      const { error } = await supabase
        .from("admin_users")
        .update({ password: hashedPassword, updated_at: new Date().toISOString() })
        .eq("username", targetUsername);

      if (error) {
        console.error("비밀번호 초기화 에러:", error);
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

  // 계정 관리 함수들 (admin 전용)
  const getAllUsers = async (): Promise<AdminUser[]> => {
    if (!isAdmin) return [];

    try {
      const { data, error } = await supabase
        .from("admin_users")
        .select("id, username, phone, created_at")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("사용자 목록 조회 실패:", error);
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  };

  const createUser = async (newUsername: string, password: string, phone?: string): Promise<{ success: boolean; message: string }> => {
    if (!isAdmin) {
      return { success: false, message: "권한이 없습니다." };
    }

    try {
      // 중복 체크
      const { data: existing } = await supabase
        .from("admin_users")
        .select("username")
        .eq("username", newUsername)
        .single();

      if (existing) {
        return { success: false, message: "이미 존재하는 아이디입니다." };
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const { error } = await supabase
        .from("admin_users")
        .insert({
          username: newUsername,
          password: hashedPassword,
          phone: phone || null,
        });

      if (error) {
        console.error("계정 생성 에러:", error);
        return { success: false, message: "계정 생성에 실패했습니다." };
      }

      return { success: true, message: "계정이 생성되었습니다." };
    } catch (error) {
      console.error("계정 생성 실패:", error);
      return { success: false, message: "오류가 발생했습니다." };
    }
  };

  const deleteUser = async (targetUsername: string): Promise<{ success: boolean; message: string }> => {
    if (!isAdmin) {
      return { success: false, message: "권한이 없습니다." };
    }

    if (targetUsername === "admin") {
      return { success: false, message: "admin 계정은 삭제할 수 없습니다." };
    }

    try {
      const { error } = await supabase
        .from("admin_users")
        .delete()
        .eq("username", targetUsername);

      if (error) {
        console.error("계정 삭제 에러:", error);
        return { success: false, message: "계정 삭제에 실패했습니다." };
      }

      return { success: true, message: "계정이 삭제되었습니다." };
    } catch (error) {
      console.error("계정 삭제 실패:", error);
      return { success: false, message: "오류가 발생했습니다." };
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setUsername(null);
    setIsAdmin(false);
    localStorage.removeItem("admin_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{
      isLoggedIn,
      username,
      isAdmin,
      login,
      logout,
      changePassword,
      resetPasswordForUser,
      updatePhone,
      getProfile,
      getAllUsers,
      createUser,
      deleteUser,
      loading
    }}>
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
