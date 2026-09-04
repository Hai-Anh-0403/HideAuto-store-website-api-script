import { LegalDocument } from '@/features/legal';
import { StoreFooter } from '@/shared/ui/store-footer';
import { StoreHeader } from '@/shared/ui/store-header';

export default function TermsPage() {
  return (
    <>
      <StoreHeader />
      <main className="shell section legal-page">
        <LegalDocument type="terms" />
      </main>
      <StoreFooter />
    </>
  );
}
