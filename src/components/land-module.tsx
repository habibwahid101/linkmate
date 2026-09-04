import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { Button } from "@/components/ui/button";
import { type LandQualification } from "@/lib/qualification";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Modal } from "@/components/modal";

export function LandModule({
  q,
  documents = true,
}: {
  q: LandQualification;
  documents?: boolean;
}) {
  const [docs, setDocs] = useState<"terms" | "allocation" | "transfer" | null>(null);
  return (
    <>
      <Card tone="success">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-success">Land Qualification</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">1 Decimal Land</p>
          </div>
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              q.qualified ? "bg-success-soft text-success" : "bg-held-soft text-held",
            )}
          >
            {q.status}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Membership</dt>
            <dd className="mt-0.5 font-medium">{q.hasMembership ? "Active" : "None"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Mandatory sponsor</dt>
            <dd className="mt-0.5 tabular font-medium">
              {q.sponsorProgress} / {q.sponsorRequired}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Completed levels</dt>
            <dd className="mt-0.5 tabular font-medium">
              {q.completedLevels} / {q.levelsRequired}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Level 9</dt>
            <dd className="mt-0.5 font-medium">{q.level9Released ? "Complete" : "Pending"}</dd>
          </div>
        </dl>
        <div className="mt-4">
          <ProgressBar value={q.completedLevels} max={q.levelsRequired} />
          <p className="mt-2 text-xs text-muted">
            Qualification requires personally sponsoring {q.sponsorRequired} members and completing Level {q.levelsRequired}.
            Allocation and transfer follow the applicable terms and documents.
          </p>
        </div>
        {documents ? (
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setDocs("terms")}>
              View Terms
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setDocs("allocation")}>
              View Allocation Documents
            </Button>
            <Button variant="outline" size="sm" className="w-full" onClick={() => setDocs("transfer")}>
              View Transfer Status
            </Button>
          </div>
        ) : (
          <Link to="/app/qualification" className="mt-4 inline-flex h-11 items-center text-sm font-medium text-accent">
            Open land qualification
          </Link>
        )}
      </Card>
      <Modal
        open={docs !== null}
        onClose={() => setDocs(null)}
        title={
          docs === "terms"
            ? "Land terms & documents"
            : docs === "allocation"
              ? "Allocation documents"
              : "Transfer status"
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Land documents will be available here before final allocation/transfer. No placeholder legal files
          are published. Qualification (sponsor {q.sponsorRequired} + complete Level {q.levelsRequired}) is
          tracked in your dashboard independently of document upload.
        </p>
      </Modal>
    </>
  );
}
