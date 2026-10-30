import { parse } from 'csv-parse/sync'
import type {
  OnAirGroup,
  OnAirGroupKind,
  OnAirItemSource,
  OnAirLocation,
  OnAirPerson,
  OnAirPhone,
  OnAirTitle,
  OnAirWaitTitleLocation,
} from '../../../src/shared/onair/contracts'

export type OnAirCsvFileKind = 'titles' | 'persons' | 'locations' | 'phones' | 'wait_titles_locations'
export type OnAirCsvFileName = string

export class OnAirCsvError extends Error {
  constructor(readonly file: OnAirCsvFileName, message: string, readonly record?: number) {
    super(message)
    this.name = 'OnAirCsvError'
  }
}

export function parseOnAirCsvHeaders(file: OnAirCsvFileName, bytes: Uint8Array): string[] {
  let text: string
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { throw new OnAirCsvError(file, 'File is not valid UTF-8.') }
  try {
    const records = parse(text, { bom: true, delimiter: ';', skip_empty_lines: true, relax_quotes: false, record_delimiter: ['\r\n', '\n', '\r'], to_line: 1 }) as string[][]
    if (!records.length) throw new OnAirCsvError(file, 'CSV header row is missing.')
    return records[0]!.map(value => value.trim()).filter(Boolean)
  } catch (error) {
    if (error instanceof OnAirCsvError) throw error
    throw new OnAirCsvError(file, error instanceof Error ? error.message : 'CSV parsing failed.', 1)
  }
}

export interface CsvRow {
  file: OnAirCsvFileName
  values: string[]
  record: number
  line: number
}

const expectedHeaders: Record<OnAirCsvFileKind, string[]> = {
  titles: ['Nr', 'Titlu', 'Supratitlu', 'Template'],
  persons: ['Sectiune', 'Nume', 'Functie', 'Template'],
  locations: ['Locatie'],
  phones: ['Nume', 'Functie', 'Image'],
  wait_titles_locations: ['Titlu', 'Locatie', 'Template'],
}

const optionalTemplateHeaderFiles = new Set<OnAirCsvFileKind>(['locations', 'phones'])

export function parseOnAirCsvFile(file: OnAirCsvFileName, bytes: Uint8Array, configuredKind?: OnAirCsvFileKind, configuredColumns?: Record<string, string>): CsvRow[] {
  const kind = configuredKind ?? fileKind(file)
  if (!kind) throw new OnAirCsvError(file, 'Unsupported OnAir CSV file name.')
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new OnAirCsvError(file, 'File is not valid UTF-8.')
  }

  let parsed: Array<{ record: string[]; raw: string; info: { lines: number; records: number } }>
  try {
    parsed = parse(text, {
      bom: true,
      delimiter: ';',
      skip_empty_lines: true,
      relax_quotes: false,
      record_delimiter: ['\r\n', '\n', '\r'],
      info: true,
      raw: true,
    }) as unknown as Array<{ record: string[]; raw: string; info: { lines: number; records: number } }>
  } catch (error) {
    const row = typeof error === 'object' && error !== null && 'lines' in error && typeof error.lines === 'number' ? error.lines : undefined
    throw new OnAirCsvError(file, error instanceof Error ? error.message : 'CSV parsing failed.', row)
  }

  if (parsed.length === 0) throw new OnAirCsvError(file, 'CSV header row is missing.')
  const header = parsed[0].record
  const required = expectedHeaders[kind]
  const hasTemplateHeader = optionalTemplateHeaderFiles.has(kind) && header.length === required.length + 1 && required.every((cell, index) => cell === header[index]) && header.at(-1) === 'Template'
  const semanticFields = configuredColumns ? Object.keys(configuredColumns).filter(field => configuredColumns[field]?.trim()) : [...required, ...(hasTemplateHeader ? ['Template'] : [])]
  const requiredFields = configuredColumns ? required.filter(field => field !== 'Template') : required
  const columnIndexes = new Map<string, number>()
  for (const field of semanticFields) {
    const columnName = configuredColumns?.[field] ?? field
    const index = header.indexOf(columnName)
    if (index < 0 && requiredFields.includes(field)) throw new OnAirCsvError(file, `Expected column "${columnName}" for ${field}.`, 1)
    if (index >= 0) columnIndexes.set(field, index)
  }
  if (!configuredColumns && ((!hasTemplateHeader && header.length !== required.length) || required.some((cell, index) => cell !== header[index]))) throw new OnAirCsvError(file, `Expected header: ${required.join(';')}.`, 1)

  const rows: CsvRow[] = []
  let consumedLineBreaks = countNewlines(parsed[0].raw)
  for (const entry of parsed.slice(1)) {
    if (entry.record.length !== header.length) {
      throw new OnAirCsvError(file, `Expected ${header.length} columns, found ${entry.record.length}.`, entry.info.records)
    }
    const leadingBlankLines = entry.raw.match(/^(?:[ \t]*\r\n|[ \t]*\r|[ \t]*\n)+/)?.[0]
    const startLine = consumedLineBreaks + 1 + countNewlines(leadingBlankLines ?? '')
    const canonicalFields = [...required, ...(optionalTemplateHeaderFiles.has(kind) ? ['Template'] : [])]
    const values = canonicalFields.map(field => { const index = columnIndexes.get(field); return index === undefined ? '' : entry.record[index] ?? '' })
    rows.push({ file, values, record: entry.info.records, line: startLine })
    consumedLineBreaks += countNewlines(entry.raw)
  }
  return rows
}

function countNewlines(value: string): number {
  return value.match(/\r\n|\r|\n/g)?.length ?? 0
}

interface ParsedGroup {
  id: string
  name: string
  kind: OnAirGroupKind
  occurrence: number
  titles: OnAirTitle[]
  persons: OnAirPerson[]
  locations: OnAirLocation[]
  phones: OnAirPhone[]
  waitTitleLocations: OnAirWaitTitleLocation[]
}

export function assembleOnAirGroups(
  projectId: string,
  titlesRows: CsvRow[],
  personsRows: CsvRow[],
  locationsRows: CsvRow[],
  phonesRows: CsvRow[],
  waitTitleLocationsRows: CsvRow[] = [],
  _files: OnAirCsvFileName[] = [],
): OnAirGroup[] {
  const groups: ParsedGroup[] = []
  const indexesByKey = new Map<string, ParsedGroup>()

  const groupFor = (rawName: string, file: OnAirCsvFileName): ParsedGroup => {
    const cleanName = rawName.trim()
    const name = cleanName || 'Fără secțiune'
    const normalized = normalizeGroupName(name)
    const kind = getGroupKind(name)
    const occurrenceKey = file + ':' + normalized
    // A file can revisit a section marker, so each contiguous marker occurrence is distinct.
    const occurrence = (occurrenceCounts.get(occurrenceKey) ?? 0) + 1
    occurrenceCounts.set(occurrenceKey, occurrence)
    const key = `${normalized}#${occurrence}`
    const existing = indexesByKey.get(key)
    if (existing) return existing
    const created: ParsedGroup = {
      id: `${projectId}:${key}`,
      name,
      kind,
      occurrence,
      titles: [],
      persons: [],
      locations: [],
      phones: [],
      waitTitleLocations: [],
    }
    indexesByKey.set(key, created)
    groups.push(created)
    return created
  }

  const implicitGroupFor = (rawName: string, file: OnAirCsvFileName): ParsedGroup => {
    const cleanName = rawName.trim()
    const name = cleanName || 'Fără secțiune'
    const normalized = normalizeGroupName(name)
    const key = `${normalized}#1`
    const existing = indexesByKey.get(key)
    if (existing) return existing
    const created: ParsedGroup = {
      id: `${projectId}:${key}`,
      name,
      kind: getGroupKind(name),
      occurrence: 1,
      titles: [], persons: [], locations: [], phones: [], waitTitleLocations: [],
    }
    indexesByKey.set(key, created)
    groups.push(created)
    return created
  }

  const occurrenceCounts = new Map<string, number>()
  let activeTitleGroup: ParsedGroup | null = null
  let activeTitleFile: OnAirCsvFileName | null = null

  for (const row of titlesRows) {
    if (row.file !== activeTitleFile) { activeTitleFile = row.file; activeTitleGroup = null }
    if (isMarker(row.values[0])) {
      if (row.values.slice(1).some(value => value.trim() !== '')) throw new OnAirCsvError(row.file, 'Section marker rows must have empty remaining columns.', row.record)
      activeTitleGroup = groupFor(markerName(row.values[0]), row.file)
      continue
    }
    if (row.values.every(value => value.trim() === '')) continue
    if (!activeTitleGroup) {
      activeTitleGroup = implicitGroupFor('Fără secțiune', row.file)
    }
    const source = itemSource(row.file, row)
    const [nr, title, supratitle, template] = row.values
    activeTitleGroup.titles.push({ id: `${activeTitleGroup.id}:title:${row.file}:${row.record}`, source, nr, title, supratitle, template })
  }

  let activePersonsGroup: ParsedGroup | null = null
  let activePersonsFile: OnAirCsvFileName | null = null
  for (const row of personsRows) {
    if (row.file !== activePersonsFile) { activePersonsFile = row.file; activePersonsGroup = null }
    const [section, name, role, template] = row.values
    if (isMarker(section)) {
      if (row.values.slice(1).some(value => value.trim() !== '')) throw new OnAirCsvError(row.file, 'Section marker rows must have empty remaining columns.', row.record)
      activePersonsGroup = groupFor(markerName(section), row.file)
      continue
    }
    if (row.values.every(value => value.trim() === '')) continue
    const group = activePersonsGroup ?? implicitGroupFor('Fără secțiune', row.file)
    const source = itemSource(row.file, row)
    group.persons.push({ id: `${group.id}:person:${row.file}:${row.record}`, source, name, role, template })
  }

  const invitedGroup = () => {
    const key = 'invited#1'
    const existing = indexesByKey.get(key)
    if (existing) return existing
    const created: ParsedGroup = { id: `${projectId}:${key}`, name: 'INVITATI', kind: 'invited', occurrence: 1, titles: [], persons: [], locations: [], phones: [], waitTitleLocations: [] }
    indexesByKey.set(key, created)
    groups.push(created)
    return created
  }

  for (const row of locationsRows) {
    if (row.values.every(value => value.trim() === '')) continue
    const [location, template] = row.values
    const group = invitedGroup()
    const source = itemSource(row.file, row)
    group.locations.push({ id: `${group.id}:location:${row.file}:${row.record}`, source, location, template })
  }

  for (const row of phonesRows) {
    if (row.values.every(value => value.trim() === '')) continue
    const [name, role, imagePath, template] = row.values
    const group = invitedGroup()
    const source = itemSource(row.file, row)
    group.phones.push({ id: `${group.id}:phone:${row.file}:${row.record}`, source, name, role, imagePath, template })
  }

  for (const row of waitTitleLocationsRows) {
    if (row.values.every(value => value.trim() === '')) continue
    const [title, location, template] = row.values
    const group = invitedGroup()
    const source = itemSource(row.file, row)
    group.waitTitleLocations.push({ id: `${group.id}:wait-title-location:${row.file}:${row.record}`, source, title, location, template })
  }

  return groups.map(({ id, name, kind, titles, persons, locations, phones, waitTitleLocations }) => ({ id, name, kind, titles, persons, locations, phones, waitTitleLocations }))
}

function itemSource(file: OnAirCsvFileName, row: CsvRow): OnAirItemSource {
  return { file, record: row.record, line: row.line }
}

function fileKind(file: string): OnAirCsvFileKind | null {
  const match = file.match(/_(titles|persons|locations|phones|wait_titles_locations)\.csv$/i)
  return (match?.[1]?.toLowerCase() as OnAirCsvFileKind | undefined) ?? null
}

function isMarker(value: string): boolean {
  return /^\s*---\s*.*?\s*---\s*$/.test(value)
}

function markerName(value: string): string {
  return value.trim().replace(/^---\s*/, '').replace(/\s*---$/, '').trim()
}

function normalizeGroupName(value: string): string {
  const normalized = value.trim().toLocaleLowerCase('ro-RO').replace(/\s+/g, ' ')
  if (normalized === 'fără secțiune') return 'ungrouped'
  if (normalized === 'invitati' || normalized === 'invitați') return 'invited'
  return normalized
}

function getGroupKind(value: string): OnAirGroupKind {
  const normalized = normalizeGroupName(value)
  if (normalized.startsWith('beta ')) return 'beta'
  if (normalized === 'invited') return 'invited'
  if (normalized === 'ungrouped') return 'ungrouped'
  return 'other'
}
