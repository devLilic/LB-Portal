export type MachineId = string
export type InstallationId = string
export type ActivationToken = string

export type DeviceValidationStatus =
  | 'valid'
  | 'grace'
  | 'invalid_license'
  | 'expired'
  | 'revoked'
  | 'device_limit_exceeded'
  | 'device_mismatch'
  | 'clone_suspected'
  | 'reauthorization_required'

export interface DeviceFingerprintPayload {
  machineId: MachineId
  installationId: InstallationId
  fingerprintVersion: string
  hostname: string | null
  platform: string
  arch: string
  appVersion: string | null
  attributes: Record<string, string | number | boolean | null>
}

export type MachineFingerprintPayload = Omit<DeviceFingerprintPayload, 'installationId'>

export interface MachineIdentity {
  machineId: MachineId
  fingerprint: MachineFingerprintPayload
}

export interface InstallationIdentity {
  installationId: InstallationId
  machineId: MachineId
  createdAt: string | null
  lastSeenAt: string | null
}

export interface ActivationIdentity {
  activationToken: ActivationToken
  machineId: MachineId
  installationId: InstallationId
  activatedAt: string | null
}

export interface DeviceValidationResult {
  valid: boolean
  status: DeviceValidationStatus
  machineId: MachineId
  installationId: InstallationId
  activationToken: ActivationToken | null
  validatedAt: string | null
  reauthorizationRequired: boolean
  reason: string | null
}

export interface CloneDetectionResult {
  suspected: boolean
  status: Extract<DeviceValidationStatus, 'valid' | 'clone_suspected' | 'device_mismatch'>
  machineId: MachineId
  installationId: InstallationId
  detectedAt: string | null
  reason: string | null
}
