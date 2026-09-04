'use client';

import { advertisingPlacements, type AdvertisingPlacement } from './data';
import { useI18n } from '@/i18n';

export function AdSlot({
  slotId,
  compact = false,
}: {
  slotId: AdvertisingPlacement['slotId'];
  compact?: boolean;
}) {
  const { t } = useI18n();
  const placement = advertisingPlacements.find(
    (item) => item.slotId === slotId,
  );
  return (
    <aside
      className={`ad-slot border border-dashed border-[var(--line)] bg-[var(--panel)] text-center transition-colors ${
        compact ? 'p-3 my-4' : 'p-6 md:p-8 my-8'
      }`}
      aria-label={t('advertising.ariaLabel')}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-widest text-[var(--steel)] font-semibold block mb-1">
        {placement?.label.toUpperCase() ?? t('advertising.defaultLabel')}
      </span>
      <strong className="font-heading font-bold text-lg md:text-xl uppercase text-[var(--ink)] block my-1">
        {t('advertising.reservedPlacement', { slotId })}
      </strong>
      <p className="text-xs text-[var(--muted)] m-0">
        {t(
          placement?.active
            ? 'advertising.campaignActive'
            : 'advertising.campaignAvailable',
        )}
      </p>
    </aside>
  );
}
