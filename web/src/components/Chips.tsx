'use client'

import { Pill } from '@/components/Pill'
import { useI18n } from '@/i18n'
import type { Capabilities } from '@/types'

/**
 * The two chip rows that describe what a mini app touches.
 *
 * Both used to be copy-pasted into four screens, each printing the raw values straight
 * from the graph — a Vietnamese seller read "browser", "keyboard", "shell". They live
 * here so the wording is translated once and stays the same everywhere.
 */

/** Node groups, e.g. `browser` → "Trình duyệt". */
export function GroupChips({
  groups,
  inline = false,
}: {
  groups: string[]
  inline?: boolean
}) {
  const { tryT } = useI18n()

  return (
    <span className="chips" style={inline ? { display: 'inline-flex' } : undefined}>
      {groups.map((g) => (
        <span key={g} className="groupchip" data-group={g}>
          {/* A newer hideflow may ship a group this build has no name for; showing the
              raw code beats showing a blank chip or a translation key. */}
          {tryT(`group.${g}`, g)}
        </span>
      ))}
    </span>
  )
}

/** What the app needs at run time: browser platform, shell, proxy, AI, email, 2FA. */
export function CapsChips({ caps }: { caps: Capabilities | undefined }) {
  const { t } = useI18n()
  if (!caps) return null

  return (
    <div className="chips">
      {caps.browser_platforms?.map((p) => (
        <Pill key={p} tone="accent">
          {p}
        </Pill>
      ))}
      {caps.uses_shell && <Pill tone="bad">{t('cap.shell')}</Pill>}
      {caps.requires_proxy && <Pill tone="neutral">{t('cap.proxy')}</Pill>}
      {caps.uses_ai_llm && <Pill tone="accent">{t('cap.ai')}</Pill>}
      {caps.uses_email && <Pill tone="neutral">{t('cap.email')}</Pill>}
      {caps.uses_2fa && <Pill tone="warn">{t('cap.twoFa')}</Pill>}
    </div>
  )
}
