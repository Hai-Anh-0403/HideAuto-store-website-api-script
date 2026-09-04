'use client';

import { ScriptListItem } from '@/features/catalog/script-list-item';
import type { PublicScriptSummary } from '@/types';
import type { CatalogScript } from '@/features/catalog/data';
import { useI18n } from '@/i18n';

export function HeroFeaturedScripts({ scripts }: { scripts: (PublicScriptSummary | CatalogScript)[] }) {
  const { t } = useI18n();

  return (
    <div className="hero-featured">
      <p className="label">{t('home.featuredScripts')}</p>
      {scripts.slice(0, 4).map((script, index) => (
        <ScriptListItem
          key={'id' in script ? script.id : script.slug}
          script={script}
          priority={index < 2}
        />
      ))}
    </div>
  );
}

