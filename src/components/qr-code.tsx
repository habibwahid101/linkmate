import { qrMatrix } from "@/lib/qr";
import { useMemo } from "react";

export function QrCode({ value, size = 176 }: { value: string; size?: number }) {
  const matrix = useMemo(() => qrMatrix(value), [value]);
  const n = matrix.length;
  const cell = n ? size / n : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="rounded-lg bg-surface"
      role="img"
      aria-label="Referral QR code"
    >
      <rect width={size} height={size} fill="#FFFcf7" />
      {matrix.map((row, y) =>
        row.map((on, x) =>
          on ? (
            <rect
              key={`${x}-${y}`}
              x={x * cell}
              y={y * cell}
              width={cell}
              height={cell}
              fill="#161513"
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
