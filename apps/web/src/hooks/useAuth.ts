import { useAuthStore } from "@/store/useAuthStore";

export function useAuth() {
  const {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    checkAuth,
  } = useAuthStore();

  return {
    user,
    isLoading,
    isAuthenticated,
    error,
    login,
    register,
    logout,
    checkAuth,
  };
}