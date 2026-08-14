import { Pill } from './Pill'
import type { Capabilities } from '../types'

/** Những gì store suy ra từ graph — dùng chung ở danh sách, chi tiết và bước xem trước. */
export function CapsChips({ caps }: { caps: Capabilities }) {
  return (
    <div className="chips">
      {caps.requires_browser && <Pill tone="accent">Browser: {caps.browser_platforms.join(', ')}</Pill>}
      {caps.requires_proxy && <Pill tone="neutral">Proxy</Pill>}
      {caps.uses_fingerprint && <Pill tone="neutral">Fingerprint</Pill>}
      {caps.uses_ai_llm && <Pill tone="neutral">AI: {caps.ai_providers.join(', ') || 'llm'}</Pill>}
      {caps.uses_email && <Pill tone="neutral">Email</Pill>}
      {caps.uses_google_sheets && <Pill tone="neutral">Google Sheets</Pill>}
      {caps.uses_filesystem && <Pill tone="neutral">File</Pill>}
      {caps.uses_2fa && <Pill tone="neutral">2FA</Pill>}
      {caps.uses_shell && <Pill tone="bad">⚠ Shell (runCommand)</Pill>}
    </div>
  )
}
