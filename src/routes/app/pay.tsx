import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/server/member";
import { getPaymentMethodsPublic, submitManualPayment } from "@/lib/server/payments";
import { lookupReferral } from "@/lib/server/profile";
import { PACKAGES, PACKAGE_IDS, type PackageId } from "@/lib/rules";
import { PageHeader } from "@/components/page-header";
import { QueryError } from "@/components/query-error";
import { DashboardSkeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { CopyButton } from "@/components/copy-button";
import { formatBdt } from "@/lib/money";
import { publicErrorMessage } from "@/lib/public-error";
import {
  PAYMENT_METHOD_LABEL,
  type PaymentMethod,
  paymentRequiresReference,
} from "@/lib/payments";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const METHODS: PaymentMethod[] = ["BKASH", "NAGAD", "BANK", "CASH"];

export const Route = createFileRoute("/app/pay")({
  validateSearch: (s: Record<string, unknown>) => ({
    pkg: typeof s.pkg === "string" ? s.pkg : "",
  }),
  component: Pay,
});

function isPackageId(v: string): v is PackageId {
  return (PACKAGE_IDS as readonly string[]).includes(v);
}

function Pay() {
  const { pkg: pkgRaw } = Route.useSearch();
  const nav = useNavigate();
  const dash = useQuery({ queryKey: ["dashboard"], queryFn: () => getDashboard() });
  const methods = useQuery({ queryKey: ["pay-methods"], queryFn: () => getPaymentMethodsPublic() });
  const [step, setStep] = useState<"confirm" | "method" | "details">("confirm");
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [code, setCode] = useState("");
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [txn, setTxn] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [senderBank, setSenderBank] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [error, setError] = useState<string | null>(null);

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
      void lookupReferral({ data: { code: c } }).then((r) => setSponsorName(r.valid ? r.name : null));
    }, 250);
    return () => clearTimeout(t);
  }, [code]);

  const submit = useMutation({
    mutationFn: () =>
      submitManualPayment({
        data: {
          packageId: pkg.id,
          method: method!,
          submittedAmountBdt: Number(amount.replace(/[^\d]/g, "")),
          transactionReference: txn.trim() || undefined,
          userNote: note.trim() || undefined,
          referralCode: code.trim() || undefined,
          extra: {
            ...(transferDate ? { transferDate } : {}),
            ...(senderBank ? { senderBank } : {}),
            ...(paidTo ? { receivedBy: paidTo } : {}),
          },
        },
      }),
    onSuccess: (res) => {
      if (code.trim()) window.localStorage.setItem("lm-ref", code.trim().toUpperCase());
      void nav({ to: "/app/payments/$id", params: { id: res.id } });
    },
    onError: (e) => setError(publicErrorMessage(e)),
  });

  if (dash.isPending || methods.isPending) return <DashboardSkeleton />;
  if (dash.isError) return <QueryError error={dash.error} retry={() => dash.refetch()} />;
  if (methods.isError) return <QueryError error={methods.error} retry={() => methods.refetch()} />;
  if (!isPackageId(pkgRaw)) {
    return (
      <div>
        <PageHeader title="Payment" hint="Select a package first." />
        <Link to="/app/packages" className="text-sm font-medium text-accent">
          Back to packages
        </Link>
      </div>
    );
  }
  const pkg = PACKAGES[pkgRaw];
  const selected = methods.data?.find((m) => m.method === method);
  const enabledMethods = METHODS.filter((m) => methods.data?.find((x) => x.method === m)?.enabled);

  return (
    <div className="pb-24">
      <PageHeader title="Pay for membership" hint="Admin verification is required before IDs are issued." />

      {step === "confirm" ? (
        <Card className="space-y-3" tone="package">
          <Row label="Selected package" value={pkg.name} />
          <Row label="Package price" value={formatBdt(pkg.amountBdt)} />
          <Row label="Number of IDs" value={String(pkg.idCount)} />
          <Row label="Payment amount" value={formatBdt(pkg.amountBdt)} />
          <Row label="Payment status" value="Not submitted" />
          <p className="text-sm leading-relaxed text-muted">{pkg.structureSummary}</p>
          <div>
            <Label htmlFor="ref">Referral code (optional)</Label>
            <Input id="ref" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoCapitalize="characters" />
            {sponsorName ? (
              <p className="mt-1.5 text-xs text-success">Sponsor: {sponsorName}. They earn from your first ID only.</p>
            ) : (
              <p className="mt-1.5 text-xs text-muted">Leave blank if you have no sponsor.</p>
            )}
          </div>
          <Button className="w-full" onClick={() => { setAmount(String(pkg.amountBdt)); setStep("method"); }}>
            Continue to Payment
          </Button>
        </Card>
      ) : null}

      {step === "method" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">Pay {formatBdt(pkg.amountBdt)} for {pkg.name}.</p>
          {enabledMethods.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMethod(m); setStep("details"); setError(null); }}
              className="block w-full rounded-2xl bg-surface-info p-4 text-left shadow-[0_0_0_1px_var(--color-border-info)]"
            >
              <p className="font-semibold">{PAYMENT_METHOD_LABEL[m]}</p>
              <p className="mt-1 text-sm text-muted">
                {m === "CASH" ? "Pay in person, then submit for verification." : "Send the exact amount, then submit the transaction ID."}
              </p>
            </button>
          ))}
          {enabledMethods.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">No payment methods are enabled yet. Contact support.</p>
            </Card>
          ) : null}
          <Button variant="ghost" className="w-full" onClick={() => setStep("confirm")}>Back</Button>
        </div>
      ) : null}

      {step === "details" && method && selected ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            submit.mutate();
          }}
        >
          <Card className="space-y-3" tone="info">
            <Row label="Payment method" value={PAYMENT_METHOD_LABEL[method]} />
            <Row label="Amount to pay" value={formatBdt(pkg.amountBdt)} />
            {method === "BKASH" || method === "NAGAD" ? (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2">
                <div>
                  <p className="text-xs text-muted">{PAYMENT_METHOD_LABEL[method]} number</p>
                  <p className="font-mono text-sm">{selected.number || "Not configured"}</p>
                </div>
                {selected.number ? <CopyButton value={selected.number} label="Copy number" /> : null}
              </div>
            ) : null}
            {method === "BANK" ? (
              <div className="space-y-2">
                <DetailCopy label="Bank name" value={selected.bankName} />
                <DetailCopy label="Account name" value={selected.accountName} />
                <DetailCopy label="Account number" value={selected.accountNumber} />
                <DetailCopy label="Branch" value={selected.branch} />
                <DetailCopy label="Routing number" value={selected.routingNumber} />
                <DetailCopy label="SWIFT" value={selected.swift} />
              </div>
            ) : null}
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink">
              {method === "CASH" ? (
                <>
                  <li>Follow the cash instructions below.</li>
                  <li>Pay the exact amount.</li>
                  <li>Submit this form for admin verification.</li>
                </>
              ) : (
                <>
                  <li>Send the exact amount to the details above.</li>
                  <li>Complete the payment from your {PAYMENT_METHOD_LABEL[method]} account.</li>
                  <li>Copy the transaction / reference ID.</li>
                  <li>Paste it below and submit for verification.</li>
                </>
              )}
            </ol>
            {selected.instructions ? <p className="text-sm text-muted">{selected.instructions}</p> : null}
          </Card>

          <div>
            <Label htmlFor="amt">Amount paid *</Label>
            <Input id="amt" inputMode="numeric" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          {paymentRequiresReference(method) ? (
            <div>
              <Label htmlFor="txn">{method === "BANK" ? "Transaction / reference ID *" : "Transaction ID *"}</Label>
              <Input id="txn" required value={txn} onChange={(e) => setTxn(e.target.value)} autoCapitalize="characters" />
            </div>
          ) : (
            <div>
              <Label htmlFor="txn">Receipt reference (optional)</Label>
              <Input id="txn" value={txn} onChange={(e) => setTxn(e.target.value)} />
            </div>
          )}
          {method === "BANK" ? (
            <>
              <div>
                <Label htmlFor="td">Transfer date (optional)</Label>
                <Input id="td" type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="sb">Sender bank (optional)</Label>
                <Input id="sb" value={senderBank} onChange={(e) => setSenderBank(e.target.value)} />
              </div>
            </>
          ) : null}
          {method === "CASH" ? (
            <div>
              <Label htmlFor="pto">Paid to / received by (optional)</Label>
              <Input id="pto" value={paidTo} onChange={(e) => setPaidTo(e.target.value)} />
            </div>
          ) : null}
          <div>
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted">Screenshot upload is not enabled in this version. Keep your receipt until the payment is approved.</p>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="sticky bottom-20 z-10 flex gap-2 lg:bottom-3">
            <Button type="button" variant="secondary" className="flex-1" disabled={submit.isPending} onClick={() => setStep("method")}>
              Back
            </Button>
            <Button type="submit" className="flex-1" disabled={submit.isPending} aria-busy={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit payment request"}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function DetailCopy({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2")}>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="break-all font-mono text-sm">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}
