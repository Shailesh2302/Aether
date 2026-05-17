import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (typeof window !== "undefined" && isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}