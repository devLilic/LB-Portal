import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { AppSettings, SettingsKey } from '../../../../src/shared/settings/types'

export interface SettingsStore {
  getSettings: () => AppSettings
  getSetting: <TKey extends SettingsKey>(key: TKey) => AppSettings[TKey]
  setSetting: <TKey extends SettingsKey>(key: TKey, value: AppSettings[TKey]) => AppSettings[TKey]
}

const defaultSettings: AppSettings = {
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
}

export function createSettingsStore(storageDir: string): SettingsStore {
  const filePath = path.join(storageDir, 'settings.json')

  return {
    getSettings() {
      return readSettings(filePath)
    },
    getSetting(key) {
      return readSettings(filePath)[key]
    },
    setSetting(key, value) {
      const settings = readSettings(filePath)
      const nextSettings = {
        ...settings,
        [key]: value,
      }

      writeSettings(filePath, nextSettings)
      return nextSettings[key]
    },
  }
}

function readSettings(filePath: string): AppSettings {
  try {
    const fileContent = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(fileContent) as Partial<AppSettings>

    return {
      ...defaultSettings,
      ...parsed,
      updatePreferences: {
        ...defaultSettings.updatePreferences,
        ...parsed.updatePreferences,
      },
      licensingCache: {
        ...defaultSettings.licensingCache,
        ...parsed.licensingCache,
      },
      uiPreferences: {
        ...defaultSettings.uiPreferences,
        ...parsed.uiPreferences,
      },
    }
  } catch {
    return defaultSettings
  }
}

function writeSettings(filePath: string, settings: AppSettings) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
}
