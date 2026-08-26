import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { STANDARD_ID_VALUE_BDT, RULE_VERSION } from "@/lib/rules";
import { formatBdt } from "@/lib/money";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  return (
    <div>
      <PageHeader title="Settings" hint="Business rules are locked and calculated on the server." />
      <Card className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-muted">Standard ID value</span>
          <span className="tabular font-medium">{formatBdt(STANDARD_ID_VALUE_BDT)}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Rule version</span>
          <span className="font-medium">v{RULE_VERSION}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">KYC</span>
          <span className="font-medium">Not required</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-muted">Admin bootstrap</span>
          <span className="font-medium">Preview only</span>
        </div>
      </Card>
      <p className="mt-4 text-sm text-muted">
        Update your name and mobile on{" "}
        <Link to="/app/profile" className="font-medium text-accent">
          Profile
        </Link>
        .
      </p>
    </div>
  );
}
