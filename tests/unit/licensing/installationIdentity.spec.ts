import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

import { createInstallationIdentityProvider } from '../../../electron/main/modules/licensing/device-identity'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'

const tempDirectories: string[] = []

afterEach(() => {
  while (tempDirectories.length > 0) {
    const directory = tempDirectories.pop()

    if (directory) {
      rmSync(directory, { recursive: true, force: true })
    }
  }
})

describe('installation identity provider', () => {
  it('creates and persists an installation id on first access', () => {
    const storageDir = createTempDir()
    const provider = createInstallationIdentityProvider(storageDir, {
      createInstallationId: () => 'installation-1',
    })

    expect(provider.getInstallationId()).toBe('installation-1')
    expect(createSettingsStore(storageDir).getSetting('licensingCache').installationId).toBe(
      'installation-1',
    )
  })

  it('reuses the persisted installation id on future launches', () => {
    const storageDir = createTempDir()
    const firstProvider = createInstallationIdentityProvider(storageDir, {
      createInstallationId: () => 'installation-1',
    })

    expect(firstProvider.getInstallationId()).toBe('installation-1')

    const secondProvider = createInstallationIdentityProvider(storageDir, {
      createInstallationId: () => 'installation-2',
    })

    expect(secondProvider.getInstallationId()).toBe('installation-1')
  })

  it('keeps installation id separate from machine id concerns', () => {
    const storageDir = createTempDir()
    const provider = createInstallationIdentityProvider(storageDir, {
      createInstallationId: () => 'random-installation-id',
    })

    expect(provider.getInstallationId()).toBe('random-installation-id')
    expect(provider.getInstallationId()).not.toBe('machine-id')
  })
})

function createTempDir() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'default-electron-app-installation-id-'))
  tempDirectories.push(directory)
  return directory
}
