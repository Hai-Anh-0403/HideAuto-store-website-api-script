import { redirect } from 'next/navigation'

/** Old overview link; `/upload` would otherwise match `[id]` and hit GET /scripts/upload. */
export default function MiniAppUploadRedirectPage() {
  redirect('/portal/mini-apps/new')
}
