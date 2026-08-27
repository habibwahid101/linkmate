import { useNavigate } from "@tanstack/react-router";
import { Modal } from "@/components/modal";
import { QualificationReminder } from "@/components/qualification-reminder";
import { PackageCard } from "@/components/package-card";
import { PACKAGE_LIST, type PackageId } from "@/lib/rules";

export function BookingSheet({
  open,
  onClose,
  signedIn,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
}) {
  const nav = useNavigate();

  function select(id: PackageId) {
    try {
      window.localStorage.setItem("lm-pkg", id);
    } catch {
      // ignore quota
    }
    onClose();
    if (signedIn) {
      void nav({ to: "/app/packages" });
    } else {
      window.location.assign(`/signup?pkg=${encodeURIComponent(id)}`);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Select a membership package" size="xl" compact>
      <QualificationReminder compact />
      <div className="mt-3 grid items-stretch gap-2.5 sm:grid-cols-2">
        {PACKAGE_LIST.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            cta="Select Package"
            compact
            onSelect={() => select(pkg.id)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        Selecting a larger package issues more IDs. It does not replace the sponsor-3 and Level-9 land
        qualification, and it does not transfer land on purchase.
      </p>
    </Modal>
  );
}
