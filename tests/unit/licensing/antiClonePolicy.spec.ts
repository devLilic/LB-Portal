import { describe, expect, it } from 'vitest'

import { resolveAntiClonePolicy } from '../../../src/shared/licensing/device-identity'

const baselineNow = new Date('2026-03-27T12:00:00.000Z')

describe('anti-clone policy resolver', () => {
  it('allows normal usage when device binding matches and server status is valid', () => {
    expect(
      resolveAntiClonePolicy({
        currentMachineId: 'machine-1',
        storedMachineId: 'machine-1',
        installationId: 'installation-1',
        storedInstallationId: 'installation-1',
        serverStatus: 'valid',
        graceUntil: null,
        now: baselineNow,
      }),
    ).toMatchObject({
      resolution: 'allow_normal',
      cloneSuspected: false,
      machineMismatch: false,
      installationMismatch: false,
    })
  })

  it('allows grace when grace is active on the same device binding', () => {
    expect(
      resolveAntiClonePolicy({
        currentMachineId: 'machine-1',
        storedMachineId: 'machine-1',
        installationId: 'installation-1',
        storedInstallationId: 'installation-1',
        serverStatus: 'grace',
        graceUntil: '2026-03-28T12:00:00.000Z',
        now: baselineNow,
      }),
    ).toMatchObject({
      resolution: 'allow_grace',
      graceActive: true,
      cloneSuspected: false,
    })
  })

  it('blocks clone attempts when the current machine differs from the stored machine', () => {
    expect(
      resolveAntiClonePolicy({
        currentMachineId: 'machine-2',
        storedMachineId: 'machine-1',
        installationId: 'installation-1',
        storedInstallationId: 'installation-1',
        serverStatus: 'valid',
        graceUntil: null,
        now: baselineNow,
      }),
    ).toMatchObject({
      resolution: 'block_clone',
      cloneSuspected: true,
      machineMismatch: true,
      status: 'clone_suspected',
    })
  })

  it('requires reactivation when installation binding changes on the same machine', () => {
    expect(
      resolveAntiClonePolicy({
        currentMachineId: 'machine-1',
        storedMachineId: 'machine-1',
        installationId: 'installation-2',
        storedInstallationId: 'installation-1',
        serverStatus: 'valid',
        graceUntil: null,
        now: baselineNow,
      }),
    ).toMatchObject({
      resolution: 'require_reactivation',
      installationMismatch: true,
      cloneSuspected: false,
      status: 'reauthorization_required',
    })
  })

  it('allows degraded handling for non-clone invalid states', () => {
    expect(
      resolveAntiClonePolicy({
        currentMachineId: 'machine-1',
        storedMachineId: 'machine-1',
        installationId: 'installation-1',
        storedInstallationId: 'installation-1',
        serverStatus: 'expired',
        graceUntil: null,
        now: baselineNow,
      }),
    ).toMatchObject({
      resolution: 'allow_degraded',
      cloneSuspected: false,
      status: 'expired',
    })
  })
})
