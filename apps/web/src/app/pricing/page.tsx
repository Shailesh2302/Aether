"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSubscriptionStore } from "@/store/useSubscriptionStore";
import { useAuthStore } from "@/store/useAuthStore";
import { getToken, type BillingPlanId } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Loader2, Sparkles, ArrowLeft } from "lucide-react";

export default function PricingPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading plans…</div>}>
      <PricingContent />
    </Suspense>
  );
}

function PricingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const expired = searchParams.get("expired") === "1";
  const canceled = searchParams.get("canceled") === "1";

  const { plans, trialDays, paymentsConfigured, fetchPlans, checkout, isLoading, error } =
    useSubscriptionStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [busyPlan, setBusyPlan] = useState<BillingPlanId | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    if (typeof window !== "undefined" && !getToken()) {
      // still allow browsing plans; checkout will ask to log in
    }
  }, [fetchPlans]);

  const handleChoose = async (plan: BillingPlanId) => {
    if (!isAuthenticated && !getToken()) {
      router.push(`/login?next=/pricing`);
      return;
    }
    setBusyPlan(plan);
    setNotice(null);
    try {
      await checkout(plan);
    } catch {
      setNotice(
        paymentsConfigured
          ? "Could not start checkout. Please try again."
          : "Online payments are not enabled yet. Please contact support to subscribe."
      );
    } finally {
      setBusyPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-7 w-7 place-items-center bg-lime-300 font-display text-xs font-bold text-black">
              Æ
            </span>
            <span className="font-display text-sm font-bold tracking-[0.22em]">AETHER</span>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
        </div>

        <div className="mt-10 text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="h-3 w-3 mr-1" />
            {trialDays}-day free trial included
          </Badge>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            Simple pricing<span className="lime-text">.</span>
          </h1>
          <p className="mt-3 text-muted-foreground">
            Every new account gets {trialDays} days free. After that, pick the plan
            that fits you. Cancel anytime.
          </p>
        </div>

        {expired && (
          <Card className="mt-8 border-destructive/60">
            <CardContent className="p-4 text-sm">
              Your free trial has ended. Subscribe below to keep uploading videos and
              using AI features.
            </CardContent>
          </Card>
        )}
        {canceled && (
          <Card className="mt-8">
            <CardContent className="p-4 text-sm text-muted-foreground">
              Checkout was canceled — no charge was made. Your files are safe.
            </CardContent>
          </Card>
        )}
        {(notice || error) && (
          <Card className="mt-8 border-destructive/60">
            <CardContent className="p-4 text-sm">{notice || error}</CardContent>
          </Card>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {plans.map((plan, i) => (
            <Card key={plan.id} className={i === 1 ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.label}</CardTitle>
                  {i === 1 && <Badge>Popular</Badge>}
                </div>
                <CardDescription>{plan.tagline}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-4xl font-bold">${plan.priceDollars}</span>
                  <span className="text-sm text-muted-foreground"> / {plan.months} months</span>
                </div>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Unlimited video uploads
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> AI summaries, chat & search
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Smart clips & highlights
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" /> Cancel anytime
                  </li>
                </ul>
                <Button
                  className="w-full"
                  variant={i === 1 ? "default" : "outline"}
                  disabled={isLoading && busyPlan === plan.id}
                  onClick={() => handleChoose(plan.id)}
                >
                  {busyPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Choose ${plan.label}`
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {!paymentsConfigured && plans.length > 0 && (
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Online checkout is being set up — the Subscribe buttons will activate
            payments automatically once configured.
          </p>
        )}
      </div>
    </div>
  );
}
