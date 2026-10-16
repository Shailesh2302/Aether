import { authApi, setToken, clearToken, getToken, type User } from "./api";

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  const data = await authApi.login(email, password);
  return data;
}

export async function register(
  email: string,
  password: string,
  name: string
): Promise<{ user: User; token: string }> {
  const data = await authApi.register(email, password, name);
  return data;
}

export async function logout(): Promise<void> {
  await authApi.logout();
}

export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === "undefined") return null;
  if (!getToken()) return null;
  try {
    return await authApi.me();
  } catch (error) {
    // Only a real 401 means the session is dead; network blips keep it.
    const status = (error as { response?: { status?: number } })?.response?.status;
    if (status === 401) clearToken();
    return null;
  }
}

export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;
  return !!getToken();
}
