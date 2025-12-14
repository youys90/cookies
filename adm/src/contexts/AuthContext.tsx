"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  isLoggedIn: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
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
        .eq("password", inputPassword)
        .single();

      if (error || !data) {
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

  const logout = () => {
    setIsLoggedIn(false);
    setUsername(null);
    localStorage.removeItem("admin_user");
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ isLoggedIn, username, login, logout, loading }}>
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
