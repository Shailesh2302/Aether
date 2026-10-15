"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { getToken } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Crown, Clock } from "lucide-react";

export function TrialBanner() {
  const { status, fetchStatus } = useSubscriptionStore();

  useEffect(() => {
    if (getToken()) fetchStatus();
  }, [fetchStatus]);

  if (!status) return null;

  if (status.access === "expired") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
        <span>
          Your free trial has ended. Subscribe to keep uploading and using AI features.
        </span>
        <Button size="sm" asChild>
          <Link href="/pricing?expired=1">
            <Crown className="h-3 w-3 mr-1" />
            View plans
          </Link>
        </Button>
      </div>
    );
  }

  if (status.access === "trial" && status.trialDaysLeft <= 7) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/60 px-4 py-2 text-sm">
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          {status.trialDaysLeft === 0
            ? "Your free trial ends today."
            : `${status.trialDaysLeft} day${status.trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}
        </span>
        <Button size="sm" variant="outline" asChild>
          <Link href="/pricing">Upgrade</Link>
        </Button>
      </div>
    );
  }

  return null;
}
