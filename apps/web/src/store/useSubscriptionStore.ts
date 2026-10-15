import { create } from "zustand";
import {
  subscriptionApi,
  type BillingPlan,
  type SubscriptionStatus,
  type BillingPlanId,
  extractErrorMessage,
} from "@/lib/api";

interface SubscriptionState {
  status: SubscriptionStatus | null;
  plans: BillingPlan[];
  trialDays: number;
  paymentsConfigured: boolean;
  isLoading: boolean;
  error: string | null;
  fetchStatus: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  checkout: (plan: BillingPlanId) => Promise<string | null>;
  cancel: () => Promise<void>;
  clearError: () => void;
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  status: null,
  plans: [],
  trialDays: 30,
  paymentsConfigured: false,
  isLoading: false,
  error: null,

  fetchStatus: async () => {
    set({ isLoading: true, error: null });
    try {
      const status = await subscriptionApi.status();
      set({ status, isLoading: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Failed to load subscription"),
        isLoading: false,
      });
    }
  },

  fetchPlans: async () => {
    try {
      const data = await subscriptionApi.plans();
      set({
        plans: data.plans,
        trialDays: data.trialDays,
        paymentsConfigured: data.paymentsConfigured,
      });
    } catch (error) {
      set({ error: extractErrorMessage(error, "Failed to load plans") });
    }
  },

  checkout: async (plan) => {
    set({ isLoading: true, error: null });
    try {
      const { url } = await subscriptionApi.checkout(plan);
      set({ isLoading: false });
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
      return url;
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Checkout failed"),
        isLoading: false,
      });
      throw error;
    }
  },

  cancel: async () => {
    set({ isLoading: true, error: null });
    try {
      await subscriptionApi.cancel();
      const status = await subscriptionApi.status();
      set({ status, isLoading: false });
    } catch (error) {
      set({
        error: extractErrorMessage(error, "Cancellation failed"),
        isLoading: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
