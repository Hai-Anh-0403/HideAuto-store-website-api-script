/** DTOs returned by the NestJS API (`/api/v1`). Field names match Prisma's camelCase output. */

export type SellerStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'
export type ScriptStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'REJECTED' | 'ARCHIVED'
export type VersionStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED'
export type BuildStatus = 'BUILDING' | 'READY' | 'FAILED'
export type KeyStatus = 'ACTIVE' | 'REVOKED'
/** What the key can actually do now — expiry and exhaustion are derived, not stored. */
export type KeyState = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'EXHAUSTED'
export type MemberStatus = 'ACTIVE' | 'BLOCKED'

export interface Page<T> {
  items: T[]
  total: number
  skip: number
  limit: number
}

/** Public, anonymous store responses. They intentionally exclude seller identity and artifact data. */
export interface PublicTag {
  id: string
  name: string
  slug: string
}

export interface PublicScriptStatistics {
  ratingAvg: number
  ratingCount: number
  downloads: number
  views: number
}

export interface PublicScriptSummary {
  id: string
  slug: string
  name: string
  shortDescription: string
  thumbnailUrl: string | null
  price: string
  priceAmount?: number
  currency?: string
  seller: { displayName: string }
  tags: PublicTag[]
  latestApprovedVersion: string
  statistics: PublicScriptStatistics
  publishedAt: string
  updatedAt: string
}

export interface PublicScriptVersion {
  id: string
  version: string
  changelog: string | null
  releasedAt: string | null
  createdAt: string
}

export interface PublicScriptDetail extends PublicScriptSummary {
  descriptionHtml: string | null
  galleryUrls: string[]
  capabilities: string[]
  versions: PublicScriptVersion[]
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
  /** Why the admin rejected or suspended the account. Null while nothing is wrong. */
  statusReason: string | null
  createdAt: string
  updatedAt: string
}

export interface SellerSession {
  id: string
  device: string | null
  userAgent: string | null
  ip: string | null
  /** True for the session this browser is holding — it cannot sign itself out by mistake. */
  current: boolean
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
  videoUrl: string | null
  thumbnailUrl: string | null
  images: string[]
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
  /** From the HAUP2 inner header (or the package envelope). */
  name: string | null
  version: string | null
  appId: string | null
  appName: string | null
  hasIcon: boolean
  iconDataUrl: string | null
}

/* ---------- Admin console ---------- */

export interface AdminSeller {
  id: string
  email: string
  name: string
  contact: string | null
  status: SellerStatus
  statusReason: string | null
  createdAt: string
  updatedAt: string
  _count: { scripts: number; members: number; keys: number }
}

/** The version waiting for review, with everything the decision depends on. */
export interface PendingVersion {
  id: string
  version: string
  changelog: string | null
  nodeCount: number
  nodeGroupsUsed: string[]
  capabilities: Capabilities
  scan: GraphScan
  graphExtracted: boolean
  delivery: string
  sourceFilename: string | null
  minAppVersion: string | null
  createdAt: string
}

export interface PendingScript extends Script {
  seller: { id: string; name: string; email: string; status: SellerStatus }
  versions: PendingVersion[]
}

export interface KeyItem {
  id: string
  sellerId: string
  /** null = shop-wide key: it unlocks every app from this seller. */
  scriptId: string | null
  key: string
  label: string | null
  status: KeyStatus
  /** Derived by the API: ACTIVE only when it is still redeemable right now. */
  state: KeyState
  maxUses: number | null
  usedCount: number
  expiresAt: string | null
  createdAt: string
  script: { id: string; name: string; slug: string } | null
}

export interface KeyCreate {
  /** Omit for a shop-wide key that unlocks every app from this seller. */
  scriptId?: string | null
  label?: string
  maxUses?: number
  expiresAt?: string
  quantity?: number
}

export interface KeyUpdate {
  /** null clears the field: no label / unlimited uses / never expires. */
  label?: string | null
  maxUses?: number | null
  expiresAt?: string | null
}

export interface KeyStats {
  total: number
  active: number
  revoked: number
  expired: number
  exhausted: number
  /** Total redemptions across every key, including revoked ones. */
  redemptions: number
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
  /** Keys this buyer redeemed, newest first — how they got in. */
  keys: MemberKeyRef[]
}

export interface MemberKeyRef {
  id: string
  key: string
  label: string | null
  redeemedAt: string
}

/** One machine a buyer has activated a packaged mini app on. */
export interface MemberDevice {
  id: string
  machineId: string
  scriptId: string | null
  activationCount: number
  firstSeenAt: string
  lastSeenAt: string
  blocked: boolean
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
  /** `upload` = exe unwrapped from `.haup`; `server`/`agent` = template repackage. */
  builtBy: 'server' | 'agent' | 'upload'
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
