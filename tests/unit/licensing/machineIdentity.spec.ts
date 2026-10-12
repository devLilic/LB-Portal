import { describe, expect, it } from 'vitest'

import {
  createMachineIdentityProvider,
  createMainProcessMachineIdentityInputProvider,
  createSha256MachineIdentityHasher,
  normalizeHostname,
  normalizeMacAddresses,
} from '../../../electron/main/modules/licensing/device-identity'

describe('machine identity generation', () => {
  it('normalizes hostname and mac address inputs deterministically', () => {
    expect(normalizeHostname('  Workstation-01  ')).toBe('workstation-01')
    expect(
      normalizeMacAddresses([
        'AA:BB:CC:DD:EE:FF',
        '00:00:00:00:00:00',
        'aa:bb:cc:dd:ee:ff',
        ' 11:22:33:44:55:66 ',
      ]),
    ).toEqual(['11:22:33:44:55:66', 'aa:bb:cc:dd:ee:ff'])
  })

  it('creates a stable hashed machine id from the runtime snapshot', async () => {
    const inputProvider = createMainProcessMachineIdentityInputProvider({
      getRuntimeSnapshot: () => ({
        hostname: 'WORKSTATION-01',
        platform: 'win32',
        arch: 'x64',
        appVersion: '1.0.0',
        osRelease: '10.0.22631',
        osMachine: 'x86_64',
        macAddresses: ['11:22:33:44:55:66', 'AA:BB:CC:DD:EE:FF'],
      }),
    })
    const provider = createMachineIdentityProvider(inputProvider)

    const firstIdentity = await provider.getMachineIdentity()
    const secondIdentity = await provider.getMachineIdentity()

    expect(firstIdentity.machineId).toHaveLength(64)
    expect(firstIdentity.machineId).toMatch(/^[a-f0-9]+$/)
    expect(firstIdentity).toEqual(secondIdentity)
    expect(firstIdentity.fingerprint.fingerprintVersion).toBe('machine-v1')
  })

  it('changes the hashed machine id when the fingerprint version changes', async () => {
    const snapshot = {
      hostname: 'WORKSTATION-01',
      platform: 'win32',
      arch: 'x64',
      appVersion: '1.0.0',
      osRelease: '10.0.22631',
      osMachine: 'x86_64',
      macAddresses: ['aa:bb:cc:dd:ee:ff'],
    }

    const machineV1 = createMachineIdentityProvider(
      createMainProcessMachineIdentityInputProvider({
        fingerprintVersion: 'machine-v1',
        getRuntimeSnapshot: () => snapshot,
      }),
      createSha256MachineIdentityHasher(),
    )
    const machineV2 = createMachineIdentityProvider(
      createMainProcessMachineIdentityInputProvider({
        fingerprintVersion: 'machine-v2',
        getRuntimeSnapshot: () => snapshot,
      }),
      createSha256MachineIdentityHasher(),
    )

    const identityV1 = await machineV1.getMachineIdentity()
    const identityV2 = await machineV2.getMachineIdentity()

    expect(identityV1.machineId).not.toBe(identityV2.machineId)
  })
})
