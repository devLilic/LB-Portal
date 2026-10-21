import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { AppSettings, SettingsKey } from '../../../../src/shared/settings/types'
import { validateMosMappings, type MosMappingConfig } from '../../../../src/shared/settings/mosMappings'
import { defaultMosProjects, normalizeMosProjects, setActiveProjectMappings, validateMosProjects, type MosProjectsConfig } from '../../../../src/shared/settings/mosProjects'
import { defaultLiveBoardConnection, validateLiveBoardConnection } from '../../../../src/shared/liveboard/connection'

export interface SettingsStore {
  getSettings: () => AppSettings
  getSetting: <TKey extends SettingsKey>(key: TKey) => AppSettings[TKey]
  setSetting: <TKey extends SettingsKey>(key: TKey, value: AppSettings[TKey]) => AppSettings[TKey]
}

type SettingsChangeListener = (key: SettingsKey, value: AppSettings[SettingsKey]) => void
const settingsChangeListeners = new Map<string, Set<SettingsChangeListener>>()

export function subscribeSettingsChanges(storageDir: string, listener: SettingsChangeListener): () => void {
  const key = path.resolve(storageDir).toLowerCase()
  const listeners = settingsChangeListeners.get(key) ?? new Set<SettingsChangeListener>()
  listeners.add(listener)
  settingsChangeListeners.set(key, listeners)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) settingsChangeListeners.delete(key)
  }
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
  mosMappings: defaultMosProjects(),
  liveBoardConnection: defaultLiveBoardConnection,
}

export function createSettingsStore(storageDir: string): SettingsStore {
  const filePath = path.join(storageDir, 'settings.json')

  return {
    getSettings() {
      return readSettings(filePath)
    },
    getSetting(key) {
      const value = readSettings(filePath, key === 'mosMappings' || key === 'liveBoardConnection')[key]
      if (key === 'mosMappings') return normalizeMosProjects(value) as AppSettings[typeof key]
      if (key === 'liveBoardConnection') return validateLiveBoardConnection(value) as AppSettings[typeof key]
      return value
    },
    setSetting(key, value) {
      if (key === 'liveBoardConnection') value = validateLiveBoardConnection(value) as AppSettings[typeof key]
      const settings = readSettings(filePath, key === 'mosMappings' || key === 'liveBoardConnection')
      if (key === 'mosMappings') {
        const current = normalizeMosProjects(settings.mosMappings)
        validateMosMappingsInput(value, current)
      }
      if (key === 'liveBoardConnection') validateLiveBoardConnection(settings.liveBoardConnection)
      const savedValue = key === 'mosMappings'
        ? (isLegacyMosMappings(value) ? setActiveProjectMappings(settings.mosMappings, value) : validateMosProjects(value))
        : value
      const nextSettings = {
        ...settings,
        [key]: savedValue,
      }

      writeSettings(filePath, nextSettings)
      for (const listener of settingsChangeListeners.get(path.resolve(storageDir).toLowerCase()) ?? []) listener(key, nextSettings[key])
      return nextSettings[key]
    },
  }
}

function validateMosMappingsInput(value:unknown,current?:MosProjectsConfig):MosMappingConfig|MosProjectsConfig {
  if(isLegacyMosMappings(value)) {
    const activeKind=current?.projects.find(project=>project.id===current.activeProjectId)?.kind
    return validateMosMappings(value,{allowEmptySources:activeKind==='standalone'})
  }
  return validateMosProjects(value)
}

function isLegacyMosMappings(value:unknown):value is MosMappingConfig {
  return isRecord(value)&&value.version===1
}

function readSettings(filePath: string, strict = false): AppSettings {
  try {
    const fileContent = readFileSync(filePath, 'utf8')
    const parsedValue = JSON.parse(fileContent) as unknown
    if (!isRecord(parsedValue)) throw new Error('Settings file must contain an object.')
    const parsed = parsedValue as Partial<AppSettings>

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
      // Keep invalid raw mapping data intact so unrelated settings remain usable.
      mosMappings: (parsed.mosMappings === undefined ? defaultSettings.mosMappings : parsed.mosMappings) as AppSettings['mosMappings'],
      liveBoardConnection: (parsed.liveBoardConnection === undefined ? defaultSettings.liveBoardConnection : parsed.liveBoardConnection) as AppSettings['liveBoardConnection'],
    }
  } catch (error) {
    if (strict && !isMissingFileError(error)) throw new Error('Settings file is invalid; validated settings are unavailable.', { cause: error })
    return defaultSettings
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function writeSettings(filePath: string, settings: AppSettings) {
  mkdirSync(path.dirname(filePath), { recursive: true })
  writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf8')
}
