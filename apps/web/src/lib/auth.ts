import { authApi, type User } from "./api";

export async function login(email: string, password: string): Promise<{ user: User; token: string }> {
  const data = await authApi.login(email, password);
  if (typeof window !== "undefined") {
    localStorage.setItem("token", data.token);
  }
  return data;
}

export async function register(email: string, password: string, name: string): Promise<{ user: User; token: string }> {
  const data = await authApi.register(email, password, name);
  if (typeof window !== "undefined") {
    localStorage.setItem("token", data.token);
  }
  return data;
}

export async function logout(): Promise<void> {
  try {
    await authApi.logout();
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
    }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const user = await authApi.me();
    return user;
  } catch {
    localStorage.removeItem("token");
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem("token");
}