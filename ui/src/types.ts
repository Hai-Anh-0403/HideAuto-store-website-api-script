export type ScriptStatus = 'draft' | 'pending_review' | 'published' | 'rejected' | 'archived'
export type VersionStatus = 'approved' | 'pending' | 'rejected'
export type BuildStatus = 'ready' | 'building' | 'failed'
export type KeyStatus = 'active' | 'revoked'
export type MemberStatus = 'active' | 'blocked'

export interface Capabilities {
  browser: string[]
  proxy: boolean
  fingerprint: boolean
  ai: string[]
  email: boolean
  sheets: boolean
  twofa: boolean
  shell: boolean
}

export interface ScriptVar {
  k: string
}

export interface Version {
  v: string
  status: VersionStatus
  published: boolean
  minApp: string
  log: string
  at: string
  desc?: string
}

export interface Build {
  plat: string
  arch: string
  v: string
  status: BuildStatus
}

export interface KeyItem {
  k: string
  label: string
  status: KeyStatus
  used: number
  max: number | null
}

export interface Scan {
  creds: number
  shell: boolean
  paths?: string[]
}

export interface Script {
  id: string
  name: string
  cat: string
  tags: string[]
  status: ScriptStatus
  latest: string
  downloads: number
  rating: number
  minApp: string
  nodeCount: number
  groups: string[]
  caps: Capabilities
  vars: ScriptVar[]
  scan: Scan
  reject?: string | null
  hasMini: boolean
  versions: Version[]
  builds: Build[]
  keys: KeyItem[]
}

export interface MemberApp {
  id: string
  key: string
}

export interface Member {
  name: string
  email: string
  uid: string
  status: MemberStatus
  online: boolean
  last: string
  apps: MemberApp[]
}
