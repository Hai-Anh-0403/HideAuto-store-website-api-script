/**
 * Pull the workflow graph out of an uploaded artifact.
 *
 * Supported containers (see `docs/script-publish-packaging.md` §1.2):
 *
 * * **mini-app package** (`.zip`, or an `.exe` that is really a zip of the app folder) —
 *   read `resources/app.workflow`, a plain-JSON envelope holding the graph.
 * * **bare `app.workflow` / graph JSON** — the same envelope, or the graph on its own.
 *
 * `.hideflow` exports are encrypted with a key that lives inside the desktop app, so the
 * store cannot open them; those uploads are rejected with an explicit message.
 *
 * Everything here treats the archive as hostile: entry names are validated, entry count and
 * decompressed size are capped, and only the single entry we need is ever read.
 */

import { UnprocessableEntityException } from '@nestjs/common';
import JSZip from 'jszip';
import type { Json } from './workflow-graph';

const APP_WORKFLOW_ENTRY = 'resources/app.workflow';
const HIDEFLOW_MAGIC = Buffer.from('HFLW');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_WORKFLOW_ENTRY_BYTES = 32 * 1024 * 1024;

/**
 * A packed installer is unreadable by design, so an `.exe` we cannot get a graph out of
 * is accepted as an opaque build instead of rejected — see `opaquePackage`. A `.zip`
 * stays strict: it is readable, so a missing app.workflow really means "not a mini app".
 */
const OPAQUE_SUFFIX = '.exe';

export const EMPTY_GRAPH: Json = { nodes: [], edges: [], variables: [] };

export type DeliveryFormat = 'graph_json' | 'mini_app_exe';

/** The graph plus whatever identity the container carried with it. */
export interface ExtractedPackage {
  graph: Json;
  delivery: DeliveryFormat;
  appName: string | null;
  appId: string | null;
  workflowId: string | null;
  workflowName: string | null;
  /**
   * False when the container gave up no graph — every derived field is then empty and
   * the scan result means "nothing was scanned", not "nothing was found".
   */
  graphExtracted: boolean;
}

function fail(message: string): never {
  throw new UnprocessableEntityException(message);
}

function stem(filename: string): string {
  const base = filename.replace(/\\/g, '/').split('/').pop() ?? '';
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

/**
 * A mini-app binary whose graph the store cannot read (yet).
 *
 * TEMPORARY: a packed `.exe` keeps its workflow behind the desktop app's key, so there
 * is nothing to parse until that key handling lands. The build is accepted so the
 * seller can get it into the store, but it carries an empty graph and
 * `graphExtracted=false` — no metadata is invented, and nothing claims it was scanned.
 */
function opaquePackage(filename: string): ExtractedPackage {
  return {
    graph: structuredClone(EMPTY_GRAPH),
    delivery: 'mini_app_exe',
    appName: stem(filename) || null,
    appId: null,
    workflowId: null,
    workflowName: null,
    graphExtracted: false,
  };
}

/** Reject absolute paths, drive letters and `..` segments (zip-slip). */
function entryNameIsSafe(name: string): boolean {
  if (name.startsWith('/') || name.startsWith('\\') || name.includes(':')) {
    return false;
  }
  return !name.replace(/\\/g, '/').split('/').includes('..');
}

function parseJson(raw: string, what: string): Json {
  let parsed: unknown;
  try {
    // Strip a UTF-8 BOM: Windows editors add one routinely and JSON.parse chokes on it.
    parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw);
  } catch (err) {
    fail(`${what} is not valid JSON: ${(err as Error).message}`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail(`${what} must be a JSON object`);
  }
  return parsed as Json;
}

/** Accept an `app.workflow` envelope, an export payload, or a bare graph. */
function graphFromEnvelope(payload: Json, what: string): Json {
  let candidate = payload;
  for (const key of ['workflow', 'data']) {
    const nested = payload[key];
    if (nested !== null && typeof nested === 'object' && !Array.isArray(nested)) {
      candidate = nested as Json;
      break;
    }
  }
  if (!Array.isArray(candidate.nodes)) {
    fail(`${what} does not contain a workflow graph (missing nodes)`);
  }
  return candidate;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function fromEnvelope(
  envelope: Json,
  what: string,
  delivery: DeliveryFormat,
): ExtractedPackage {
  return {
    graph: graphFromEnvelope(envelope, what),
    delivery,
    appName: strOrNull(envelope.appName),
    appId: strOrNull(envelope.appId),
    workflowId: strOrNull(envelope.workflowId),
    workflowName: strOrNull(envelope.workflowName),
    graphExtracted: true,
  };
}

/** Locate `resources/app.workflow`; the shallowest match wins (the real app root). */
function findAppWorkflow(zip: JSZip): JSZip.JSZipObject | null {
  const entries = Object.values(zip.files);
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    fail('Archive has too many entries');
  }

  let match: JSZip.JSZipObject | null = null;
  let matchDepth = -1;
  for (const entry of entries) {
    if (!entryNameIsSafe(entry.name)) {
      fail(`Unsafe path in archive: ${entry.name}`);
    }
    const normalized = entry.name.replace(/\\/g, '/').toLowerCase();
    if (
      normalized === APP_WORKFLOW_ENTRY ||
      normalized.endsWith(`/${APP_WORKFLOW_ENTRY}`)
    ) {
      const depth = (normalized.match(/\//g) ?? []).length;
      if (match === null || depth < matchDepth) {
        match = entry;
        matchDepth = depth;
      }
    }
  }
  return match;
}

/** Identify the container, pull out the graph, and keep the mini-app identity. */
export async function extractPackage(
  content: Buffer,
  filename: string,
): Promise<ExtractedPackage> {
  if (content.subarray(0, HIDEFLOW_MAGIC.length).equals(HIDEFLOW_MAGIC)) {
    fail(
      'Encrypted .hideflow exports are not supported yet — upload the mini-app ' +
        'package (.zip/.exe) instead',
    );
  }

  const lower = filename.toLowerCase();
  const isOpaqueBinary = lower.endsWith(OPAQUE_SUFFIX);

  if (content.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(content);
    } catch (err) {
      fail(`Cannot read archive: ${(err as Error).message}`);
    }

    const entry = findAppWorkflow(zip);
    if (entry === null) {
      if (isOpaqueBinary) return opaquePackage(filename);
      fail(
        'No resources/app.workflow found — is this a hideflow mini-app package?',
      );
    }

    const raw = await entry.async('nodebuffer');
    if (raw.length > MAX_WORKFLOW_ENTRY_BYTES) {
      fail('resources/app.workflow is too large');
    }

    return fromEnvelope(
      parseJson(raw.toString('utf8'), APP_WORKFLOW_ENTRY),
      APP_WORKFLOW_ENTRY,
      'mini_app_exe',
    );
  }

  if (lower.endsWith('.json') || lower.endsWith('.workflow')) {
    return fromEnvelope(
      parseJson(content.toString('utf8'), filename),
      filename,
      'graph_json',
    );
  }

  if (isOpaqueBinary) {
    // A packed installer, not a zip of the app folder: take it as an opaque build.
    return opaquePackage(filename);
  }

  fail(
    'Unsupported upload — expected a mini-app package (.zip/.exe) or an app.workflow ' +
      '/ graph .json file',
  );
}
