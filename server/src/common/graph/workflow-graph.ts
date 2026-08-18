/**
 * Workflow graph inspection: credential scrubbing + metadata derivation.
 *
 * Uploads are untrusted, so nothing here trusts seller-supplied metadata: every value is
 * read out of the graph itself. Node codes / groups mirror the hideflow app catalog
 * (`src/shared/workflow-nodes.data.ts`) and the credential patterns mirror the app's
 * `detectExportCredentials` so the store flags exactly what the app would flag.
 */

export type Json = Record<string, unknown>;

// --- Node catalog (mirrors the app's NODE_META groups) ------------------------------

const NODE_GROUPS: Record<string, string> = {
  // browser
  openConnect: 'browser',
  browserClose: 'browser',
  disconnect: 'browser',
  // tab
  newTab: 'tab',
  openExtension: 'tab',
  switchExtensionPopup: 'tab',
  closeTab: 'tab',
  gotoUrl: 'tab',
  activeTabs: 'tab',
  switchFrame: 'tab',
  runJs: 'tab',
  screenshot: 'tab',
  getUrl: 'tab',
  getCookie: 'tab',
  setCookies: 'tab',
  clearCookies: 'tab',
  clearCookie: 'tab', // legacy code, still present in old graphs
  httpRequest: 'tab',
  fileChooseEvent: 'tab',
  handleDialog: 'tab',
  goBack: 'tab',
  reload: 'tab',
  scroll: 'tab',
  // element
  waitForSelector: 'element',
  getAttribute: 'element',
  clickElement: 'element',
  doubleClickElement: 'element',
  hover: 'element',
  scrollIntoView: 'element',
  getText: 'element',
  getHtml: 'element',
  getInputValue: 'element',
  setValue: 'element',
  clearText: 'element',
  setInputFiles: 'element',
  selectOption: 'element',
  checkElementDisabled: 'element',
  checkElementVisible: 'element',
  elementExists: 'element',
  imageSearch: 'element',
  // keyboard
  pressKey: 'keyboard',
  typeText: 'keyboard',
  // mouse
  mouseClick: 'mouse',
  mouseDoubleClick: 'mouse',
  mouseMove: 'mouse',
  mouseDown: 'mouse',
  mouseUp: 'mouse',
  // data
  setVariables: 'data',
  random: 'data',
  getClipboard: 'data',
  setClipboard: 'data',
  convertJson: 'data',
  getCode2Fa: 'data',
  extractionInText: 'data',
  readFile: 'data',
  readSpreadsheet: 'data',
  writeFile: 'data',
  writeSpreadsheet: 'data',
  createFolder: 'data',
  copyFileFolder: 'data',
  deleteFileFolder: 'data',
  sendMailSftp: 'data',
  sendHotmailOauth: 'data',
  sendOutlookOauth: 'data',
  downloadFile: 'data',
  readMailSftp: 'data',
  readHotmailAuth: 'data',
  readOutlookAuth: 'data',
  runCommand: 'data',
  runOtherScript: 'data',
  // debug
  addLog: 'debug',
  addComment: 'debug',
  // ai
  aiLlm: 'ai',
};

const CONTROL_FLOW_CODES = new Set(['if', 'ifElse', 'loop']);
const EMAIL_CODES = new Set([
  'sendMailSftp',
  'readMailSftp',
  'sendHotmailOauth',
  'readHotmailAuth',
  'sendOutlookOauth',
  'readOutlookAuth',
]);
const FILESYSTEM_CODES = new Set([
  'readFile',
  'writeFile',
  'createFolder',
  'copyFileFolder',
  'deleteFileFolder',
  'downloadFile',
  'setInputFiles',
  'screenshot',
]);
const SPREADSHEET_CODES = new Set(['readSpreadsheet', 'writeSpreadsheet']);
const SHELL_CODE = 'runCommand';
const SUB_SCRIPT_CODE = 'runOtherScript';
const OPEN_CONNECT_CODE = 'openConnect';
const AI_CODE = 'aiLlm';

const AI_PROVIDERS = new Set(['openai', 'claude', 'gemini', 'ollama', 'qwen']);

/** Variables the app always injects; buyers never fill these in. */
const BUILTIN_VARIABLE_KEYS = new Set([
  'profile_uuid',
  'profile_path',
  'remote_port',
  'remote_ws',
  'browser_uuid',
]);

// --- Credential detection (mirrors app `CREDENTIAL_KEY_PATTERNS`) -------------------

const CREDENTIAL_KEY_PATTERNS = [
  /password$/i,
  /passphrase$/i,
  /apikey$/i,
  /secret$/i,
  /token$/i,
  /privatekey$/i,
  /credential$/i,
  /pass$/i,
  /pwd$/i,
  /_key$/i,
  /^key$/i,
];

const ONLY_VARIABLE_TOKEN = /^\s*\{\{[^{}]+\}\}\s*$/;

function isCredentialKey(key: string): boolean {
  return CREDENTIAL_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/** A real secret: a non-empty string that isn't just a `{{var}}` reference. */
function isSecretValue(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    value.trim() !== '' &&
    !ONLY_VARIABLE_TOKEN.test(value)
  );
}

// --- Derived structures -------------------------------------------------------------

/** What the script needs to run — derived from the graph, used for browse filters. */
export interface Capabilities {
  requires_browser: boolean;
  browser_platforms: string[];
  requires_proxy: boolean;
  uses_fingerprint: boolean;
  uses_ai_llm: boolean;
  ai_providers: string[];
  uses_email: boolean;
  uses_google_sheets: boolean;
  uses_filesystem: boolean;
  uses_2fa: boolean;
  uses_shell: boolean;
}

/** A non-builtin variable the buyer has to fill in before running. */
export interface RequiredVariable {
  key: string;
  label: string | null;
  example: string | null;
}

/** Security scan result. `credential_paths` holds locations only — never values. */
export interface GraphScan {
  embedded_credentials_count: number;
  credential_paths: string[];
  uses_shell: boolean;
}

/** Everything the store derives from a graph (never trusted from the seller). */
export interface GraphMetadata {
  node_count: number;
  node_groups_used: string[];
  uses_control_flow: boolean;
  sub_workflow_ids: string[];
  capabilities: Capabilities;
  required_variables: RequiredVariable[];
}

/** A graph with every embedded secret blanked out, plus what was removed. */
export interface ScrubResult {
  graph: Json;
  scan: GraphScan;
}

/**
 * Read a persisted `scan` JSON column back into a `GraphScan`.
 *
 * Old or hand-edited rows may hold anything, so every field is re-validated: a row that
 * cannot be read counts as "not scanned", never as "clean".
 */
export function readScan(value: unknown): GraphScan {
  const raw = (value ?? {}) as Json;
  const paths = Array.isArray(raw.credential_paths)
    ? raw.credential_paths.filter((p): p is string => typeof p === 'string')
    : [];
  const count = raw.embedded_credentials_count;
  return {
    embedded_credentials_count:
      typeof count === 'number' && Number.isFinite(count)
        ? count
        : paths.length,
    credential_paths: paths,
    uses_shell: raw.uses_shell === true,
  };
}

export function emptyCapabilities(): Capabilities {
  return {
    requires_browser: false,
    browser_platforms: [],
    requires_proxy: false,
    uses_fingerprint: false,
    uses_ai_llm: false,
    ai_providers: [],
    uses_email: false,
    uses_google_sheets: false,
    uses_filesystem: false,
    uses_2fa: false,
    uses_shell: false,
  };
}

// --- Scrubbing ----------------------------------------------------------------------

function scrubValue(value: unknown, path: string, found: string[]): unknown {
  if (Array.isArray(value)) {
    return value.map((item, i) => scrubValue(item, `${path}[${i}]`, found));
  }
  if (value === null || typeof value !== 'object') {
    return value;
  }

  const cleaned: Json = {};
  for (const [key, child] of Object.entries(value as Json)) {
    const childPath = path ? `${path}.${key}` : key;
    if (isCredentialKey(key) && isSecretValue(child)) {
      found.push(childPath);
      cleaned[key] = '';
      continue;
    }
    cleaned[key] = scrubValue(child, childPath, found);
  }
  return cleaned;
}

/**
 * Blank every embedded secret in the graph and report where they were.
 *
 * Scans node config *and* `variables[]` — a node holding `{{smtp_pass}}` still leaks
 * the secret through the variable's value, so both places have to be cleared.
 * The returned graph is what the store persists; the original is never stored.
 */
export function scrubCredentials(graph: Json): ScrubResult {
  const found: string[] = [];
  const scrubbed: Json = structuredClone(graph);

  if (Array.isArray(scrubbed.nodes)) {
    scrubbed.nodes = scrubValue(scrubbed.nodes, 'nodes', found);
  }

  if (Array.isArray(scrubbed.variables)) {
    for (const variable of scrubbed.variables as unknown[]) {
      if (variable === null || typeof variable !== 'object') continue;
      const record = variable as Json;
      const key = record.key;
      if (
        typeof key === 'string' &&
        isCredentialKey(key) &&
        isSecretValue(record.value)
      ) {
        found.push(`variables.${key}`);
        record.value = '';
      }
    }
  }

  const uniquePaths = [...new Set(found)].sort();
  return {
    graph: scrubbed,
    scan: {
      embedded_credentials_count: uniquePaths.length,
      credential_paths: uniquePaths,
      uses_shell: usesShell(graph),
    },
  };
}

// --- Metadata derivation ------------------------------------------------------------

function iterNodeData(graph: Json): Json[] {
  const nodes = graph.nodes;
  if (!Array.isArray(nodes)) return [];
  const out: Json[] = [];
  for (const node of nodes as unknown[]) {
    if (node === null || typeof node !== 'object') continue;
    const data = (node as Json).data;
    out.push(data !== null && typeof data === 'object' ? (data as Json) : {});
  }
  return out;
}

function nodeCode(data: Json): string {
  return typeof data.code === 'string' ? data.code : '';
}

function usesShell(graph: Json): boolean {
  return iterNodeData(graph).some((data) => nodeCode(data) === SHELL_CODE);
}

/** Which browser stack an `openConnect` node drives (see app `resolveOpenConnectMode`). */
function openConnectPlatform(data: Json): string {
  const platform = data.openConnectPlatform;
  let mode = data.openConnectMode;
  if (typeof mode !== 'string' || !mode) {
    mode =
      typeof platform === 'string' && platform ? 'otherApp' : 'defaultProfile';
  }
  if (mode === 'otherApp') {
    return typeof platform === 'string' && platform ? platform : 'hidemium';
  }
  if (mode === 'remoteCdp') return 'remote';
  return 'builtin';
}

function hasFingerprintConfig(data: Json): boolean {
  if (data.openConnectMode === 'newProfile') return true;
  return Object.entries(data).some(
    ([key, value]) =>
      key.startsWith('openConnectFingerprint') &&
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== false &&
      !(Array.isArray(value) && value.length === 0),
  );
}

/** Scan the graph for everything the listing advertises. Seller input is ignored. */
export function deriveMetadata(graph: Json): GraphMetadata {
  const nodeData = iterNodeData(graph);
  const caps = emptyCapabilities();
  const groups = new Set<string>();
  const providers = new Set<string>();
  const platforms = new Set<string>();
  const subWorkflowIds: string[] = [];
  let usesControlFlow = false;

  for (const data of nodeData) {
    const code = nodeCode(data);
    const group = NODE_GROUPS[code];
    if (group !== undefined) groups.add(group);
    if (CONTROL_FLOW_CODES.has(code)) usesControlFlow = true;

    if (code === OPEN_CONNECT_CODE) {
      caps.requires_browser = true;
      platforms.add(openConnectPlatform(data));
      if (data.openConnectProxyEnabled) caps.requires_proxy = true;
      if (hasFingerprintConfig(data)) caps.uses_fingerprint = true;
    } else if (code === AI_CODE) {
      caps.uses_ai_llm = true;
      const provider = data.aiLlmProvider;
      if (typeof provider === 'string' && AI_PROVIDERS.has(provider)) {
        providers.add(provider);
      }
    } else if (EMAIL_CODES.has(code)) {
      caps.uses_email = true;
    } else if (SPREADSHEET_CODES.has(code)) {
      if (data[`${code}Source`] === 'googleSheet') {
        caps.uses_google_sheets = true;
      } else {
        caps.uses_filesystem = true;
      }
    } else if (code === 'getCode2Fa') {
      caps.uses_2fa = true;
    } else if (code === SHELL_CODE) {
      caps.uses_shell = true;
    } else if (code === SUB_SCRIPT_CODE) {
      const workflowId = data.runOtherScriptWorkflowId;
      if (
        typeof workflowId === 'string' &&
        workflowId &&
        !subWorkflowIds.includes(workflowId)
      ) {
        subWorkflowIds.push(workflowId);
      }
    }

    if (FILESYSTEM_CODES.has(code)) caps.uses_filesystem = true;
  }

  caps.browser_platforms = [...platforms].sort();
  caps.ai_providers = [...providers].sort();

  return {
    node_count: nodeData.length,
    node_groups_used: [...groups].sort(),
    uses_control_flow: usesControlFlow,
    sub_workflow_ids: subWorkflowIds,
    capabilities: caps,
    required_variables: requiredVariables(graph),
  };
}

/**
 * Declared variables minus the app's builtins — what the buyer must fill in.
 *
 * Values are deliberately not copied into `example`: they are the seller's own data
 * (accounts, sheet ids) and have no business on a public listing.
 */
function requiredVariables(graph: Json): RequiredVariable[] {
  const variables = graph.variables;
  if (!Array.isArray(variables)) return [];
  const out: RequiredVariable[] = [];
  const seen = new Set<string>();
  for (const variable of variables as unknown[]) {
    if (variable === null || typeof variable !== 'object') continue;
    const key = (variable as Json).key;
    if (
      typeof key !== 'string' ||
      !key ||
      BUILTIN_VARIABLE_KEYS.has(key) ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    out.push({ key, label: key, example: null });
  }
  return out;
}
