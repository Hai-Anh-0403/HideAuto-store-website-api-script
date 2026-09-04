'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n';

const products = [
  {
    slug: 'hideauto-browser-automation',
    name: 'HideAuto Browser Automation',
    category: 'home.products.browserAutomationCategory',
    description: 'home.products.browserAutomationDescription',
  },
  {
    slug: 'hideauto-profile-manager',
    name: 'HideAuto Profile Manager',
    category: 'home.products.profileManagerCategory',
    description: 'home.products.profileManagerDescription',
  },
  {
    slug: 'hideauto-data-toolkit',
    name: 'HideAuto Data Toolkit',
    category: 'home.products.dataToolkitCategory',
    description: 'home.products.dataToolkitDescription',
  },
] as const;

export function HideAutoProducts() {
  const { t } = useI18n();

  return (
    <section className="shell section hideauto-products">
      <div className="heading">
        <div>
          <p className="label">
            06 / {t('home.products.label')}
          </p>
          <h2>{t('home.products.title')}</h2>
        </div>
        <p>{t('home.products.introduction')}</p>
      </div>
      <div className="hideauto-products-grid">
        {products.map(({ slug, name, category, description }) => (
          <article key={slug}>
            <Image
              src="/images/icon.png"
              alt="HideAuto"
              width={48}
              height={48}
            />
            <p className="label">{t(category)}</p>
            <h3>{name}</h3>
            <p>{t(description)}</p>
            <Link href={`/contact?product=${slug}`}>
              {t('home.products.learnMore')} <ArrowRight size={15} />
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
