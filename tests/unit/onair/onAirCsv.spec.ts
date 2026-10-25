import { mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { createOnAirCsvService } from '../../../electron/main/onair/onAirCsvService'
import { assembleOnAirGroups, OnAirCsvError, parseOnAirCsvFile } from '../../../electron/main/onair/parseOnAirCsv'
import type { OnAirCsvFileName } from '../../../electron/main/onair/parseOnAirCsv'
import type { MosProjectsConfig } from '../../../src/shared/settings/mosProjects'

const tempDirs: string[] = []
const services: ReturnType<typeof createOnAirCsvService>[] = []
const names: OnAirCsvFileName[] = ['PA_titles.csv', 'PA_persons.csv', 'PA_locations.csv', 'PA_phones.csv']
const telejurnalProjectId = 'test-telejurnal-csv'
const retrospectivaProjectId = 'test-retrospectiva-csv'

afterEach(() => {
  while (services.length) services.pop()!.dispose()
  while (tempDirs.length) rmSync(tempDirs.pop()!, { recursive: true, force: true })
})

function makeService(settingsDir: string, store: ReturnType<typeof createSettingsStore>, dependencies?: Parameters<typeof createOnAirCsvService>[2]) {
  const service = createOnAirCsvService(store, settingsDir, dependencies)
  services.push(service)
  return service
}

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'onair-csv-'))
  tempDirs.push(root)
  const settingsDir = path.join(root, 'settings')
  const folder = path.join(root, 'csv')
  const otherFolder = path.join(root, 'other')
  const store = createSettingsStore(settingsDir)
  writeFixture(folder, {
    'PA_titles.csv': 'Nr;Titlu;Supratitlu;Template\n--- beta 1 - Nato ---;;;\n1;Titlu A;Supra;T-A\n--- INVITATI ---;;;\n2;Titlu B;;T-B\n',
    'PA_persons.csv': 'Sectiune;Nume;Functie;Template\n--- beta 1 - Nato ---;;;\n;Persoana;Rol;P-A\n--- Grup nou ---;;;\n;Persoana doar aici;Editor;P-B\n',
    'PA_locations.csv': 'Locatie\nChișinău\n',
    'PA_phones.csv': 'Nume;Functie;Image\nTelefon;Reporter;C:\\img\\a.jpg\n',
  })
  writeFixture(otherFolder, {
    'PA_titles.csv': 'Nr;Titlu;Supratitlu;Template\n9;Alt;Supra;T\n',
    'PA_persons.csv': 'Sectiune;Nume;Functie;Template\n;Alt persoana;Rol;P\n',
    'PA_locations.csv': 'Locatie\n',
    'PA_phones.csv': 'Nume;Functie;Image\n',
  })
  const config: MosProjectsConfig = {
    version: 2,
    activeProjectId: telejurnalProjectId,
    projects: [
      { id: telejurnalProjectId, name: 'Telejurnal test', kind: 'standalone', mode: 'csv', mappings: { version: 1, sections: [] }, onAirCsv: { format: 'pa-csv', folderPath: folder } },
      { id: retrospectivaProjectId, name: 'Retrospectiva test', kind: 'standalone', mode: 'csv', mappings: { version: 1, sections: [] }, onAirCsv: { format: 'pa-csv', folderPath: otherFolder } },
    ],
  }
  store.setSetting('mosMappings', config)
  return { root, settingsDir, folder, otherFolder, store }
}

function writeFixture(folder: string, contents: Partial<Record<OnAirCsvFileName, string>>) {
  mkdirSync(folder, { recursive: true })
  for (const name of names) if (contents[name] !== undefined) writeFileSync(path.join(folder, name), contents[name]!, 'utf8')
}

function configureFolder(config: MosProjectsConfig, projectId: string, folderPath: string): MosProjectsConfig {
  return {
    ...config,
    projects: config.projects.map(project => project.id === projectId ? { ...project, onAirCsv: { format: 'pa-csv', folderPath } } : project),
  }
}

describe('OnAir PA CSV parsing', () => {
  it('accepts BOM, quoted semicolons, escaped quotes, multiline values, and retains value whitespace/order', () => {
    const csv = '\uFEFFNr;Titlu;Supratitlu;Template\r\n1;"A; B";"say ""hello""\r\nagain"; T  \r\n'
    const rows = parseOnAirCsvFile('PA_titles.csv', Buffer.from(csv, 'utf8'))
    expect(rows).toEqual([{ values: ['1', 'A; B', 'say "hello"\r\nagain', ' T  '], record: 2, line: 2 }])
  })

  it('accepts headers-only files and reports a missing or malformed header with file and record', () => {
    expect(parseOnAirCsvFile('PA_phones.csv', Buffer.from('Nume;Functie;Image\n'))).toEqual([])
    expect(() => parseOnAirCsvFile('PA_titles.csv', Buffer.from('Nr;Titlu;Template\n'))).toThrowError(OnAirCsvError)
  })

  it('retains optional Location and Phone templates and supplies empty values for older CSV headers', () => {
    const oldLocations = parseOnAirCsvFile('PA_locations.csv', Buffer.from('Locatie\nChișinău\n'))
    const newLocations = parseOnAirCsvFile('PA_locations.csv', Buffer.from('Locatie;Template\nChișinău;03_Locatie\n'))
    const oldPhones = parseOnAirCsvFile('PA_phones.csv', Buffer.from('Nume;Functie;Image\nTelefon;Reporter;C:\\img\\a.jpg\n'))
    const newPhones = parseOnAirCsvFile('PA_phones.csv', Buffer.from('Nume;Functie;Image;Template\nTelefon;Reporter;C:\\img\\a.jpg;04_Telefon\n'))
    expect(oldLocations[0]?.values).toEqual(['Chișinău', ''])
    expect(newLocations[0]?.values).toEqual(['Chișinău', '03_Locatie'])
    expect(oldPhones[0]?.values).toEqual(['Telefon', 'Reporter', 'C:\\img\\a.jpg', ''])
    expect(newPhones[0]?.values).toEqual(['Telefon', 'Reporter', 'C:\\img\\a.jpg', '04_Telefon'])
  })

  it('records physical source lines across blank rows and multiline values', () => {
    const csv = 'Nr;Titlu;Supratitlu;Template\r\n\r\n1;"Prima\r\na doua";;T\r\n'
    const row = parseOnAirCsvFile('PA_titles.csv', Buffer.from(csv))[0]
    expect(row).toMatchObject({ record: 2, line: 3, values: ['1', 'Prima\r\na doua', '', 'T'] })
  })

  it('groups by section markers, keeps persons-only groups after title groups, and routes invite data to INVITATI', () => {
    const titleRows = parseOnAirCsvFile('PA_titles.csv', Buffer.from('Nr;Titlu;Supratitlu;Template\n--- beta 1 ---;;;\n1;A;;T\n--- INVITATI ---;;;\n2;B;;T\n'))
    const personRows = parseOnAirCsvFile('PA_persons.csv', Buffer.from('Sectiune;Nume;Functie;Template\n--- beta 1 ---;;;\n;P;R;T\n--- Numai persoane ---;;;\n;Q;R;T\n'))
    const locations = parseOnAirCsvFile('PA_locations.csv', Buffer.from('Locatie\nCHIȘINĂU\n'))
    const phones = parseOnAirCsvFile('PA_phones.csv', Buffer.from('Nume;Functie;Image\nTelefon;Rol;C:\\i.jpg\n'))
    const groups = assembleOnAirGroups('p', titleRows, personRows, locations, phones)
    expect(groups.map(group => group.name)).toEqual(['beta 1', 'INVITATI', 'Numai persoane'])
    expect(groups[0]?.persons[0]?.name).toBe('P')
    expect(groups[2]?.persons[0]?.name).toBe('Q')
    expect(groups[1]).toMatchObject({ kind: 'invited', locations: [{ location: 'CHIȘINĂU' }], phones: [{ name: 'Telefon' }] })
    expect(groups[0]?.titles[0]?.source).toEqual({ file: 'PA_titles.csv', record: 3, line: 3 })
  })

  it('keeps repeated marker occurrences distinct and rejects data hidden on a marker row', () => {
    const titles = parseOnAirCsvFile('PA_titles.csv', Buffer.from('Nr;Titlu;Supratitlu;Template\n--- beta 1 ---;;;\n1;A;;T\n--- beta 1 ---;;;\n2;B;;T\n'))
    const groups = assembleOnAirGroups('p', titles, [], [], [])
    expect(groups).toHaveLength(2)
    expect(groups[0]?.titles[0]?.title).toBe('A')
    expect(groups[1]?.titles[0]?.title).toBe('B')
    const malformed = parseOnAirCsvFile('PA_titles.csv', Buffer.from('Nr;Titlu;Supratitlu;Template\n--- beta 1 ---;hidden;;\n'))
    expect(() => assembleOnAirGroups('p', malformed, [], [], [])).toThrow(/empty remaining columns/)
  })
})

describe('OnAir PA CSV service', () => {
  it('isolates project snapshots and keeps the last good snapshot after a bad refresh', async () => {
    const { folder, store } = fixture()
    const service = makeService(path.join(path.dirname(folder), 'settings'), store)
    const first = await service.refresh(telejurnalProjectId)
    const second = await service.refresh(retrospectivaProjectId)
    expect(first.snapshot?.groups[0]?.titles[0]?.title).toBe('Titlu A')
    expect(second.snapshot?.groups[0]?.titles[0]?.title).toBe('Alt')
    expect(service.getSnapshot(telejurnalProjectId).snapshot?.projectId).toBe(telejurnalProjectId)

    writeFileSync(path.join(folder, 'PA_titles.csv'), 'bad;header\n', 'utf8')
    const failed = await service.refresh(telejurnalProjectId)
    expect(failed.error?.code).toBe('INVALID_CSV')
    expect(failed.snapshot?.groups[0]?.titles[0]?.title).toBe('Titlu A')
    expect(service.getSnapshot(retrospectivaProjectId).snapshot?.groups[0]?.titles[0]?.title).toBe('Alt')
  })

  it('reports missing files and configured source changes without reading at startup', async () => {
    const { folder, otherFolder, store } = fixture()
    const service = makeService(path.join(path.dirname(folder), 'settings'), store)
    const titlePath = path.join(folder, 'PA_titles.csv')
    const titles = readFileSync(titlePath)
    unlinkSync(titlePath)
    expect(service.getSnapshot(telejurnalProjectId).snapshot).toBeNull()
    expect(await service.refresh(telejurnalProjectId)).toMatchObject({ error: { code: 'READ_FAILED', file: 'PA_titles.csv' } })

    writeFileSync(titlePath, titles)
    const loaded = await service.refresh(telejurnalProjectId)
    expect(loaded.snapshot).not.toBeNull()
    store.setSetting('mosMappings', configureFolder(store.getSetting('mosMappings') as MosProjectsConfig, telejurnalProjectId, otherFolder))
    expect(service.getSnapshot(telejurnalProjectId)).toMatchObject({ snapshot: null, error: { code: 'SOURCE_CHANGED' } })
  })

  it('rejects an A to B to A settings change while the original source is being read', async () => {
    const { folder, otherFolder, store } = fixture()
    const fs = await import('node:fs')
    let flipped = false
    const service = makeService(path.join(path.dirname(folder), 'settings'), store, {
      stat: async filePath => fs.statSync(filePath),
      readFile: async filePath => {
        const content = readFileSync(filePath)
        if (!flipped) {
          flipped = true
          const config = store.getSetting('mosMappings') as MosProjectsConfig
          store.setSetting('mosMappings', configureFolder(config, telejurnalProjectId, otherFolder))
          store.setSetting('mosMappings', configureFolder(store.getSetting('mosMappings') as MosProjectsConfig, telejurnalProjectId, folder))
        }
        return content
      },
    })
    const result = await service.refresh(telejurnalProjectId)
    expect(result.error?.code).toBe('SOURCE_CHANGED')
    expect(result.snapshot).toBeNull()
  })

  it('retries a batch when one CSV changes during the read', async () => {
    const { folder, store } = fixture()
    const fs = await import('node:fs')
    let changed = false
    const service = makeService(path.join(path.dirname(folder), 'settings'), store, {
      stat: async filePath => fs.statSync(filePath),
      readFile: async filePath => {
        const content = readFileSync(filePath)
        if (!changed && path.basename(filePath) === 'PA_titles.csv') {
          changed = true
          writeFileSync(filePath, 'Nr;Titlu;Supratitlu;Template\n8;Updated;;T\n', 'utf8')
        }
        return content
      },
    })
    const result = await service.refresh(telejurnalProjectId)
    expect(result.error).toBeNull()
    expect(result.snapshot?.groups[0]?.titles[0]?.title).toBe('Updated')
  })

  it('coalesces concurrent refreshes for the same project', async () => {
    const { folder, store } = fixture()
    let beginRead!: () => void
    let releaseRead!: () => void
    const started = new Promise<void>(resolve => { beginRead = resolve })
    const gate = new Promise<void>(resolve => { releaseRead = resolve })
    let reads = 0
    const fs = await import('node:fs')
    const service = makeService(path.join(path.dirname(folder), 'settings'), store, {
      stat: async filePath => fs.statSync(filePath),
      readFile: async filePath => {
        reads += 1
        if (reads === 1) {
          beginRead()
          await gate
        }
        return readFileSync(filePath)
      },
    })
    const first = service.refresh(telejurnalProjectId)
    await started
    const second = service.refresh(telejurnalProjectId)
    expect(second).toBe(first)
    releaseRead()
    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult.snapshot).not.toBeNull()
    expect(secondResult.snapshot).toEqual(firstResult.snapshot)
    expect(reads).toBe(4)
    expect(firstResult.busy).toBe(false)
  })
})
