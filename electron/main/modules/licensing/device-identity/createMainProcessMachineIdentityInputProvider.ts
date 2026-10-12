import { app } from 'electron'
import os from 'node:os'
import type {
  MachineIdentityInputProvider,
  RawMachineIdentityInput,
} from './MachineIdentityProvider'

export interface MachineIdentityRuntimeSnapshot {
  hostname: string | null
  platform: string
  arch: string
  appVersion: string | null
  osRelease: string | null
  osMachine: string | null
  macAddresses: string[]
}

export interface MainProcessMachineIdentityInputProviderOptions {
  fingerprintVersion?: string
  getRuntimeSnapshot?: () => MachineIdentityRuntimeSnapshot
}

const DEFAULT_FINGERPRINT_VERSION = 'machine-v1'

export function createMainProcessMachineIdentityInputProvider(
  options: MainProcessMachineIdentityInputProviderOptions = {},
): MachineIdentityInputProvider {
  const fingerprintVersion = options.fingerprintVersion ?? DEFAULT_FINGERPRINT_VERSION
  const getRuntimeSnapshot = options.getRuntimeSnapshot ?? getDefaultRuntimeSnapshot

  return {
    getRawMachineIdentityInput(): RawMachineIdentityInput {
      const snapshot = getRuntimeSnapshot()

      return {
        fingerprintVersion,
        hostname: normalizeHostname(snapshot.hostname),
        platform: snapshot.platform,
        arch: snapshot.arch,
        appVersion: snapshot.appVersion,
        attributes: {
          osRelease: snapshot.osRelease,
          osMachine: snapshot.osMachine,
          macAddresses: normalizeMacAddresses(snapshot.macAddresses).join(','),
        },
      }
    },
  }
}

export function normalizeHostname(hostname: string | null): string | null {
  const normalizedHostname = hostname?.trim().toLowerCase()
  return normalizedHostname ? normalizedHostname : null
}

export function normalizeMacAddresses(macAddresses: readonly string[]): string[] {
  return [...new Set(
    macAddresses
      .map((macAddress) => macAddress.trim().toLowerCase())
      .filter((macAddress) => isUsableMacAddress(macAddress)),
  )].sort()
}

function getDefaultRuntimeSnapshot(): MachineIdentityRuntimeSnapshot {
  return {
    hostname: safeGetHostname(),
    platform: process.platform,
    arch: process.arch,
    appVersion: safeGetAppVersion(),
    osRelease: safeCall(() => os.release()),
    osMachine: safeCall(() => os.machine()),
    macAddresses: getMacAddressesFromNetworkInterfaces(os.networkInterfaces()),
  }
}

function getMacAddressesFromNetworkInterfaces(
  networkInterfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>,
): string[] {
  return Object.values(networkInterfaces)
    .flatMap((entries) => entries ?? [])
    .map((entry) => entry.mac)
}

function isUsableMacAddress(macAddress: string): boolean {
  return macAddress.length > 0 && macAddress !== '00:00:00:00:00:00'
}

function safeGetHostname(): string | null {
  return safeCall(() => os.hostname())
}

function safeGetAppVersion(): string | null {
  return safeCall(() => app.getVersion())
}

function safeCall(operation: () => string): string | null {
  try {
    const value = operation().trim()
    return value.length > 0 ? value : null
  } catch {
    return null
  }
}
