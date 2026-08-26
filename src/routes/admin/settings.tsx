import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminGetSettings, adminUpdateSetting } from "@/lib/server/admin";
import { adminGetPaymentSettings, adminSavePaymentSettings } from "@/lib/server/payments";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PAYMENT_METHOD_LABEL, type PaymentMethod } from "@/lib/payments";
import { publicErrorMessage } from "@/lib/public-error";

export const Route = createFileRoute("/admin/settings")({ component: Settings });

function Settings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["admin", "settings"], queryFn: () => adminGetSettings() });
  const pay = useQuery({ queryKey: ["admin", "pay-settings"], queryFn: () => adminGetPaymentSettings() });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (p: { key: string; value: string }) =>
      adminUpdateSetting({ data: { key: p.key, value: p.value, confirm: true } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      toast.success("Setting updated");
    },
    onError: (e: Error) => toast.error(publicErrorMessage(e)),
  });
  if (q.isPending) return <DashboardSkeleton />;
  if (q.isError) return <QueryError error={q.error} retry={() => q.refetch()} />;
  return (
    <div>
      <PageHeader
        title="Settings"
        hint="standard_id_value_bdt is locked. Configure receiving accounts under Payment methods."
      />
      <h2 className="mb-3 text-sm font-semibold">Payment methods</h2>
      {pay.isPending ? (
        <p className="mb-6 text-sm text-muted">Loading payment methods…</p>
      ) : pay.isError ? (
        <p className="mb-6 text-sm text-danger">Could not load payment methods.</p>
      ) : (
        <div className="mb-8 space-y-3">
          {pay.data.map((row) => (
            <PaymentMethodEditor key={row.method} row={row} />
          ))}
        </div>
      )}
      <h2 className="mb-3 text-sm font-semibold">System</h2>
      <div className="space-y-3">
        {q.data.settings.map((s) => {
          const locked =
            s.key === "standard_id_value_bdt" ||
            s.key === "rule_version" ||
            s.key === "bootstrap_admin" ||
            s.key === "hyper_turbo_placement_version";
          const value = draft[s.key] ?? s.value;
          return (
            <Card key={s.key}>
              <p className="font-mono text-xs text-muted">{s.key}</p>
              <div className="mt-2 flex gap-2">
                <Input
                  value={value}
                  disabled={locked}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                />
                <Button
                  disabled={locked || save.isPending || value === s.value}
                  onClick={() => save.mutate({ key: s.key, value })}
                >
                  Save
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function PaymentMethodEditor({
  row,
}: {
  row: Awaited<ReturnType<typeof adminGetPaymentSettings>>[number];
}) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(row.enabled);
  const [number, setNumber] = useState(row.number ?? "");
  const [accountType, setAccountType] = useState(row.account_type ?? "");
  const [bankName, setBankName] = useState(row.bank_name ?? "");
  const [accountName, setAccountName] = useState(row.account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(row.account_number ?? "");
  const [branch, setBranch] = useState(row.branch ?? "");
  const [routingNumber, setRoutingNumber] = useState(row.routing_number ?? "");
  const [swift, setSwift] = useState(row.swift ?? "");
  const [instructions, setInstructions] = useState(row.instructions ?? "");
  useEffect(() => {
    setEnabled(row.enabled);
    setNumber(row.number ?? "");
    setAccountType(row.account_type ?? "");
    setBankName(row.bank_name ?? "");
    setAccountName(row.account_name ?? "");
    setAccountNumber(row.account_number ?? "");
    setBranch(row.branch ?? "");
    setRoutingNumber(row.routing_number ?? "");
    setSwift(row.swift ?? "");
    setInstructions(row.instructions ?? "");
  }, [row]);
  const save = useMutation({
    mutationFn: () =>
      adminSavePaymentSettings({
        data: {
          method: row.method as PaymentMethod,
          enabled,
          number,
          accountType,
          bankName,
          accountName,
          accountNumber,
          branch,
          routingNumber,
          swift,
          instructions,
          confirm: true,
        },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "pay-settings"] });
      toast.success(`${PAYMENT_METHOD_LABEL[row.method as PaymentMethod]} saved`);
    },
    onError: (e: Error) => toast.error(publicErrorMessage(e)),
  });
  const method = row.method as PaymentMethod;
  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold">{PAYMENT_METHOD_LABEL[method]}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {method === "BKASH" || method === "NAGAD" ? (
          <>
            <Field label="Number" value={number} onChange={setNumber} />
            <Field label="Account type" value={accountType} onChange={setAccountType} />
          </>
        ) : null}
        {method === "BANK" ? (
          <>
            <Field label="Bank name" value={bankName} onChange={setBankName} />
            <Field label="Account name" value={accountName} onChange={setAccountName} />
            <Field label="Account number" value={accountNumber} onChange={setAccountNumber} />
            <Field label="Branch" value={branch} onChange={setBranch} />
            <Field label="Routing number" value={routingNumber} onChange={setRoutingNumber} />
            <Field label="SWIFT" value={swift} onChange={setSwift} />
          </>
        ) : null}
        <div className="sm:col-span-2">
          <Label>Instructions</Label>
          <Input value={instructions} onChange={(e) => setInstructions(e.target.value)} />
        </div>
      </div>
      <Button className="mt-3" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? "Saving…" : "Save method"}
      </Button>
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
