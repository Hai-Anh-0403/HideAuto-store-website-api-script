import {
  scrubCredentials,
  deriveMetadata,
  readScan,
} from '../src/common/graph/workflow-graph';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n         expected ${e}\n         actual   ${a}`);
  }
}

const graph = {
  nodes: [
    {
      id: 'n1',
      data: {
        code: 'openConnect',
        openConnectMode: 'otherApp',
        openConnectPlatform: 'hidemium',
        openConnectProxyEnabled: true,
      },
    },
    { id: 'n2', data: { code: 'gotoUrl', url: 'https://example.com' } },
    {
      id: 'n3',
      data: {
        code: 'sendMailSftp',
        smtpPassword: 'hunter2-real-secret',
        smtpUser: 'bot@example.com',
      },
    },
    { id: 'n4', data: { code: 'runCommand', command: 'whoami' } },
    { id: 'n5', data: { code: 'aiLlm', aiLlmProvider: 'openai', apiKey: 'sk-live-abc' } },
    { id: 'n6', data: { code: 'getCode2Fa' } },
    { id: 'n7', data: { code: 'loop' } },
    { id: 'n8', data: { code: 'runOtherScript', runOtherScriptWorkflowId: 'wf-42' } },
    { id: 'n9', data: { code: 'readSpreadsheet', readSpreadsheetSource: 'googleSheet' } },
    // A {{var}} reference is NOT a secret â€” must survive scrubbing.
    { id: 'n10', data: { code: 'typeText', password: '{{my_password}}' } },
  ],
  variables: [
    { key: 'profile_uuid', value: 'builtin-should-be-ignored' },
    { key: 'target_url', value: 'https://example.com' },
    { key: 'smtp_pass', value: 'another-real-secret' },
  ],
};

console.log('\n--- scrubCredentials ---');
const { graph: clean, scan } = scrubCredentials(graph);

check('credential count', scan.embedded_credentials_count, 3);
check('credential paths', scan.credential_paths, [
  'nodes[2].data.smtpPassword',
  'nodes[4].data.apiKey',
  'variables.smtp_pass',
]);
check('uses_shell detected', scan.uses_shell, true);

const cleanNodes = clean.nodes as any[];
check('smtpPassword blanked', cleanNodes[2].data.smtpPassword, '');
check('apiKey blanked', cleanNodes[4].data.apiKey, '');
check('non-secret field kept', cleanNodes[2].data.smtpUser, 'bot@example.com');
check('{{var}} reference kept', cleanNodes[9].data.password, '{{my_password}}');
check(
  'variable secret blanked',
  (clean.variables as any[])[2].value,
  '',
);
check(
  'original graph untouched',
  (graph.nodes[2].data as any).smtpPassword,
  'hunter2-real-secret',
);

console.log('\n--- deriveMetadata ---');
const meta = deriveMetadata(clean);
check('node_count', meta.node_count, 10);
check('node_groups_used', meta.node_groups_used, [
  'ai',
  'browser',
  'data',
  'keyboard',
  'tab',
]);
check('uses_control_flow', meta.uses_control_flow, true);
check('sub_workflow_ids', meta.sub_workflow_ids, ['wf-42']);
check('requires_browser', meta.capabilities.requires_browser, true);
check('browser_platforms', meta.capabilities.browser_platforms, ['hidemium']);
check('requires_proxy', meta.capabilities.requires_proxy, true);
check('uses_ai_llm', meta.capabilities.uses_ai_llm, true);
check('ai_providers', meta.capabilities.ai_providers, ['openai']);
check('uses_email', meta.capabilities.uses_email, true);
check('uses_2fa', meta.capabilities.uses_2fa, true);
check('uses_shell', meta.capabilities.uses_shell, true);
check('uses_google_sheets', meta.capabilities.uses_google_sheets, true);
check('required_variables (builtins dropped)', meta.required_variables, [
  { key: 'target_url', label: 'target_url', example: null },
  { key: 'smtp_pass', label: 'smtp_pass', example: null },
]);

console.log('\n--- readScan (defensive) ---');
check('null â†’ not scanned', readScan(null).embedded_credentials_count, 0);
check('garbage â†’ not clean-by-default', readScan({ credential_paths: ['a', 'b'] })
  .embedded_credentials_count, 2);
check('round-trips', readScan(JSON.parse(JSON.stringify(scan))), scan);

console.log(
  failures === 0 ? '\nALL PASSED\n' : `\n${failures} FAILURE(S)\n`,
);
process.exitCode = failures === 0 ? 0 : 1;


