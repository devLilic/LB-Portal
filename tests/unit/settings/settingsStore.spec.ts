import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('settings store', () => {
  it('returns the default settings structure before any write', () => {
    const store = createSettingsStore(createTempDir())

    expect(store.getSettings()).toEqual({
      language: null,
      updatePreferences: {
        autoCheck: true,
        downloadStrategy: 'manual',
      },
      licensingCache: {
        activationToken: null,
        activationId: null,
        machineId: null,
        installationId: null,
        lastValidatedAt: null,
        graceUntil: null,
        lastKnownLicenseStatus: null,
        lastHeartbeatAt: null,
        licenseKeyHash: null,
        activeLicenseKey: null,
      },
      uiPreferences: {
        theme: 'system',
        density: 'comfortable',
      },
    })
  })

  it('persists individual settings and keeps the rest of the structure intact', () => {
    const directory = createTempDir()
    const store = createSettingsStore(directory)

    store.setSetting('language', 'ru')
    store.setSetting('uiPreferences', {
      theme: 'dark',
      density: 'compact',
    })

    const reloadedStore = createSettingsStore(directory)

    expect(reloadedStore.getSetting('language')).toBe('ru')
    expect(reloadedStore.getSetting('uiPreferences')).toEqual({
      theme: 'dark',
      density: 'compact',
    })
    expect(reloadedStore.getSetting('updatePreferences')).toEqual({
      autoCheck: true,
      downloadStrategy: 'manual',
    })

    const settingsPath = path.join(directory, 'settings.json')
    expect(JSON.parse(readFileSync(settingsPath, 'utf8'))).toMatchObject({
      language: 'ru',
      uiPreferences: {
        theme: 'dark',
        density: 'compact',
      },
    })
  })

  it('falls back to defaults when the persisted file is invalid', () => {
    const directory = createTempDir()
    const settingsPath = path.join(directory, 'settings.json')

    writeFileSync(settingsPath, '{invalid json', 'utf8')

    const store = createSettingsStore(directory)

    expect(store.getSettings()).toEqual({
      language: null,
      updatePreferences: {
        autoCheck: true,
        downloadStrategy: 'manual',
      },
      licensingCache: {
        activationToken: null,
        activationId: null,
        machineId: null,
        installationId: null,
        lastValidatedAt: null,
        graceUntil: null,
        lastKnownLicenseStatus: null,
        lastHeartbeatAt: null,
        licenseKeyHash: null,
        activeLicenseKey: null,
      },
      uiPreferences: {
        theme: 'system',
        density: 'comfortable',
      },
    })
  })
})

function createTempDir() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'default-electron-app-settings-'))
  tempDirectories.push(directory)
  return directory
}
