import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDashboard, purchasePackage } from "@/lib/server/member";
import { lookupReferral } from "@/lib/server/profile";
import { PACKAGE_LIST, PACKAGES, type PackageId } from "@/lib/rules";
import { PackageCard } from "@/components/package-card";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Modal } from "@/components/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { formatBdt } from "@/lib/money";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/packages")({ component: Packages });

function Packages() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const [pick, setPick] = useState<PackageId | null>(null);
  const [code, setCode] = useState("");
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const paying = useRef(false);

  function readIdempotencyKey(packageId: PackageId) {
    const storageKey = `lm-idem:${packageId}`;
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    return key;
  }

  function clearIdempotencyKey(packageId: PackageId) {
    sessionStorage.removeItem(`lm-idem:${packageId}`);
  }

  useEffect(() => {
    const stored = window.localStorage.getItem("lm-ref");
    if (stored) setCode(stored.toUpperCase());
  }, []);

  useEffect(() => {
    const c = code.trim();
    if (c.length < 4) {
      setSponsorName(null);
      return;
    }
    const t = setTimeout(() => {
      void lookupReferral({ data: { code: c } }).then((r) => {
        setSponsorName(r.valid ? r.name : null);
      });
    }, 250);
    return () => clearTimeout(t);
  }, [code]);

  const buy = useMutation({
    mutationFn: () =>
      purchasePackage({
        data: {
          packageId: pick!,
          referralCode: code.trim() || undefined,
          idempotencyKey: readIdempotencyKey(pick!),
        },
      }),
    onSuccess: (res) => {
      paying.current = false;
      if (pick) clearIdempotencyKey(pick);
      if (code.trim()) window.localStorage.setItem("lm-ref", code.trim().toUpperCase());
      void qc.invalidateQueries();
      toast.success(`${res.ids.length} ID${res.ids.length === 1 ? "" : "s"} issued. Root ${res.rootId}.`);
      setPick(null);
      void nav({ to: "/app/ids" });
    },
    onError: (e: Error) => {
      paying.current = false;
      toast.error(e.message);
    },
  });

  if (dash.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;

  const current = dash.data.latestPackage;
  const selected = pick ? PACKAGES[pick] : null;

  return (
    <div>
      <PageHeader
        title="Packages"
        hint="Each ID is valued at ৳11,000 for commission. External sponsors attach to your first ID only."
      />
      {dash.data.flags.paymentsMode === "disabled" ? (
        <p className="mb-4 rounded-2xl bg-warning-soft px-4 py-3 text-sm text-warning">
          Purchasing is not open yet. Payment is not connected — this is not a live checkout.
        </p>
      ) : dash.data.flags.paymentsMode === "simulation" ? (
        <p className="mb-4 rounded-2xl bg-held-soft px-4 py-3 text-sm text-held">
          Payment is simulated for preview and testing. No real money is collected.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {PACKAGE_LIST.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            current={current === pkg.id}
            cta={
              dash.data.flags.paymentsMode === "disabled"
                ? "Unavailable"
                : current === pkg.id
                  ? "Buy again"
                  : "Select"
            }
            onSelect={dash.data.flags.paymentsMode === "disabled" ? undefined : () => setPick(pkg.id)}
          />
        ))}
      </div>

      <Modal open={!!pick} onClose={() => !buy.isPending && setPick(null)} title={selected ? `Confirm ${selected.name}` : "Confirm"}>
        {selected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              {formatBdt(selected.amountBdt)} · {selected.idCount} ID{selected.idCount === 1 ? "" : "s"}.
              {dash.data.flags.paymentsMode === "simulation"
                ? " Payment is simulated — not a real charge."
                : ""}
            </p>
            <p className="text-sm">{selected.structureSummary}</p>
            <div>
              <Label htmlFor="ref">Referral code or sponsor ID</Label>
              <Input
                id="ref"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Optional"
                autoCapitalize="characters"
              />
              {sponsorName ? (
                <p className="mt-1.5 text-xs text-success">Sponsor: {sponsorName}. They earn from your first ID only.</p>
              ) : code.trim().length >= 4 ? (
                <p className="mt-1.5 text-xs text-muted">We’ll validate this code on purchase.</p>
              ) : (
                <p className="mt-1.5 text-xs text-muted">Leave blank if you have no sponsor.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                variant="secondary"
                disabled={buy.isPending}
                onClick={() => setPick(null)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={buy.isPending}
                aria-busy={buy.isPending}
                onClick={() => {
                  if (paying.current || buy.isPending) return;
                  paying.current = true;
                  buy.mutate();
                }}
              >
                {buy.isPending ? "Issuing IDs…" : `Pay ${formatBdt(selected.amountBdt)}`}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
