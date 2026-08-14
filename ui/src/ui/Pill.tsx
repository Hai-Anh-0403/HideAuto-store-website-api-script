import type { ReactNode } from 'react'
import type { Tone } from '../lib/pills'

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>
}
