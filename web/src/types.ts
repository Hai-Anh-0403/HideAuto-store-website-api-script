/** DTOs returned by the NestJS API (`/api/v1`). Field names match Prisma's camelCase output. */

export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type ScriptStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED'
export type VersionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
export type BuildStatus = 'BUILDING' | 'READY' | 'FAILED'
export type KeyStatus = 'ACTIVE' | 'REVOKED'
export type MemberStatus = 'ACTIVE' | 'BLOCKED'

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
  createdAt: string
  updatedAt: string
}

export interface SellerSession {
  id: string
  device: string | null
  userAgent: string | null
  ip: string | null
  current?: boolean
  createdAt: string
  lastSeenAt: string
  expiresAt: string
}

export interface Capabilities {
  requires_browser?: boolean
  browser_platforms?: string[]
  requires_proxy?: boolean
  uses_fingerprint?: boolean
  uses_ai_llm?: boolean
  ai_providers?: string[]
  uses_email?: boolean
  uses_google_sheets?: boolean
  uses_filesystem?: boolean
  uses_2fa?: boolean
  uses_shell?: boolean
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

export interface Tag {
  id: string
  name: string
  slug: string
  description: string | null
  color: string | null
  createdAt: string
}

export interface Script {
  id: string
  slug: string
  name: string
  shortDescription: string | null
  description: string | null
  sellerId: string
  sellerName: string
  engine: string
  status: ScriptStatus
  rejectReason: string | null
  hasMiniApp: boolean
  latestVersion: string | null
  latestVersionId: string | null
  minAppVersion: string | null
  nodeCount: number
  nodeGroupsUsed: string[]
  capabilities: Capabilities
  ratingAvg: number
  ratingCount: number
  downloads: number
  views: number
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  tags: Array<{ id: string; name: string; slug: string; color: string | null }>
  _count?: { versions: number; keys: number }
}

export interface ScriptVersion {
  id: string
  scriptId: string
  version: string
  changelog: string | null
  sourceFilename: string | null
  delivery: string
  formatVersion: number
  minAppVersion: string | null
  testedAppVersion: string | null
  graphExtracted: boolean
  nodeCount: number
  nodeGroupsUsed: string[]
  usesControlFlow: boolean
  subWorkflowIds: string[]
  capabilities: Capabilities
  requiredVars: RequiredVariable[]
  scan: GraphScan
  appId: string | null
  appName: string | null
  status: VersionStatus
  reviewNote: string | null
  reviewedAt: string | null
  scannedAt: string | null
  releasedAt: string | null
  createdAt: string
}

export interface ScriptDetail extends Script {
  versions: ScriptVersion[]
}

/** Dry-run scan of an upload (`POST /scripts/:id/inspect`) — nothing is persisted. */
export interface ScriptInspect {
  filename: string
  size: number
  graphExtracted: boolean
  nodeCount: number
  nodeGroupsUsed: string[]
  usesControlFlow: boolean
  capabilities: Capabilities
  requiredVars: RequiredVariable[]
  embeddedCredentialsCount: number
  /** Locations of embedded secrets — paths only, never values. */
  credentialPaths: string[]
  usesShell: boolean
}

export interface KeyItem {
  id: string
  sellerId: string
  scriptId: string
  key: string
  label: string | null
  status: KeyStatus
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  createdAt: string
  script: { id: string; name: string; slug: string }
}

export interface KeyCreate {
  label?: string | null
  maxUses?: number | null
  expiresAt?: string | null
}

export interface Member {
  id: string
  userId: string
  userEmail: string | null
  userName: string | null
  status: MemberStatus
  scriptIds: string[]
  allScripts: boolean
  lastSeenAt: string | null
  blockedDevices: string[]
  redeemedAt: string
}

export interface MiniAppBuild {
  id: string
  scriptId: string
  scriptVersionId: string
  appId: string
  appName: string
  appVersion: string
  platform: 'win' | 'mac' | 'linux'
  arch: 'x64' | 'arm64'
  installerFormat: string
  sizeBytes: number
  checksum: string | null
  fileUrl: string | null
  status: BuildStatus
  builtBy: 'server' | 'agent'
  error: string | null
  builtAt: string | null
  createdAt: string
}

export interface SellerStats {
  memberCount: number
  onlineCount: number
  activeKeyCount: number
  scriptCount: number
}
