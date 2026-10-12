export type LicenseStatus =
  | 'unlicensed'
  | 'active'
  | 'grace-period'
  | 'degraded'
  | 'expired'
  | 'invalid'
  | 'revoked'

export type DegradedMode =
  | 'none'
  | 'readonly'
  | 'limited'
  | 'blocked'

export type LicenseReasonCode =
  | 'none'
  | 'server_unavailable'
  | 'invalid_license'
  | 'expired'
  | 'revoked'
  | 'device_limit_exceeded'
  | 'device_mismatch'
  | 'clone_suspected'
  | 'reauthorization_required'

export interface LicenseReauthorizationSummary {
  available: boolean
  required: boolean
  activated: boolean
  hasStoredActivation: boolean
  machineMismatch: boolean
  installationMismatch: boolean
  reasonCode: Extract<
    LicenseReasonCode,
    'none' | 'device_mismatch' | 'clone_suspected' | 'reauthorization_required'
  >
}

export interface LicenseEntitlement {
  key: string
  name: string
  enabled: boolean
  limit?: number | null
}

export interface LicenseEntitlements {
  items: LicenseEntitlement[]
}

export interface LicenseEntitlementsRequest {
  key: string
}

export interface LicenseEntitlementsResult {
  status: LicenseStatus
  entitlements: LicenseEntitlements
  degradedMode: DegradedModeStatus
}

export interface LicenseGracePeriod {
  active: boolean
  startedAt: string | null
  endsAt: string | null
  remainingDays: number
}

export interface DegradedModeStatus {
  active: boolean
  mode: DegradedMode
  reason: string | null
}

export interface DeviceBindingPayload {
  machineId: string
  installationId: string
  fingerprintVersion: string
  appId: string
  appVersion: string | null
}

export interface LicenseActivationRequest {
  key: string
  deviceName?: string
  device: DeviceBindingPayload
}

export interface LicenseActivationResult {
  success: boolean
  status: LicenseStatus
  licenseStatus: LicenseStatus
  activationId: string | null
  activationToken: string | null
  activatedAt: string | null
  graceUntil: string | null
  reasonCode: LicenseReasonCode
  entitlements: LicenseEntitlements
  gracePeriod: LicenseGracePeriod
  degradedMode: DegradedModeStatus
}

export interface LicenseValidationRequest {
  key: string
  lastValidatedAt?: string | null
  device: DeviceBindingPayload
}

export interface LicenseValidationResult {
  valid: boolean
  status: LicenseStatus
  licenseStatus: LicenseStatus
  activationId: string | null
  activationToken: string | null
  validatedAt: string | null
  graceUntil: string | null
  reasonCode: LicenseReasonCode
  entitlements: LicenseEntitlements
  gracePeriod: LicenseGracePeriod
  degradedMode: DegradedModeStatus
}

export interface LicenseHeartbeatRequest {
  key: string
  activationId?: string | null
  lastHeartbeatAt?: string | null
  device: DeviceBindingPayload
}

export interface LicenseHeartbeatResult {
  ok: boolean
  status: LicenseStatus
  licenseStatus: LicenseStatus
  activationId: string | null
  activationToken: string | null
  heartbeatAt: string | null
  graceUntil: string | null
  reasonCode: LicenseReasonCode
  gracePeriod: LicenseGracePeriod
  entitlements?: LicenseEntitlements
  degradedMode: DegradedModeStatus
}

export interface LicenseStatusSnapshot {
  enabled: boolean
  status: LicenseStatus
  licenseStatus: LicenseStatus
  activated: boolean
  validated: boolean
  lastValidatedAt: string | null
  activationId?: string | null
  activationToken?: string | null
  graceUntil?: string | null
  reasonCode?: LicenseReasonCode
  entitlements: LicenseEntitlements
  gracePeriod: LicenseGracePeriod
  degradedMode: DegradedModeStatus
}
