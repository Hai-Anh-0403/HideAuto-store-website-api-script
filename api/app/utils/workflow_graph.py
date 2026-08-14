"""Workflow graph inspection: credential scrubbing + metadata derivation.

Uploads are untrusted, so nothing here trusts seller-supplied metadata: every value is
read out of the graph itself. Node codes / groups mirror the hideflow app catalog
(`src/shared/workflow-nodes.data.ts`) and the credential patterns mirror the app's
`detectExportCredentials` so the store flags exactly what the app would flag.
"""

import re
from copy import deepcopy
from typing import Any

from pydantic import BaseModel, Field

# --- Node catalog (mirrors the app's NODE_META groups) ------------------------------

NODE_GROUPS: dict[str, str] = {
    # browser
    "openConnect": "browser",
    "browserClose": "browser",
    "disconnect": "browser",
    # tab
    "newTab": "tab",
    "openExtension": "tab",
    "switchExtensionPopup": "tab",
    "closeTab": "tab",
    "gotoUrl": "tab",
    "activeTabs": "tab",
    "switchFrame": "tab",
    "runJs": "tab",
    "screenshot": "tab",
    "getUrl": "tab",
    "getCookie": "tab",
    "setCookies": "tab",
    "clearCookies": "tab",
    "clearCookie": "tab",  # legacy code, still present in old graphs
    "httpRequest": "tab",
    "fileChooseEvent": "tab",
    "handleDialog": "tab",
    "goBack": "tab",
    "reload": "tab",
    "scroll": "tab",
    # element
    "waitForSelector": "element",
    "getAttribute": "element",
    "clickElement": "element",
    "doubleClickElement": "element",
    "hover": "element",
    "scrollIntoView": "element",
    "getText": "element",
    "getHtml": "element",
    "getInputValue": "element",
    "setValue": "element",
    "clearText": "element",
    "setInputFiles": "element",
    "selectOption": "element",
    "checkElementDisabled": "element",
    "checkElementVisible": "element",
    "elementExists": "element",
    "imageSearch": "element",
    # keyboard
    "pressKey": "keyboard",
    "typeText": "keyboard",
    # mouse
    "mouseClick": "mouse",
    "mouseDoubleClick": "mouse",
    "mouseMove": "mouse",
    "mouseDown": "mouse",
    "mouseUp": "mouse",
    # data
    "setVariables": "data",
    "random": "data",
    "getClipboard": "data",
    "setClipboard": "data",
    "convertJson": "data",
    "getCode2Fa": "data",
    "extractionInText": "data",
    "readFile": "data",
    "readSpreadsheet": "data",
    "writeFile": "data",
    "writeSpreadsheet": "data",
    "createFolder": "data",
    "copyFileFolder": "data",
    "deleteFileFolder": "data",
    "sendMailSftp": "data",
    "sendHotmailOauth": "data",
    "sendOutlookOauth": "data",
    "downloadFile": "data",
    "readMailSftp": "data",
    "readHotmailAuth": "data",
    "readOutlookAuth": "data",
    "runCommand": "data",
    "runOtherScript": "data",
    # debug
    "addLog": "debug",
    "addComment": "debug",
    # ai
    "aiLlm": "ai",
}

CONTROL_FLOW_CODES = frozenset({"if", "ifElse", "loop"})
EMAIL_CODES = frozenset(
    {
        "sendMailSftp",
        "readMailSftp",
        "sendHotmailOauth",
        "readHotmailAuth",
        "sendOutlookOauth",
        "readOutlookAuth",
    }
)
FILESYSTEM_CODES = frozenset(
    {
        "readFile",
        "writeFile",
        "createFolder",
        "copyFileFolder",
        "deleteFileFolder",
        "downloadFile",
        "setInputFiles",
        "screenshot",
    }
)
SPREADSHEET_CODES = frozenset({"readSpreadsheet", "writeSpreadsheet"})
SHELL_CODE = "runCommand"
SUB_SCRIPT_CODE = "runOtherScript"
OPEN_CONNECT_CODE = "openConnect"
AI_CODE = "aiLlm"

AI_PROVIDERS = frozenset({"openai", "claude", "gemini", "ollama", "qwen"})

# Variables the app always injects; buyers never fill these in.
BUILTIN_VARIABLE_KEYS = frozenset(
    {"profile_uuid", "profile_path", "remote_port", "remote_ws", "browser_uuid"}
)

# --- Credential detection (mirrors app `CREDENTIAL_KEY_PATTERNS`) -------------------

_CREDENTIAL_KEY_PATTERNS = [
    re.compile(p, re.IGNORECASE)
    for p in (
        r"password$",
        r"passphrase$",
        r"apikey$",
        r"secret$",
        r"token$",
        r"privatekey$",
        r"credential$",
        r"pass$",
        r"pwd$",
        r"_key$",
        r"^key$",
    )
]

_ONLY_VARIABLE_TOKEN = re.compile(r"^\s*\{\{[^{}]+\}\}\s*$")


def _is_credential_key(key: str) -> bool:
    return any(pattern.search(key) for pattern in _CREDENTIAL_KEY_PATTERNS)


def _is_secret_value(value: Any) -> bool:
    """A real secret: a non-empty string that isn't just a `{{var}}` reference."""
    return (
        isinstance(value, str) and value.strip() != "" and _ONLY_VARIABLE_TOKEN.match(value) is None
    )


# --- Derived structures -------------------------------------------------------------


class Capabilities(BaseModel):
    """What the script needs to run — derived from the graph, used for browse filters."""

    requires_browser: bool = False
    browser_platforms: list[str] = Field(default_factory=list)
    requires_proxy: bool = False
    uses_fingerprint: bool = False
    uses_ai_llm: bool = False
    ai_providers: list[str] = Field(default_factory=list)
    uses_email: bool = False
    uses_google_sheets: bool = False
    uses_filesystem: bool = False
    uses_2fa: bool = False
    uses_shell: bool = False


class RequiredVariable(BaseModel):
    """A non-builtin variable the buyer has to fill in before running."""

    key: str
    label: str | None = None
    example: str | None = None


class GraphScan(BaseModel):
    """Security scan result. `credential_paths` holds locations only — never values."""

    embedded_credentials_count: int = 0
    credential_paths: list[str] = Field(default_factory=list)
    uses_shell: bool = False


class GraphMetadata(BaseModel):
    """Everything the store derives from a graph (never trusted from the seller)."""

    node_count: int = 0
    node_groups_used: list[str] = Field(default_factory=list)
    uses_control_flow: bool = False
    sub_workflow_ids: list[str] = Field(default_factory=list)
    capabilities: Capabilities = Field(default_factory=Capabilities)
    required_variables: list[RequiredVariable] = Field(default_factory=list)


class ScrubResult(BaseModel):
    """A graph with every embedded secret blanked out, plus what was removed."""

    graph: dict[str, Any]
    scan: GraphScan


# --- Scrubbing ----------------------------------------------------------------------


def _scrub_value(value: Any, path: str, found: list[str]) -> Any:
    if isinstance(value, list):
        return [_scrub_value(item, f"{path}[{i}]", found) for i, item in enumerate(value)]
    if not isinstance(value, dict):
        return value

    cleaned: dict[str, Any] = {}
    for key, child in value.items():
        child_path = f"{path}.{key}" if path else key
        if _is_credential_key(str(key)) and _is_secret_value(child):
            found.append(child_path)
            cleaned[key] = ""
            continue
        cleaned[key] = _scrub_value(child, child_path, found)
    return cleaned


def scrub_credentials(graph: dict[str, Any]) -> ScrubResult:
    """Blank every embedded secret in the graph and report where they were.

    Scans node config *and* `variables[]` — a node holding `{{smtp_pass}}` still leaks
    the secret through the variable's value, so both places have to be cleared.
    The returned graph is what the store persists; the original is never stored.
    """
    found: list[str] = []
    scrubbed = deepcopy(graph)

    nodes = scrubbed.get("nodes")
    if isinstance(nodes, list):
        scrubbed["nodes"] = _scrub_value(nodes, "nodes", found)

    variables = scrubbed.get("variables")
    if isinstance(variables, list):
        for variable in variables:
            if not isinstance(variable, dict):
                continue
            key = variable.get("key")
            if (
                isinstance(key, str)
                and _is_credential_key(key)
                and _is_secret_value(variable.get("value"))
            ):
                found.append(f"variables.{key}")
                variable["value"] = ""

    unique_paths = sorted(set(found))
    return ScrubResult(
        graph=scrubbed,
        scan=GraphScan(
            embedded_credentials_count=len(unique_paths),
            credential_paths=unique_paths,
            uses_shell=_uses_shell(graph),
        ),
    )


# --- Metadata derivation ------------------------------------------------------------


def _iter_node_data(graph: dict[str, Any]) -> list[dict[str, Any]]:
    nodes = graph.get("nodes")
    if not isinstance(nodes, list):
        return []
    out: list[dict[str, Any]] = []
    for node in nodes:
        if not isinstance(node, dict):
            continue
        data = node.get("data")
        out.append(data if isinstance(data, dict) else {})
    return out


def _node_code(data: dict[str, Any]) -> str:
    code = data.get("code")
    return code if isinstance(code, str) else ""


def _uses_shell(graph: dict[str, Any]) -> bool:
    return any(_node_code(data) == SHELL_CODE for data in _iter_node_data(graph))


def _open_connect_platform(data: dict[str, Any]) -> str:
    """Which browser stack an `openConnect` node drives (see app `resolveOpenConnectMode`)."""
    mode = data.get("openConnectMode")
    platform = data.get("openConnectPlatform")
    if not isinstance(mode, str) or not mode:
        mode = "otherApp" if isinstance(platform, str) and platform else "defaultProfile"
    if mode == "otherApp":
        return platform if isinstance(platform, str) and platform else "hidemium"
    if mode == "remoteCdp":
        return "remote"
    return "builtin"


def _has_fingerprint_config(data: dict[str, Any]) -> bool:
    if data.get("openConnectMode") == "newProfile":
        return True
    return any(
        key.startswith("openConnectFingerprint") and value not in (None, "", [], False)
        for key, value in data.items()
    )


def derive_metadata(graph: dict[str, Any]) -> GraphMetadata:
    """Scan the graph for everything the listing advertises. Seller input is ignored."""
    node_data = _iter_node_data(graph)
    caps = Capabilities()
    groups: set[str] = set()
    providers: set[str] = set()
    platforms: set[str] = set()
    sub_workflow_ids: list[str] = []
    uses_control_flow = False

    for data in node_data:
        code = _node_code(data)
        group = NODE_GROUPS.get(code)
        if group is not None:
            groups.add(group)
        if code in CONTROL_FLOW_CODES:
            uses_control_flow = True

        if code == OPEN_CONNECT_CODE:
            caps.requires_browser = True
            platforms.add(_open_connect_platform(data))
            if data.get("openConnectProxyEnabled"):
                caps.requires_proxy = True
            if _has_fingerprint_config(data):
                caps.uses_fingerprint = True
        elif code == AI_CODE:
            caps.uses_ai_llm = True
            provider = data.get("aiLlmProvider")
            if isinstance(provider, str) and provider in AI_PROVIDERS:
                providers.add(provider)
        elif code in EMAIL_CODES:
            caps.uses_email = True
        elif code in SPREADSHEET_CODES:
            source = data.get(f"{code}Source")
            if source == "googleSheet":
                caps.uses_google_sheets = True
            else:
                caps.uses_filesystem = True
        elif code == "getCode2Fa":
            caps.uses_2fa = True
        elif code == SHELL_CODE:
            caps.uses_shell = True
        elif code == SUB_SCRIPT_CODE:
            workflow_id = data.get("runOtherScriptWorkflowId")
            if isinstance(workflow_id, str) and workflow_id and workflow_id not in sub_workflow_ids:
                sub_workflow_ids.append(workflow_id)

        if code in FILESYSTEM_CODES:
            caps.uses_filesystem = True

    caps.browser_platforms = sorted(platforms)
    caps.ai_providers = sorted(providers)

    return GraphMetadata(
        node_count=len(node_data),
        node_groups_used=sorted(groups),
        uses_control_flow=uses_control_flow,
        sub_workflow_ids=sub_workflow_ids,
        capabilities=caps,
        required_variables=_required_variables(graph),
    )


def _required_variables(graph: dict[str, Any]) -> list[RequiredVariable]:
    """Declared variables minus the app's builtins — what the buyer must fill in.

    Values are deliberately not copied into `example`: they are the seller's own data
    (accounts, sheet ids) and have no business on a public listing.
    """
    variables = graph.get("variables")
    if not isinstance(variables, list):
        return []
    out: list[RequiredVariable] = []
    seen: set[str] = set()
    for variable in variables:
        if not isinstance(variable, dict):
            continue
        key = variable.get("key")
        if not isinstance(key, str) or not key or key in BUILTIN_VARIABLE_KEYS or key in seen:
            continue
        seen.add(key)
        out.append(RequiredVariable(key=key, label=key))
    return out
