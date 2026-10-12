import { createHash } from 'node:crypto'
import type { MachineFingerprintPayload } from '../../../../../src/shared/licensing/device-identity'
import type {
  MachineIdentityHasher,
  MachineIdentityInputProvider,
  MachineIdentityProvider,
  RawMachineIdentityInput,
} from './MachineIdentityProvider'

export function createMachineIdentityProvider(
  inputProvider: MachineIdentityInputProvider,
  hasher: MachineIdentityHasher = createSha256MachineIdentityHasher(),
): MachineIdentityProvider {
  return {
    async getMachineIdentity() {
      const rawInput = await inputProvider.getRawMachineIdentityInput()
      const fingerprint = createDeviceFingerprintPayload(rawInput)
      const machineId = hasher.hashMachineIdentity(fingerprint)

      return {
        machineId,
        fingerprint: {
          ...fingerprint,
          machineId,
        },
      }
    },
  }
}

export function createDeviceFingerprintPayload(
  input: RawMachineIdentityInput,
): Omit<MachineFingerprintPayload, 'machineId'> {
  return {
    fingerprintVersion: input.fingerprintVersion,
    hostname: input.hostname,
    platform: input.platform,
    arch: input.arch,
    appVersion: input.appVersion,
    attributes: input.attributes,
  }
}

export function createSha256MachineIdentityHasher(): MachineIdentityHasher {
  return {
    hashMachineIdentity(payload) {
      return createHash('sha256')
        .update(stableStringify(payload))
        .digest('hex')
    },
  }
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value))
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue)
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((accumulator, key) => {
      accumulator[key] = sortValue((value as Record<string, unknown>)[key])
      return accumulator
    }, {})
}
