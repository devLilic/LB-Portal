import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { defaultMosProjects } from '../../../src/shared/settings/mosProjects'

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
      mosMappings: defaultMosProjects(),
      liveBoardConnection: { mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 },
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

  it('uses simulation defaults for legacy files and validates TCP settings strictly', () => {
    const directory = createTempDir()
    const settingsPath = path.join(directory, 'settings.json')
    writeFileSync(settingsPath, JSON.stringify({ language: 'ru' }), 'utf8')
    const store = createSettingsStore(directory)
    expect(store.getSetting('liveBoardConnection')).toEqual({ mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 })
    const tcp = { mode: 'tcp' as const, host: 'localhost', port: 9010, timeoutMs: 1000 }
    expect(store.setSetting('liveBoardConnection', tcp)).toEqual(tcp)
    expect(createSettingsStore(directory).getSetting('liveBoardConnection')).toEqual(tcp)
    expect(() => store.setSetting('liveBoardConnection', { ...tcp, port: null })).toThrow(/port/)
    expect(() => store.setSetting('liveBoardConnection', { ...tcp, host: 'bad host' })).toThrow(/host/)
    expect(() => store.setSetting('liveBoardConnection', { ...tcp, timeoutMs: 99 })).toThrow(/timeout/)
  })

  it('preserves invalid stored LiveBoard settings when a strict read fails', () => {
    const directory = createTempDir()
    const settingsPath = path.join(directory, 'settings.json')
    const invalid = { mode: 'tcp', host: 'bad host', port: 9010, timeoutMs: 5000 }
    writeFileSync(settingsPath, JSON.stringify({ liveBoardConnection: invalid }), 'utf8')
    const store = createSettingsStore(directory)
    expect(() => store.getSetting('liveBoardConnection')).toThrow(/host/)
    expect(() => store.setSetting('liveBoardConnection', { mode: 'tcp', host: 'localhost', port: 9010, timeoutMs: 5000 })).toThrow(/host/i)
    expect(JSON.parse(readFileSync(settingsPath, 'utf8')).liveBoardConnection).toEqual(invalid)
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
      mosMappings: defaultMosProjects(),
      liveBoardConnection: { mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 },
    })
  })
})

function createTempDir() {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'default-electron-app-settings-'))
  tempDirectories.push(directory)
  return directory
}
