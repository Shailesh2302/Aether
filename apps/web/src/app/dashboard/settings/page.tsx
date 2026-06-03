"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { userApi } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  User as UserIcon,
  Save,
  Loader2,
  Mail,
  Bell,
  Lock,
  Trash2,
  Database,
  Sparkles,
  CheckCircle2,
  HardDrive,
  Video,
  MessageSquare,
} from "lucide-react";
import { getInitials, formatFileSize, getFileCategory } from "@/lib/utils";
import { useUpload } from "@/hooks/useUpload";
import { toast } from "@/hooks/use-toast";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { files } = useUpload();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Stats
  const [stats, setStats] = useState<{
    totalFiles: number;
    storageUsed: number;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email);
    }
  }, [user]);

  useEffect(() => {
    userApi
      .getStats()
      .then((s) =>
        setStats({ totalFiles: s.totalFiles, storageUsed: s.storageUsed })
      )
      .catch(() => {
        const fileList = Array.isArray(files) ? files : [];
        const totalSize = fileList.reduce((sum, f) => {
          const size = typeof f.size === "string" ? parseInt(f.size, 10) : f.size;
          return sum + (Number.isFinite(size) ? size : 0);
        }, 0);
        setStats({ totalFiles: fileList.length, storageUsed: totalSize });
      });
  }, [files]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast({
        title: "Missing fields",
        description: "Name and email are required",
        variant: "destructive",
      });
      return;
    }
    setIsSaving(true);
    try {
      const updated = await userApi.updateProfile({ name, email });
      setUser(updated);
      toast({ title: "Profile updated" });
    } catch {
      toast({
        title: "Update failed",
        description: "Could not save changes",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const fileList = Array.isArray(files) ? files : [];
  const videoCount = fileList.filter(
    (f) => getFileCategory(f.mimeType) === "video"
  ).length;

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account, preferences, and data
        </p>
      </div>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserIcon className="h-4 w-4" />
              Profile
            </CardTitle>
            <CardDescription>Your public profile information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={user?.avatar ?? undefined} alt={user?.name ?? ""} />
                <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.name ?? "User"}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={HardDrive}
          label="Storage used"
          value={formatFileSize(stats?.storageUsed ?? 0)}
        />
        <StatTile
          icon={Database}
          label="Total files"
          value={(stats?.totalFiles ?? fileList.length).toString()}
        />
        <StatTile
          icon={Video}
          label="Videos"
          value={videoCount.toString()}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </CardTitle>
          <CardDescription>Choose what you want to be notified about</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NotificationRow
            label="Email notifications"
            description="Receive updates about your account"
            defaultChecked
          />
          <NotificationRow
            label="Processing complete"
            description="Get notified when a video is ready to view"
            defaultChecked
          />
          <NotificationRow
            label="Weekly summary"
            description="A weekly recap of your activity"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Security
          </CardTitle>
          <CardDescription>Manage your password and sessions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SecurityRow
            label="Change password"
            description="Update your account password"
            actionLabel="Change"
          />
          <SecurityRow
            label="Active sessions"
            description="Manage devices where you're signed in"
            actionLabel="View"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI preferences
          </CardTitle>
          <CardDescription>Configure AI features</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <NotificationRow
            label="Auto-generate summaries"
            description="Create AI summaries for new videos"
            defaultChecked
          />
          <NotificationRow
            label="Smart clip suggestions"
            description="Highlight important moments automatically"
            defaultChecked
          />
          <NotificationRow
            label="Show citation timestamps"
            description="Include source references in answers"
            defaultChecked
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-4 w-4" />
            Danger zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Delete account</p>
              <p className="text-xs text-muted-foreground">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (!confirm("Delete your account? This cannot be undone.")) return;
                await logout();
                toast({ title: "Signed out" });
              }}
            >
              Delete account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="mt-2 text-lg font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function NotificationRow({
  label,
  description,
  defaultChecked,
}: {
  label: string;
  description: string;
  defaultChecked?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <label className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center">
        <input
          type="checkbox"
          defaultChecked={defaultChecked}
          className="peer sr-only"
        />
        <span className="h-5 w-9 rounded-full bg-input transition-colors peer-checked:bg-primary" />
        <span className="absolute left-0.5 h-4 w-4 rounded-full bg-background transition-transform peer-checked:translate-x-4 shadow" />
      </label>
    </div>
  );
}

function SecurityRow({
  label,
  description,
  actionLabel,
}: {
  label: string;
  description: string;
  actionLabel: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Button variant="outline" size="sm">
        {actionLabel}
      </Button>
    </div>
  );
}
