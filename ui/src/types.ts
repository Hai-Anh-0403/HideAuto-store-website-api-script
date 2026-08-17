/** DTOs returned by the API (`/api/v1`). Names mirror the Pydantic `*Read` schemas. */

export type SellerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type ScriptStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
export type VersionStatus = 'pending_review' | 'approved' | 'rejected'
export type BuildStatus = 'building' | 'ready' | 'failed'
export type KeyStatus = 'active' | 'revoked'
export type MemberStatus = 'active' | 'blocked'

export interface Page<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

export interface Token {
  access_token: string
  token_type: string
  role: string
}

export interface Seller {
  id: string
  email: string
  name: string
  contact: string | null
  status: SellerStatus
  created_at: string
}

/** Một lần đăng nhập còn sống — mỗi thiết bị một dòng. */
export interface SellerSession {
  id: string
  device: string | null
  user_agent: string | null
  ip: string | null
  /** Chính thiết bị đang xem danh sách này. */
  current: boolean
  created_at: string
  last_seen_at: string
  expires_at: string
}

export interface Capabilities {
  requires_browser: boolean
  browser_platforms: string[]
  requires_proxy: boolean
  uses_fingerprint: boolean
  uses_ai_llm: boolean
  ai_providers: string[]
  uses_email: boolean
  uses_google_sheets: boolean
  uses_filesystem: boolean
  uses_2fa: boolean
  uses_shell: boolean
}

export interface RequiredVariable {
  key: string
  label: string | null
  example: string | null
}

export interface GraphScan {
  embedded_credentials_count: number
  credential_paths: string[]
  uses_shell: boolean
}

export interface ScriptStats {
  rating_avg: number
  rating_count: number
  downloads: number
  views: number
}

export interface Script {
  id: string
  slug: string
  name: string
  short_description: string | null
  description: string | null
  seller: { id: string; name: string }
  engine: string
  status: ScriptStatus
  reject_reason: string | null
  has_mini_app: boolean
  latest_version: string | null
  latest_version_id: string | null
  min_app_version: string | null
  node_count: number
  node_groups_used: string[]
  capabilities: Capabilities
  stats: ScriptStats
  created_at: string
  updated_at: string
  published_at: string | null
}

export interface ScriptVersion {
  id: string
  script_id: string
  version: string
  changelog: string | null
  source_filename: string | null
  delivery: 'hideflow_encrypted' | 'graph_json' | 'mini_app_exe'
  format_version: number
  min_app_version: string | null
  tested_app_version: string | null
  /** false = gói .exe đóng kín, store chưa đọc được graph nên mọi số dưới đây là rỗng. */
  graph_extracted: boolean
  node_count: number
  node_groups_used: string[]
  uses_control_flow: boolean
  sub_workflow_ids: string[]
  capabilities: Capabilities
  required_variables: RequiredVariable[]
  scan: GraphScan
  app_id: string | null
  app_name: string | null
  status: VersionStatus
  moderation: { reviewed_at: string | null; reason: string | null; scanned_at: string | null }
  released_at: string | null
  created_at: string
}

export interface ScriptDetail extends Script {
  versions: ScriptVersion[]
}

/** Kết quả xem trước một gói vừa chọn — chưa lưu gì cả. */
export interface ScriptInspect {
  suggested_name: string
  app_name: string | null
  app_id: string | null
  workflow_name: string | null
  delivery: ScriptVersion['delivery']
  graph_extracted: boolean
  node_count: number
  node_groups_used: string[]
  uses_control_flow: boolean
  sub_workflow_ids: string[]
  capabilities: Capabilities
  required_variables: RequiredVariable[]
  scan: GraphScan
}

export interface KeyItem {
  id: string
  script_id: string | null
  script_name: string | null
  key: string
  label: string | null
  status: KeyStatus
  max_uses: number | null
  used_count: number
  expires_at: string | null
  created_at: string
}

/** Tuỳ chọn khi phát hành khóa — bỏ trống là không giới hạn / không hết hạn. */
export interface KeyCreate {
  label: string | null
  max_uses: number | null
  expires_at: string | null
}

export interface Member {
  id: string
  user_id: string
  user_email: string | null
  user_name: string | null
  status: MemberStatus
  script_ids: string[]
  all_scripts: boolean
  last_seen_at: string | null
  blocked_devices: string[]
  redeemed_at: string
}

export interface MemberDevice {
  machine_id: string
  name: string | null
  os: string | null
  last_seen_at: string | null
  blocked: boolean
}

export interface MemberUsage {
  user_id: string
  online: boolean
  last_seen_at: string | null
  usage_synced_at: string | null
  devices: MemberDevice[]
}

export interface MiniAppBuild {
  id: string
  script_id: string
  script_version_id: string
  app_id: string
  app_name: string
  app_version: string
  platform: 'win' | 'mac' | 'linux'
  arch: 'x64' | 'arm64'
  installer_format: 'exe' | 'dmg' | 'appimage' | 'zip'
  size_bytes: number
  checksum: string | null
  status: BuildStatus
  built_by: 'server' | 'agent'
  error: string | null
  built_at: string | null
  created_at: string
}
