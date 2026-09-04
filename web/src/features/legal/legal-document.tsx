'use client';

import { useI18n } from '@/i18n';

export function LegalDocument({ type }: { type: 'policies' | 'terms' }) {
  const { t } = useI18n();
  const isPolicies = type === 'policies';

  return (
    <main className="shell section legal-page">
      <p className="label">
        {t(isPolicies ? 'legal.policiesLabel' : 'legal.termsLabel')}
      </p>
      <h1>{t(isPolicies ? 'legal.policiesTitle' : 'legal.termsTitle')}</h1>
      <p className="lead">
        {t(
          isPolicies
            ? 'legal.policiesDescription'
            : 'legal.termsDescription',
        )}
      </p>
      <div className="legal-notice">{t('legal.draftNotice')}</div>
      <div className="legal-sections">
        {isPolicies ? (
          <>
            <section>
              <h2>{t('legal.privacyTitle')}</h2>
              <p>{t('legal.privacyDescription')}</p>
            </section>
            <section>
              <h2>{t('legal.licenseTitle')}</h2>
              <p>{t('legal.licenseDescription')}</p>
            </section>
            <section>
              <h2>{t('legal.refundTitle')}</h2>
              <p>{t('legal.refundDescription')}</p>
            </section>
          </>
        ) : (
          <>
            <section>
              <h2>{t('legal.marketplaceTitle')}</h2>
              <p>{t('legal.marketplaceDescription')}</p>
            </section>
            <section>
              <h2>{t('legal.sellerTermsTitle')}</h2>
              <p>{t('legal.sellerTermsDescription')}</p>
            </section>
            <section>
              <h2>{t('legal.contactTitle')}</h2>
              <p>{t('legal.contactDescription')}</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
