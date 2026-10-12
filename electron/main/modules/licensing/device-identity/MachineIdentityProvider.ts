import type {
  MachineFingerprintPayload,
  MachineIdentity,
  MachineId,
} from '../../../../../src/shared/licensing/device-identity'

export interface RawMachineIdentityInput {
  fingerprintVersion: string
  hostname: string | null
  platform: string
  arch: string
  appVersion: string | null
  attributes: Record<string, string | number | boolean | null>
}

export interface MachineIdentityInputProvider {
  getRawMachineIdentityInput: () => Promise<RawMachineIdentityInput> | RawMachineIdentityInput
}

export interface MachineIdentityHasher {
  hashMachineIdentity: (
    payload: Omit<MachineFingerprintPayload, 'machineId'>,
  ) => MachineId
}

export interface MachineIdentityProvider {
  getMachineIdentity: () => Promise<MachineIdentity> | MachineIdentity
}
