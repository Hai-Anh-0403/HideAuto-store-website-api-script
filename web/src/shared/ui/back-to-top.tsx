'use client';

import { ArrowUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n';

export function BackToTop() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    let handle = 0;
    const updateVisibility = () => {
      handle = window.requestAnimationFrame(() => {
        setIsVisible(window.scrollY > 320);
      });
    };
    window.addEventListener('scroll', updateVisibility, { passive: true });

    return () => {
      window.removeEventListener('scroll', updateVisibility);
      if (handle) window.cancelAnimationFrame(handle);
    };
  }, []);

  const scrollToTop = () => {
    const startPosition = window.scrollY;
    const duration = Math.min(900, Math.max(400, startPosition * 0.35));
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 4;

      window.scrollTo(0, Math.round(startPosition * (1 - easedProgress)));

      if (progress < 1) window.requestAnimationFrame(animate);
    };

    window.requestAnimationFrame(animate);
  };

  return (
    <button
      className={['back-to-top', isVisible && 'back-to-top--visible']
        .filter(Boolean)
        .join(' ')}
      type="button"
      aria-label={t('common.backToTop')}
      onClick={scrollToTop}
    >
      <ArrowUp size={18} aria-hidden="true" />
    </button>
  );
}
