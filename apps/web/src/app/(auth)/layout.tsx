import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import Link from "next/link";
import { isAuthenticated } from "@/lib/auth";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isAuthenticated()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col items-center justify-center bg-grid p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold tracking-tight"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <span className="text-lg">Aether</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
