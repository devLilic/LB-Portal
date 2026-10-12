import type {
  DeviceValidationStatus,
  InstallationId,
  MachineId,
} from './contracts'

export type AntiCloneResolution =
  | 'allow_normal'
  | 'allow_grace'
  | 'allow_degraded'
  | 'block_clone'
  | 'require_reactivation'

export interface AntiClonePolicyInput {
  currentMachineId: MachineId
  storedMachineId: MachineId | null
  installationId: InstallationId
  storedInstallationId: InstallationId | null
  serverStatus: DeviceValidationStatus
  graceUntil: string | null
  now?: Date
}

export interface AntiClonePolicyResult {
  resolution: AntiCloneResolution
  status: DeviceValidationStatus
  cloneSuspected: boolean
  graceActive: boolean
  machineMismatch: boolean
  installationMismatch: boolean
  reason: string
}

export function resolveAntiClonePolicy(
  input: AntiClonePolicyInput,
): AntiClonePolicyResult {
  const now = input.now ?? new Date()
  const machineMismatch = !!input.storedMachineId && input.storedMachineId !== input.currentMachineId
  const installationMismatch =
    !!input.storedInstallationId && input.storedInstallationId !== input.installationId
  const graceActive = isGraceActive(input.graceUntil, now)

  if (input.serverStatus === 'clone_suspected') {
    return createResult('block_clone', input.serverStatus, graceActive, machineMismatch, installationMismatch, true, 'Clone suspected by validation state.')
  }

  if (input.serverStatus === 'device_mismatch') {
    return createResult('block_clone', input.serverStatus, graceActive, machineMismatch, installationMismatch, true, 'Stored device binding does not match the current machine.')
  }

  if (machineMismatch) {
    return createResult('block_clone', 'clone_suspected', graceActive, machineMismatch, installationMismatch, true, 'Current machine does not match the stored machine binding.')
  }

  if (installationMismatch) {
    return createResult('require_reactivation', 'reauthorization_required', graceActive, machineMismatch, installationMismatch, false, 'Installation binding changed and requires explicit reactivation.')
  }

  if (input.serverStatus === 'grace' && graceActive) {
    return createResult('allow_grace', input.serverStatus, true, machineMismatch, installationMismatch, false, 'Grace window is active for the current valid device binding.')
  }

  if (
    input.serverStatus === 'device_limit_exceeded' ||
    input.serverStatus === 'reauthorization_required'
  ) {
    return createResult('require_reactivation', input.serverStatus, graceActive, machineMismatch, installationMismatch, false, 'Server requires an explicit reactivation step.')
  }

  if (
    input.serverStatus === 'invalid_license' ||
    input.serverStatus === 'expired' ||
    input.serverStatus === 'revoked'
  ) {
    return createResult('allow_degraded', input.serverStatus, graceActive, machineMismatch, installationMismatch, false, 'License status is not fully valid and should fall back to degraded handling.')
  }

  return createResult('allow_normal', input.serverStatus, graceActive, machineMismatch, installationMismatch, false, 'Current device binding is valid.')
}

function isGraceActive(graceUntil: string | null, now: Date): boolean {
  if (!graceUntil) {
    return false
  }

  const graceUntilDate = new Date(graceUntil)

  if (Number.isNaN(graceUntilDate.getTime())) {
    return false
  }

  return graceUntilDate.getTime() > now.getTime()
}

function createResult(
  resolution: AntiCloneResolution,
  status: DeviceValidationStatus,
  graceActive: boolean,
  machineMismatch: boolean,
  installationMismatch: boolean,
  cloneSuspected: boolean,
  reason: string,
): AntiClonePolicyResult {
  return {
    resolution,
    status,
    cloneSuspected,
    graceActive,
    machineMismatch,
    installationMismatch,
    reason,
  }
}
