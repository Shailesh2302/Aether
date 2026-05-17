import { create } from "zustand";

interface User {
  id: string;
  email: string;
  name: string;
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

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      // Demo mode - simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (email && password.length >= 4) {
        const user = {
          id: "demo-user-1",
          email,
          name: email.split("@")[0],
        };
        localStorage.setItem("omnimind_user", JSON.stringify(user));
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        throw new Error("Invalid credentials");
      }
    } catch (error: any) {
      set({ error: error.message || "Login failed", isLoading: false });
      throw error;
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (!email || !password || !name) {
        throw new Error("Please fill all fields");
      }
      
      if (password.length < 4) {
        throw new Error("Password must be at least 4 characters");
      }
      
      const user = {
        id: "demo-user-" + Date.now(),
        email,
        name,
      };
      localStorage.setItem("omnimind_user", JSON.stringify(user));
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      set({ error: error.message || "Registration failed", isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    localStorage.removeItem("omnimind_user");
    set({ user: null, isAuthenticated: false, isLoading: false });
  },

  checkAuth: async () => {
    set({ isLoading: true });
    try {
      const userStr = localStorage.getItem("omnimind_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        set({ user, isAuthenticated: true, isLoading: false });
      } else {
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },
}));