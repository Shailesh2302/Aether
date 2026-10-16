import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, setToken, clearToken, getToken, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  setUser: (user: User | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      // Start loading: the persisted session (if any) is re-applied and
      // revalidated async. Starting false would flash-redirect logged-in
      // users to /login on every refresh before restore finishes.
      isLoading: true,
      isAuthenticated: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.login(email, password);
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { error?: string } } })?.response
              ?.data?.error ||
            (error as { message?: string })?.message ||
            "Login failed";
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      register: async (email, password, name) => {
        set({ isLoading: true, error: null });
        try {
          const data = await authApi.register(email, password, name);
          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          const message =
            (error as { response?: { data?: { error?: string } } })?.response
              ?.data?.error ||
            (error as { message?: string })?.message ||
            "Registration failed";
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          clearToken();
          set({ user: null, isAuthenticated: false });
        }
      },

      checkAuth: async () => {
        if (!getToken()) {
          set({ isLoading: false, isAuthenticated: false, user: null });
          return;
        }
        set({ isLoading: true });
        try {
          const user = await authApi.me();
          set({ user, isLoading: false, isAuthenticated: true });
        } catch (error: unknown) {
          // Dead token (401) -> sign out for real. Anything else (offline,
          // sleeping backend, transient proxy error) keeps the existing
          // session so reopening the app never boots the user out.
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 401) {
            clearToken();
            set({ user: null, isLoading: false, isAuthenticated: false });
          } else {
            set({ isLoading: false });
          }
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: "aether-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
