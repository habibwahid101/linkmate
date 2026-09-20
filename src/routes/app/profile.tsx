import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/server/profile";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { AccountAvatar } from "@/components/avatar";
import { LocalDate } from "@/components/local-date";
import { signOut } from "@/lib/auth/client";
import { useT } from "@/lib/i18n";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Bell, IdCard, Landmark, Layers, Settings, Share2, Shield } from "lucide-react";

export const Route = createFileRoute("/app/profile")({ component: Profile });

async function readAvatarFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Use a JPEG, PNG, or WebP image");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large");
  }
  const bitmap = await createImageBitmap(file);
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size);
  bitmap.close();
  const data = canvas.toDataURL("image/jpeg", 0.82);
  if (data.length > 180_000) throw new Error("Image is too large");
  return data;
}

function Profile() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const save = useMutation({
    mutationFn: (extra?: { avatarData?: string | null }) =>
      updateMyProfile({
        data: {
          displayName: name ?? q.data?.displayName,
          phone: phone ?? q.data?.phone ?? "",
          ...extra,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["shell"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(t("profile.saved"));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  const p = q.data;

  const links = [
    { to: "/app/ids" as const, label: t("shell.ids"), icon: IdCard },
    { to: "/app/qualification" as const, label: t("shell.land"), icon: Landmark },
    { to: "/app/packages" as const, label: t("shell.packages"), icon: Layers },
    { to: "/app/invite" as const, label: t("shell.invite"), icon: Share2 },
    { to: "/app/notifications" as const, label: t("shell.notes"), icon: Bell },
    { to: "/app/settings" as const, label: t("shell.settings"), icon: Settings },
  ];

  async function onPickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const avatarData = await readAvatarFile(file);
      await save.mutateAsync({ avatarData });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update photo");
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <PageHeader title={t("profile.title")} hint={p.role === "admin" ? t("profile.admin") : t("profile.member")} />
      {p.role === "admin" ? (
        <Link
          to="/admin"
          className="mb-4 flex h-12 items-center justify-between rounded-2xl bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          <span className="inline-flex items-center gap-3">
            <Shield className="size-4" strokeWidth={1.75} />
            Admin
          </span>
          <span className="text-xs font-normal text-accent-fg/80">Open console</span>
        </Link>
      ) : null}
      <Card tone="info">
        <div className="mb-5 flex items-center gap-4">
          <AccountAvatar name={p.displayName} src={p.avatarData} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{t("profile.photo")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{t("profile.photoHint")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => void onPickPhoto(e.target.files?.[0])}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={photoBusy || save.isPending}
                onClick={() => fileRef.current?.click()}
              >
                {photoBusy ? t("profile.saving") : t("profile.change")}
              </Button>
              {p.avatarData ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={photoBusy || save.isPending}
                  onClick={() => save.mutate({ avatarData: null })}
                >
                  {t("profile.remove")}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate({});
          }}
        >
          <div>
            <Label htmlFor="name">{t("auth.name")}</Label>
            <Input id="name" value={name ?? p.displayName} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input id="email" value={p.email ?? ""} disabled />
          </div>
          <div>
            <Label htmlFor="phone">{t("profile.mobile")}</Label>
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
            {t("profile.code")} <span className="font-mono font-medium text-ink">{p.referralCode}</span>
          </p>
          {p.activeId ? (
            <p className="text-xs text-muted">
              {t("dash.membershipId")} <span className="font-mono font-medium text-ink">{p.activeId}</span>
            </p>
          ) : null}
          <p className="text-xs text-muted">
            {t("dash.joined")} <LocalDate iso={p.createdAt} time />
          </p>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? t("profile.saving") : t("profile.save")}
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
        {t("shell.signout")}
      </Button>
    </div>
  );
}
