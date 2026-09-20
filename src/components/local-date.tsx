import { useEffect, useState } from "react";
import { formatDate, formatDateTime } from "@/lib/format";
import { useLocale } from "@/lib/i18n";

export function LocalDate({
  iso,
  time = false,
  className,
}: {
  iso: string | null | undefined;
  time?: boolean;
  className?: string;
}) {
  const { locale } = useLocale();
  const [label, setLabel] = useState("—");

  useEffect(() => {
    setLabel(time ? formatDateTime(iso, locale) : formatDate(iso, locale));
  }, [iso, time, locale]);

  if (!iso) return <span className={className}>—</span>;
  return (
    <time className={className} dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}
