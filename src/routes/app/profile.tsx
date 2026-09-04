import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/server/profile";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { signOut } from "@/lib/auth/client";
import { useState } from "react";
import { toast } from "sonner";
import { Bell, IdCard, Landmark, Layers, Settings, Share2, Shield } from "lucide-react";

export const Route = createFileRoute("/app/profile")({ component: Profile });

function Profile() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      updateMyProfile({
        data: {
          displayName: name ?? q.data?.displayName,
          phone: phone ?? q.data?.phone ?? "",
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["shell"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const p = q.data;

  const links = [
    { to: "/app/ids" as const, label: "My IDs", icon: IdCard },
    { to: "/app/qualification" as const, label: "Land Qualification", icon: Landmark },
    { to: "/app/packages" as const, label: "Packages", icon: Layers },
    { to: "/app/invite" as const, label: "Invite", icon: Share2 },
    { to: "/app/notifications" as const, label: "Notifications", icon: Bell },
    { to: "/app/settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div>
      <PageHeader title="Profile" hint={p.role === "admin" ? "Administrator" : "Member"} />
      <Card tone="info">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" value={name ?? p.displayName} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={p.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="phone">Mobile</Label>
            <Input
              id="phone"
              value={phone ?? p.phone ?? ""}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="OTP-ready — not required yet"
            />
            <p className="mt-1 text-xs text-muted">
              {p.phoneVerified ? "Verified" : "Mobile verification is prepared, not required."}
            </p>
          </div>
          <p className="text-xs text-muted">
            Referral code <span className="font-mono font-medium text-ink">{p.referralCode}</span>
          </p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </form>
      </Card>

      <div className="mt-4 overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-card)]">
        {links.map((l) => {
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className="flex h-12 items-center gap-3 border-b border-border px-4 text-sm last:border-0"
            >
              <Icon className="size-4 text-muted" strokeWidth={1.75} />
              {l.label}
            </Link>
          );
        })}
        {p.role === "admin" ? (
          <Link to="/admin" className="flex h-12 items-center gap-3 px-4 text-sm">
            <Shield className="size-4 text-muted" strokeWidth={1.75} />
            Admin
          </Link>
        ) : null}
      </div>

      <Button
        className="mt-6 w-full"
        variant="outline"
        onClick={() => void signOut("/login")}
      >
        Sign out
      </Button>
    </div>
  );
}
