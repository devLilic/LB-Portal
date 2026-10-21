import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { duplicateMosProject, normalizeMosProjects, validateMosProjects, builtinTelejurnalProjectId } from '../../../src/shared/settings/mosProjects'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'

const dirs: string[] = []
afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

function storeAtTemp() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'onair-csv-projects-'))
  dirs.push(dir)
  return createSettingsStore(dir)
}

const legacyMappings: MosMappingConfig = { version: 1, sections: [] }
const idFactory = () => { let id = 0; return () => `copy-${++id}` }

describe('OnAir CSV project settings', () => {
  it('accepts trimmed absolute drive, UNC, and POSIX directory paths', () => {
    const config = normalizeMosProjects(legacyMappings)
    const paths = [' C:\\PA\\Export  ', '\\\\server\\share\\OnAir', ' /mnt/pa/export ']
    for (const folderPath of paths) {
      const projects = { ...config, projects: config.projects.map(project => project.id === builtinTelejurnalProjectId ? { ...project, onAirCsv: { format: 'pa-csv' as const, folderPath } } : project) }
      const validated = validateMosProjects(projects)
      expect(validated.projects.find(project => project.id === builtinTelejurnalProjectId)?.onAirCsv?.folderPath).toBe(folderPath.trim())
    }
  })

  it('rejects missing, relative, NUL-containing, and unsupported source settings', () => {
    const config = normalizeMosProjects(legacyMappings)
    for (const onAirCsv of [
      { format: 'pa-csv', folderPath: '' },
      { format: 'pa-csv', folderPath: 'relative/folder' },
      { format: 'pa-csv', folderPath: 'C:relative\\folder' },
      { format: 'pa-csv', folderPath: '/valid/\0invalid' },
      { format: 'other', folderPath: '/valid' },
    ]) {
      const projects = { ...config, projects: config.projects.map(project => project.id === builtinTelejurnalProjectId ? { ...project, onAirCsv } : project) }
      expect(() => validateMosProjects(projects)).toThrow()
    }
  })

  it('keeps v2 projects without a CSV source backward compatible and preserves it on legacy mapping writes', () => {
    const store = storeAtTemp()
    const config = normalizeMosProjects(legacyMappings)
    expect(validateMosProjects(config).version).toBe(2)

    const configured = { ...config, projects: [
      ...config.projects.map(project => project.id === builtinTelejurnalProjectId ? { ...project, name: 'Telejurnal', onAirCsv: { format: 'pa-csv' as const, folderPath: 'C:\\PA\\Export' } } : project),
      { id: 'standalone-source', name: 'Before rename', kind: 'standalone' as const, mappings: legacyMappings, onAirCsv: { format: 'pa-csv' as const, folderPath: '/srv/pa/export' } },
    ] }
    store.setSetting('mosMappings', configured)
    const initialSaved = normalizeMosProjects(store.getSetting('mosMappings'))
    const renamedInput = { ...initialSaved, projects: initialSaved.projects.map(project => project.id === 'standalone-source' ? { ...project, name: 'After rename' } : project) }
    store.setSetting('mosMappings', renamedInput)
    const renamed = normalizeMosProjects(store.getSetting('mosMappings'))
    const legacyWrite: MosMappingConfig = { version: 1, sections: [{ id: 'new-section', name: 'Changed through legacy API', targets: [{ id: 'target', template: 'OUT' }], resumePlayDelayMs: 100, sources: [{ id: 'source', template: 'MOS', exitMode: 'manual-resume', durationSeconds: 6, fields: [] }] }] }
    store.setSetting('mosMappings', legacyWrite)
    const saved = normalizeMosProjects(store.getSetting('mosMappings'))

    expect(saved.projects.find(project => project.id === builtinTelejurnalProjectId)).toMatchObject({
      id: builtinTelejurnalProjectId,
      name: 'Telejurnal',
      onAirCsv: { format: 'pa-csv', folderPath: 'C:\\PA\\Export' },
      mappings: legacyWrite,
    })
    expect(renamed.projects.find(project => project.id === builtinTelejurnalProjectId)?.onAirCsv).toEqual({ format: 'pa-csv', folderPath: 'C:\\PA\\Export' })
    expect(renamed.projects.find(project => project.id === 'standalone-source')).toMatchObject({ id: 'standalone-source', name: 'After rename', onAirCsv: { format: 'pa-csv', folderPath: '/srv/pa/export' } })
  })

  it('copies the folder setting by value when duplicating a project', () => {
    const config = normalizeMosProjects(legacyMappings)
    const source = { ...config.projects.find(project => project.id === builtinTelejurnalProjectId)!, onAirCsv: { format: 'pa-csv' as const, folderPath: '/srv/pa/export' } }
    const copy = duplicateMosProject(source, 'Copy', idFactory())
    expect(copy.onAirCsv).toEqual(source.onAirCsv)
    expect(copy.onAirCsv).not.toBe(source.onAirCsv)
    if (copy.onAirCsv) copy.onAirCsv.folderPath = '/srv/other/export'
    expect(source.onAirCsv.folderPath).toBe('/srv/pa/export')
  })
})
