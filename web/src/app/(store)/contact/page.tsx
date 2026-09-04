'use client';

import Link from 'next/link';
import { ContactForm } from '@/features/support';
import { StoreHeader } from '@/shared/ui/store-header';
import { StoreFooter } from '@/shared/ui/store-footer';
import { useI18n } from '@/i18n';
import { useSearchParams } from 'next/navigation';
import { BackButton } from '@/shared/ui/back-button';
import { Suspense } from 'react';
import { api } from '@/lib/api';
import { useFetch } from '@/lib/useFetch';
import type { PublicScriptDetail } from '@/types';

function ContactContent() {
  const searchParams = useSearchParams();
  const scriptSlug = searchParams.get('script');
  const { t } = useI18n();

  const scriptResult = useFetch(
    () =>
      scriptSlug
        ? api.get<PublicScriptDetail>(`/store/scripts/${encodeURIComponent(scriptSlug)}`)
        : Promise.resolve(null),
    `contact-script-${scriptSlug ?? 'none'}`,
  );

  const product = scriptResult.data
    ? {
        name: scriptResult.data.name,
        seller: scriptResult.data.seller.displayName,
      }
    : scriptSlug
    ? {
        name: scriptSlug,
        seller: 'HideAuto Seller',
      }
    : null;

  return (
    <>
      <StoreHeader />
      <main className="shell section">
        <div className="back-button-wrapper">
          <BackButton fallbackHref="/scripts" />
        </div>
        <p className="label">{t('contact.requestDetailsLabel')}</p>
        <div className="hero-grid">
          <ContactForm product={product} />
          <aside className="purchase">
            <p className="label">{t('contact.whatHappensNext')}</p>
            <h2>{t('contact.directAndClear')}</h2>
            <p>{t('contact.sellerReplyNotice')}</p>
            <small>{t('contact.privacyNote')}</small>
            <Link href="/scripts">{t('contact.returnToCatalog')}</Link>
          </aside>
        </div>
      </main>
      <StoreFooter />
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactContent />
    </Suspense>
  );
}

