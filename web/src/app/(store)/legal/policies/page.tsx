import { LegalDocument } from '@/features/legal';
import { StoreFooter } from '@/shared/ui/store-footer';
import { StoreHeader } from '@/shared/ui/store-header';

export default function PoliciesPage() {
  return (
    <>
      <StoreHeader />
      <main className="shell section legal-page">
        <LegalDocument type="policies" />
      </main>
      <StoreFooter />
    </>
  );
}
