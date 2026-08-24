'use client'

/** A deterministic coloured badge with the app's initials — its hue is stable per name. */
const HUES = [222, 330, 158, 40, 275, 18, 192, 268]

function hash(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function abbr(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '')
  return (letters || '?').toUpperCase()
}

export function AppIcon({ name, size = 34 }: { name: string; size?: number }) {
  const hue = HUES[hash(name) % HUES.length]
  return (
    <span
      className="app-icon"
      style={{
        width: size,
        height: size,
        fontSize: size < 42 ? 12 : 16,
        background: `hsl(${hue} 70% 55% / 0.16)`,
        color: `hsl(${hue} 62% 52%)`,
      }}
      aria-hidden
    >
      {abbr(name)}
    </span>
  )
}
