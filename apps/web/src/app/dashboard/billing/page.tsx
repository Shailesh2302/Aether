"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Loader2, CheckCircle2, CalendarDays } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Free trial",
  PLAN_3_MONTH: "3-Month Plan",
  PLAN_6_MONTH: "6-Month Plan",
  PLAN_12_MONTH: "12-Month Plan",
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const justPaid = searchParams.get("success") === "1";
  const { status, fetchStatus, cancel, isLoading } = useSubscriptionStore();
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (justPaid) {
      // Give the Stripe webhook a moment, then refresh from the server.
      const t = setTimeout(() => fetchStatus(), 2500);
      return () => clearTimeout(t);
    }
  }, [justPaid, fetchStatus]);

  const handleCancel = async () => {
    if (!confirm("Cancel your subscription? You keep access until the period ends.")) return;
    setCancelling(true);
    try {
      await cancel();
      toast({ title: "Subscription will not renew" });
    } catch {
      toast({ title: "Cancellation failed", variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your trial and subscription
        </p>
      </div>

      {justPaid && (
        <Card className="border-primary/60">
          <CardContent className="p-4 flex items-center gap-3 text-sm">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Payment successful — your subscription is activating. Refresh in a few seconds if it still shows trial.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            Current status
          </CardTitle>
          <CardDescription>Your trial and plan details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && !status ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : status ? (
            <>
              <div className="flex items-center gap-2">
                <Badge
                  variant={status.access === "expired" ? "destructive" : "secondary"}
                >
                  {status.access === "trial"
                    ? `Trial — ${status.trialDaysLeft} days left`
                    : status.access === "active"
                      ? "Active"
                      : "Expired"}
                </Badge>
                <span className="text-sm font-medium">
                  {PLAN_LABELS[status.plan] ?? status.plan}
                </span>
              </div>

              {status.currentPeriodEnd && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4" />
                  {status.cancelAtPeriodEnd ? "Ends on " : "Renews on "}
                  {new Date(status.currentPeriodEnd).toLocaleDateString()}
                  {status.cancelAtPeriodEnd && " (will not renew)"}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {status.access !== "active" && (
                  <Button asChild>
                    <Link href="/pricing">View plans</Link>
                  </Button>
                )}
                {status.access === "active" && !status.cancelAtPeriodEnd && (
                  <Button
                    variant="outline"
                    disabled={cancelling}
                    onClick={handleCancel}
                  >
                    {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cancel subscription"}
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Could not load billing status.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
