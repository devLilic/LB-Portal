import { readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import type {
  OnAirError,
  OnAirGroup,
  OnAirProjectSummary,
  OnAirSnapshot,
  OnAirState,
} from '../../../src/shared/onair/contracts'
import { normalizeMosProjects, type MosProject } from '../../../src/shared/settings/mosProjects'
import type { SettingsKey, AppSettings } from '../../../src/shared/settings/types'
import { subscribeSettingsChanges, type SettingsStore } from '../modules/settings/settingsStore'
import { assembleOnAirGroups, OnAirCsvError, parseOnAirCsvFile, parseOnAirCsvHeaders, type OnAirCsvFileKind, type OnAirCsvFileName } from './parseOnAirCsv'

const maxAttempts = 3
type CsvSourceConfig = { kind: OnAirCsvFileKind; fileName: string; columns?: Record<string, string> }

interface CachedSnapshot {
  snapshot: OnAirSnapshot
  generation: number
}

export interface OnAirCsvService {
  listProjects(): OnAirProjectSummary[]
  listCsvFiles(folderPath: string): Promise<string[]>
  readCsvHeaders(folderPath: string, fileName: string): Promise<string[]>
  getSnapshot(projectId: string): OnAirState
  refresh(projectId: string): Promise<OnAirState>
  dispose(): void
}

export interface OnAirCsvServiceDependencies {
  readFile(filePath: string): Promise<Buffer>
  readdir?(folderPath: string, options: { withFileTypes: true }): Promise<Array<{ name: string; isFile(): boolean }>>
  stat(filePath: string): Promise<{ dev: number | bigint; ino: number | bigint; size: number; mtimeMs: number; ctimeMs: number; isFile(): boolean }>
}

export function createOnAirCsvService(
  settingsStore: SettingsStore,
  settingsDirectory: string,
  dependencies: OnAirCsvServiceDependencies = { readFile, readdir, stat },
): OnAirCsvService {
  const snapshots = new Map<string, CachedSnapshot>()
  const lastErrors = new Map<string, OnAirError>()
  const generations = new Map<string, number>()
  const knownSources = new Map<string, string | null>()
  const busyProjects = new Set<string>()
  const inFlight = new Map<string, Promise<OnAirState>>()

  function readProjects() {
    try {
      return normalizeMosProjects(settingsStore.getSetting('mosMappings'))
    } catch (error) {
      throw new Error('MOS project settings are invalid.', { cause: error })
    }
  }

  function projectSources(): Map<string, string | null> {
    return new Map(readProjects().projects.map(project => [project.id, sourceKey(project)]))
  }

  function reconcileSources(next = projectSources()) {
    const allIds = new Set([...knownSources.keys(), ...next.keys()])
    for (const id of allIds) {
      if (!next.has(id)) {
        generations.set(id, (generations.get(id) ?? 0) + 1)
        snapshots.delete(id)
        lastErrors.delete(id)
        continue
      }
      const previous = knownSources.get(id) ?? null
      const current = next.get(id) ?? null
      if (previous !== current) {
        generations.set(id, (generations.get(id) ?? 0) + 1)
        snapshots.delete(id)
        lastErrors.set(id, { code: 'SOURCE_CHANGED' })
      }
    }
    knownSources.clear()
    for (const [id, source] of next) knownSources.set(id, source)
  }

  try {
    for (const [id, source] of projectSources()) knownSources.set(id, source)
  } catch { /* invalid settings are reported by the IPC operation */ }
  const unsubscribeSettings = subscribeSettingsChanges(settingsDirectory, (key: SettingsKey, value: AppSettings[SettingsKey]) => {
    if (key !== 'mosMappings') return
    try {
      reconcileSources(new Map(normalizeMosProjects(value).projects.map(project => [project.id, sourceKey(project)])))
    } catch {
      for (const id of knownSources.keys()) {
        generations.set(id, (generations.get(id) ?? 0) + 1)
        lastErrors.set(id, { code: 'SETTINGS_INVALID' })
      }
    }
  })

  function state(projectId: string, project?: MosProject, error?: OnAirError | null): OnAirState {
    const effectiveError = error === undefined ? lastErrors.get(projectId) ?? null : error
    if (error === null) lastErrors.delete(projectId)
    else if (error !== undefined) lastErrors.set(projectId, error)
    const folderPath = project?.onAirCsv?.folderPath ?? null
    return {
      projectId,
      folderPath,
      snapshot: snapshots.get(projectId)?.snapshot ?? null,
      error: effectiveError,
      busy: busyProjects.has(projectId),
    }
  }

  function findProject(projectId: string): MosProject | undefined {
    return readProjects().projects.find(project => project.id === projectId)
  }

  function listProjects(): OnAirProjectSummary[] {
    const config = readProjects()
    reconcileSources(new Map(config.projects.map(project => [project.id, sourceKey(project)])))
    return config.projects.map(project => ({
      id: project.id,
      name: project.name,
      kind: project.kind,
      folderPath: project.onAirCsv?.folderPath ?? null,
    }))
  }

  async function listCsvFiles(folderPath: string): Promise<string[]> {
    const folder = validateFolderPath(folderPath)
    const entries = await (dependencies.readdir ?? readdir)(folder, { withFileTypes: true })
    return entries.filter(entry => entry.isFile() && /\.csv$/i.test(entry.name)).map(entry => entry.name).sort((a, b) => a.localeCompare(b))
  }

  async function readCsvHeaders(folderPath: string, fileName: string): Promise<string[]> {
    const folder = validateFolderPath(folderPath)
    if (typeof fileName !== 'string' || path.basename(fileName) !== fileName || !/^[^\\/:*?"<>|\0]+\.csv$/i.test(fileName)) throw new Error('Invalid CSV filename.')
    const available = await listCsvFiles(folder)
    if (!available.includes(fileName)) throw new Error('CSV file is not in the selected folder.')
    return parseOnAirCsvHeaders(fileName, await dependencies.readFile(path.join(folder, fileName)))
  }

  async function loadSnapshot(projectId: string, source: string, selectedSources: CsvSourceConfig[], generation: number): Promise<OnAirState> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const files = [...new Set(selectedSources.map(item => item.fileName))]
      let before: string[]
      try {
        before = await Promise.all(files.map(file => fileSignature(path.join(source, file), dependencies.stat).catch(error => {
          throw withSourceFile(error, file)
        })))
      } catch (error) {
        const changed = currentSourceError(projectId, source, selectedSources, generation)
        if (changed) return changed
        if (isMissingFile(error) && attempt < maxAttempts - 1) continue
        return state(projectId, safeFindProject(projectId), readError(error))
      }

      let contents: Buffer[]
      try {
        contents = await Promise.all(files.map(file => dependencies.readFile(path.join(source, file)).catch(error => {
          throw withSourceFile(error, file)
        })))
      } catch (error) {
        const changed = currentSourceError(projectId, source, selectedSources, generation)
        if (changed) return changed
        if (isMissingFile(error) && attempt < maxAttempts - 1) continue
        return state(projectId, safeFindProject(projectId), readError(error))
      }

      let after: string[]
      try {
        after = await Promise.all(files.map(file => fileSignature(path.join(source, file), dependencies.stat).catch(error => {
          throw withSourceFile(error, file)
        })))
      } catch (error) {
        const changed = currentSourceError(projectId, source, selectedSources, generation)
        if (changed) return changed
        if (isMissingFile(error) && attempt < maxAttempts - 1) continue
        return state(projectId, safeFindProject(projectId), readError(error))
      }
      if (before.some((signature, index) => signature !== after[index])) {
        if (attempt < maxAttempts - 1) continue
        return state(projectId, safeFindProject(projectId), { code: 'FILES_CHANGED' })
      }

      const changed = currentSourceError(projectId, source, selectedSources, generation)
      if (changed) return changed
      const currentProject = findProject(projectId)!

      try {
        const contentsByFile = new Map(files.map((file, index) => [file, contents[index]!]))
        const parsed = new Map<OnAirCsvFileKind, ReturnType<typeof parseOnAirCsvFile>>()
        for (const item of selectedSources) {
          const rows = parseOnAirCsvFile(item.fileName, contentsByFile.get(item.fileName)!, item.kind, item.columns)
          parsed.set(item.kind, [...(parsed.get(item.kind) ?? []), ...rows])
        }
        const groups: OnAirGroup[] = assembleOnAirGroups(projectId, parsed.get('titles') ?? [], parsed.get('persons') ?? [], parsed.get('locations') ?? [], parsed.get('phones') ?? [], parsed.get('wait_titles_locations') ?? [])
        const snapshot: OnAirSnapshot = { projectId, folderPath: source, loadedAt: new Date().toISOString(), groups }
        snapshots.set(projectId, { snapshot, generation })
        return state(projectId, currentProject, null)
      } catch (error) {
        if (error instanceof OnAirCsvError) {
          return state(projectId, currentProject, {
            code: 'INVALID_CSV', file: error.file,
            ...(error.record === undefined ? {} : { record: error.record }), detail: error.message,
          })
        }
        return state(projectId, currentProject, readError(error))
      }
    }
    return state(projectId, safeFindProject(projectId), { code: 'FILES_CHANGED' })
  }

  function safeFindProject(projectId: string): MosProject | undefined {
    try { return findProject(projectId) } catch { return undefined }
  }

  function currentSourceError(projectId: string, source: string, selectedSources: CsvSourceConfig[], generation: number): OnAirState | null {
    let currentProject: MosProject | undefined
    try { currentProject = findProject(projectId) } catch { return state(projectId, undefined, { code: 'SETTINGS_INVALID' }) }
    if (!currentProject) {
      snapshots.delete(projectId)
      return state(projectId, undefined, { code: 'PROJECT_NOT_FOUND' })
    }
    if (currentProject.onAirCsv?.folderPath !== source || JSON.stringify(getSelectedSources(currentProject)) !== JSON.stringify(selectedSources) || (generations.get(projectId) ?? 0) !== generation) {
      snapshots.delete(projectId)
      return state(projectId, currentProject, { code: 'SOURCE_CHANGED' })
    }
    return null
  }

  return {
    listProjects,
    listCsvFiles,
    readCsvHeaders,
    getSnapshot(projectId) {
      let project: MosProject | undefined
      try { project = findProject(projectId) } catch { return state(projectId, undefined, { code: 'SETTINGS_INVALID' }) }
      if (!project) return state(projectId, undefined, { code: 'PROJECT_NOT_FOUND' })
      reconcileSources()
      if (!project.onAirCsv) return state(projectId, project, { code: 'NOT_CONFIGURED' })
      const cached = snapshots.get(projectId)
      if (cached && cached.generation !== (generations.get(projectId) ?? 0)) snapshots.delete(projectId)
      return state(projectId, project)
    },
    refresh(projectId) {
      const pending = inFlight.get(projectId)
      if (pending) return pending
      let project: MosProject | undefined
      try { project = findProject(projectId) } catch { return Promise.resolve(state(projectId, undefined, { code: 'SETTINGS_INVALID' })) }
      if (!project) return Promise.resolve(state(projectId, undefined, { code: 'PROJECT_NOT_FOUND' }))
      reconcileSources()
      if (!project.onAirCsv) return Promise.resolve(state(projectId, project, { code: 'NOT_CONFIGURED' }))
      const source = project.onAirCsv.folderPath
      const selectedSources = getSelectedSources(project)
      const generation = generations.get(projectId) ?? 0
      busyProjects.add(projectId)
      const operation = loadSnapshot(projectId, source, selectedSources, generation)
        .then(result => ({ ...result, busy: false }))
        .finally(() => {
          busyProjects.delete(projectId)
          inFlight.delete(projectId)
        })
      inFlight.set(projectId, operation)
      return operation
    },
    dispose() {
      unsubscribeSettings()
      snapshots.clear()
      lastErrors.clear()
      inFlight.clear()
      busyProjects.clear()
    },
  }
}

async function fileSignature(filePath: string, statFile: OnAirCsvServiceDependencies['stat']): Promise<string> {
  const info = await statFile(filePath)
  if (!info.isFile()) throw Object.assign(new Error('Expected a CSV file.'), { code: 'EISDIR' })
  return `${info.dev}:${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`
}

function readError(error: unknown): OnAirError {
  const file = typeof error === 'object' && error !== null && 'sourceFile' in error && typeof error.sourceFile === 'string' ? error.sourceFile : undefined
  if (isMissingFile(error)) return { code: 'READ_FAILED', ...(file ? { file } : {}), detail: file ? `Required file ${file} is missing.` : 'One or more required CSV files are missing.' }
  return { code: 'READ_FAILED', ...(file ? { file } : {}), detail: error instanceof Error ? error.message : 'Could not read source files.' }
}

function withSourceFile(error: unknown, file: string): Error & { sourceFile: string } {
  const wrapped = error instanceof Error ? error : new Error('Could not read source file.')
  Object.defineProperty(wrapped, 'sourceFile', { value: file, configurable: true })
  return wrapped as Error & { sourceFile: string }
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT'
}

function sourceKey(project: MosProject): string | null {
  if (!project.onAirCsv) return null
  return `${project.onAirCsv.folderPath}\0${JSON.stringify(getSelectedSources(project))}`
}

function getSelectedSources(project: MosProject): CsvSourceConfig[] {
  const sources = project.mappings.sections.flatMap(section => section.csvSource ? [{
    kind: section.csvSource.kind === 'waitTitlesLocations' ? 'wait_titles_locations' as const : section.csvSource.kind,
    fileName: section.csvSource.fileName.trim(),
    ...(section.csvSource.columns && Object.keys(section.csvSource.columns).length ? { columns: section.csvSource.columns } : {}),
  }] : [])
  return [...new Map(sources.map(source => [JSON.stringify(source), source])).values()]
}

function validateFolderPath(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\0') || !path.isAbsolute(value)) throw new Error('Invalid CSV folder path.')
  return path.resolve(value)
}
