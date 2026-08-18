/**
 * Repackage a stored graph into a downloadable mini-app.
 *
 * The store keeps the small scrubbed graph, not the huge installer, and rebuilds the
 * package on demand by injecting `resources/app.workflow` into a prebuilt "empty
 * mini-app" template (see `docs/script-publish-packaging.md` §4.1).
 *
 * This is pure file work, so it runs anywhere. What it deliberately cannot do is rename
 * or re-icon the `.exe` — that needs `rcedit` on Windows, i.e. the build-agent path (§4.2).
 */

import { ServiceUnavailableException } from '@nestjs/common';
import JSZip from 'jszip';
import type { Json } from '../common/graph/workflow-graph';

export const APP_WORKFLOW_ENTRY = 'resources/app.workflow';

/** The `store` block a packaged mini app uses to phone home and verify its licence. */
export interface StoreBlock {
  baseUrl: string;
  scriptId: string;
  sellerName: string;
  licensePublicKey: string;
  licenseAlgorithm: 'Ed25519';
}

export interface AppWorkflowEnvelope {
  version: 1;
  appName: string;
  appId: string;
  workflowId: string;
  workflowName: string;
  builtAt: string;
  workflow: Json;
  store?: StoreBlock;
}

export interface BuiltPackage {
  body: Buffer;
  filename: string;
}

/**
 * Inject the envelope into a copy of the template archive.
 *
 * Entry metadata (dates, permissions) is preserved so the produced archive stays as close
 * to the template as possible; only `resources/app.workflow` is replaced or added.
 */
export async function buildMiniAppPackage(
  template: Buffer,
  envelope: AppWorkflowEnvelope,
  slug: string,
): Promise<BuiltPackage> {
  let source: JSZip;
  try {
    source = await JSZip.loadAsync(template);
  } catch (err) {
    throw new ServiceUnavailableException(
      `Mini-app template is not a readable archive: ${(err as Error).message}`,
    );
  }

  const out = new JSZip();
  let injected = false;

  for (const entry of Object.values(source.files)) {
    if (entry.dir) continue;
    const normalized = entry.name.replace(/\\/g, '/').toLowerCase();
    if (normalized.endsWith(APP_WORKFLOW_ENTRY)) {
      // The template is supposed to ship without a workflow; if it has one, replace it
      // in place so the entry keeps its original location inside the app folder.
      out.file(entry.name, JSON.stringify(envelope, null, 2), { date: entry.date });
      injected = true;
      continue;
    }
    out.file(entry.name, await entry.async('nodebuffer'), { date: entry.date });
  }

  if (!injected) {
    out.file(APP_WORKFLOW_ENTRY, JSON.stringify(envelope, null, 2));
  }

  const body = await out.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return { body, filename: `${slug}.zip` };
}
