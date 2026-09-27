import { useId } from "react";

/**
 * The Commish mark: a refund window drawn as an arc that sweeps from amber
 * (held) to green (paid), closing on a solid coin, the moment the payout
 * moves. Read as a "C" at small sizes.
 */
export function Mark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-arc`} x1="26" y1="6" x2="22" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F5B544" />
          <stop offset="0.55" stopColor="#9EE06B" />
          <stop offset="1" stopColor="#3DDC97" />
        </linearGradient>
      </defs>
      <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#0B0B0E" stroke="rgb(255 255 255 / 0.12)" />
      {/* 270 degree arc, open on the right */}
      <path
        d="M23.07 8.93A10 10 0 1 0 23.07 23.07"
        stroke={`url(#${id}-arc)`}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <circle cx="24.4" cy="16" r="2.6" fill="#3DDC97" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <Mark />
      <span className="text-[17px] font-semibold tracking-[-0.02em]">commish</span>
    </span>
  );
}
