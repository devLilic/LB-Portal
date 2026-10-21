import { parse } from 'csv-parse/sync'
import type {
  OnAirGroup,
  OnAirGroupKind,
  OnAirItemSource,
  OnAirLocation,
  OnAirPerson,
  OnAirPhone,
  OnAirTitle,
} from '../../../src/shared/onair/contracts'

export type OnAirCsvFileName = 'PA_titles.csv' | 'PA_persons.csv' | 'PA_locations.csv' | 'PA_phones.csv'

export class OnAirCsvError extends Error {
  constructor(readonly file: OnAirCsvFileName, message: string, readonly record?: number) {
    super(message)
    this.name = 'OnAirCsvError'
  }
}

interface CsvRow {
  values: string[]
  record: number
  line: number
}

const expectedHeaders: Record<OnAirCsvFileName, string[]> = {
  'PA_titles.csv': ['Nr', 'Titlu', 'Supratitlu', 'Template'],
  'PA_persons.csv': ['Sectiune', 'Nume', 'Functie', 'Template'],
  'PA_locations.csv': ['Locatie'],
  'PA_phones.csv': ['Nume', 'Functie', 'Image'],
}

const optionalTemplateHeaderFiles = new Set<OnAirCsvFileName>(['PA_locations.csv', 'PA_phones.csv'])

export function parseOnAirCsvFile(file: OnAirCsvFileName, bytes: Uint8Array): CsvRow[] {
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
  const required = expectedHeaders[file]
  const hasTemplateHeader = optionalTemplateHeaderFiles.has(file)
    && header.length === required.length + 1
    && required.every((cell, index) => cell === header[index])
    && header.at(-1) === 'Template'
  if ((!hasTemplateHeader && header.length !== required.length) || required.some((cell, index) => cell !== header[index])) {
    throw new OnAirCsvError(file, `Expected header: ${required.join(';')}.`, 1)
  }

  const rows: CsvRow[] = []
  let consumedLineBreaks = countNewlines(parsed[0].raw)
  for (const entry of parsed.slice(1)) {
    if (entry.record.length !== header.length) {
      throw new OnAirCsvError(file, `Expected ${header.length} columns, found ${entry.record.length}.`, entry.info.records)
    }
    const leadingBlankLines = entry.raw.match(/^(?:[ \t]*\r\n|[ \t]*\r|[ \t]*\n)+/)?.[0]
    const startLine = consumedLineBreaks + 1 + countNewlines(leadingBlankLines ?? '')
    const values = optionalTemplateHeaderFiles.has(file) && !hasTemplateHeader ? [...entry.record, ''] : entry.record
    rows.push({ values, record: entry.info.records, line: startLine })
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
}

export function assembleOnAirGroups(
  projectId: string,
  titlesRows: CsvRow[],
  personsRows: CsvRow[],
  locationsRows: CsvRow[],
  phonesRows: CsvRow[],
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
      titles: [], persons: [], locations: [], phones: [],
    }
    indexesByKey.set(key, created)
    groups.push(created)
    return created
  }

  const occurrenceCounts = new Map<string, number>()
  let activeTitleGroup: ParsedGroup | null = null

  for (const row of titlesRows) {
    if (isMarker(row.values[0])) {
      if (row.values.slice(1).some(value => value.trim() !== '')) throw new OnAirCsvError('PA_titles.csv', 'Section marker rows must have empty remaining columns.', row.record)
      activeTitleGroup = groupFor(markerName(row.values[0]), 'PA_titles.csv')
      continue
    }
    if (row.values.every(value => value.trim() === '')) continue
    if (!activeTitleGroup) {
      activeTitleGroup = implicitGroupFor('Fără secțiune', 'PA_titles.csv')
    }
    const source = itemSource('PA_titles.csv', row)
    const [nr, title, supratitle, template] = row.values
    activeTitleGroup.titles.push({ id: `${activeTitleGroup.id}:title:${row.record}`, source, nr, title, supratitle, template })
  }

  let activePersonsGroup: ParsedGroup | null = null
  for (const row of personsRows) {
    const [section, name, role, template] = row.values
    if (isMarker(section)) {
      if (row.values.slice(1).some(value => value.trim() !== '')) throw new OnAirCsvError('PA_persons.csv', 'Section marker rows must have empty remaining columns.', row.record)
      activePersonsGroup = groupFor(markerName(section), 'PA_persons.csv')
      continue
    }
    if (row.values.every(value => value.trim() === '')) continue
    const group = activePersonsGroup ?? implicitGroupFor('Fără secțiune', 'PA_persons.csv')
    const source = itemSource('PA_persons.csv', row)
    group.persons.push({ id: `${group.id}:person:${row.record}`, source, name, role, template })
  }

  const invitedGroup = () => {
    const key = 'invited#1'
    const existing = indexesByKey.get(key)
    if (existing) return existing
    const created: ParsedGroup = { id: `${projectId}:${key}`, name: 'INVITATI', kind: 'invited', occurrence: 1, titles: [], persons: [], locations: [], phones: [] }
    indexesByKey.set(key, created)
    groups.push(created)
    return created
  }

  for (const row of locationsRows) {
    if (row.values.every(value => value.trim() === '')) continue
    const [location, template] = row.values
    const group = invitedGroup()
    const source = itemSource('PA_locations.csv', row)
    group.locations.push({ id: `${group.id}:location:${row.record}`, source, location, template })
  }

  for (const row of phonesRows) {
    if (row.values.every(value => value.trim() === '')) continue
    const [name, role, imagePath, template] = row.values
    const group = invitedGroup()
    const source = itemSource('PA_phones.csv', row)
    group.phones.push({ id: `${group.id}:phone:${row.record}`, source, name, role, imagePath, template })
  }

  return groups.map(({ id, name, kind, titles, persons, locations, phones }) => ({ id, name, kind, titles, persons, locations, phones }))
}

function itemSource(file: OnAirCsvFileName, row: CsvRow): OnAirItemSource {
  return { file, record: row.record, line: row.line }
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
