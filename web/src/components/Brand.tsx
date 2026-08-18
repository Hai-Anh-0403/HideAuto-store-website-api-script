'use client'

export function BrandLogo({ size = 40, detail = false }: { size?: number; detail?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="40" height="40" rx="10" fill="var(--brand)" />
      <path
        d="M12 14h16v2H12v-2zm0 5h16v2H12v-2zm0 5h10v2H12v-2z"
        fill="var(--on-brand)"
        opacity={detail ? 1 : 0.9}
      />
      {detail && (
        <circle cx="30" cy="27" r="4" fill="var(--on-brand)" opacity="0.8" />
      )}
    </svg>
  )
}
