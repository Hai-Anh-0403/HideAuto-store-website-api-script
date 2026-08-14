import type { ReactNode } from 'react'

export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>
}

export function CardHead({ title, actions }: { title: ReactNode; actions?: ReactNode }) {
  return (
    <div className="card-h">
      <h3>{title}</h3>
      <div className="sp" />
      {actions}
    </div>
  )
}

export function CardFoot({ children }: { children: ReactNode }) {
  return (
    <div className="card-foot">
      <span className="note">{children}</span>
    </div>
  )
}
