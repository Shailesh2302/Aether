import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      error: null,

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/auth/login", { email, password });
          localStorage.setItem("token", data.token);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.response?.data?.error || error.message || "Login failed", isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/auth/register", { email, password, name });
          localStorage.setItem("token", data.token);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (error: any) {
          set({ error: error.response?.data?.error || error.message || "Registration failed", isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        localStorage.removeItem("token");
        set({ user: null, isAuthenticated: false, isLoading: false });
      },

      checkAuth: async () => {
        const token = localStorage.getItem("token");
        
        // If no token, not authenticated
        if (!token) {
          set({ isLoading: false, isAuthenticated: false });
          return;
        }
        
        // Token exists - user is authenticated
        // Try to get user data, but don't logout if it fails
        set({ isLoading: true, isAuthenticated: true });
        
        try {
          const { data: user } = await api.get("/auth/me");
          set({ user, isAuthenticated: true, isLoading: false });
        } catch (error) {
          // Token might be expired but we'll keep user logged in
          // The API interceptor will handle token refresh or logout when needed
          console.log("Auth check failed but keeping user logged in:", error);
          // Keep isAuthenticated: true, just don't set user
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "omnimind-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);