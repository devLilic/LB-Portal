import type { MosMappingConfig } from '../settings/mosMappings'

export type OnAirGraphicKind = 'titles' | 'persons' | 'locations' | 'phones' | 'waitTitlesLocations'
export type OnAirDefaultTemplates = Partial<Record<'locations' | 'phones', string>>

export interface OnAirGraphicFieldMapping {
  id: string
  sourceField: string
  /** Optional second CSV value composed into the same destination value. */
  sourceField2?: string
  /** Defaults to a comma and space when sourceField2 is configured. */
  separator?: string
  targetFields: Record<string, string[]>
}

export interface OnAirGraphicMapping {
  id: string
  kind: OnAirGraphicKind
  sourceTemplate: string
  sectionId: string
  exitMode?: 'manual-resume' | 'template-duration'
  durationSeconds?: number
  fields: OnAirGraphicFieldMapping[]
}

export interface OnAirGraphicMappingIssue {
  code: string
  path: string
}

export const onAirSourceFields: Record<OnAirGraphicKind, readonly string[]> = {
  titles: ['Titlu', 'Supratitlu'],
  persons: ['Nume', 'Functie'],
  locations: ['Locatie'],
  phones: ['Nume', 'Functie', 'Image'],
  waitTitlesLocations: ['Titlu', 'Locatie'],
}

export function getOnAirEffectiveTemplate(
  kind: OnAirGraphicKind,
  sourceTemplate: string,
  defaults?: OnAirDefaultTemplates,
): string {
  if (typeof sourceTemplate === 'string' && sourceTemplate.trim()) return sourceTemplate
  if (kind !== 'locations' && kind !== 'phones') return ''
  const configuredDefault = defaults?.[kind]
  return typeof configuredDefault === 'string' ? configuredDefault.trim() : ''
}

export type OnAirGraphicResolution =
  | {
      status: 'matched'
      sourceTemplate: string
      section: { id: string; name: string }
      exitMode: 'manual-resume' | 'template-duration'
      durationSeconds: number
      targets: Array<{ id: string; template: string; fields: Record<string, string> }>
    }
  | { status: 'unmapped'; kind: OnAirGraphicKind; sourceTemplate: string }
  | { status: 'missing-template'; kind: OnAirGraphicKind; sourceTemplate: string; sectionId?: string; targetId?: string }

export function getOnAirMappingIssues(value: unknown, mappings: MosMappingConfig): OnAirGraphicMappingIssue[] {
  const issues: OnAirGraphicMappingIssue[] = []
  const issue = (code: string, path: string) => issues.push({ code, path })
  if (!Array.isArray(value)) return [{ code: 'invalidStructure', path: 'onAirMappings' }]

  const sectionById = new Map(mappings.sections.map(section => [section.id, section]))
  const ids = new Set<string>()
  const sourceKeys = new Set<string>()
  value.forEach((rawMapping: unknown, mappingIndex: number) => {
    const base = `onAirMappings[${mappingIndex}]`
    if (!isRecord(rawMapping) || !Array.isArray(rawMapping.fields)) {
      issue('invalidStructure', base)
      return
    }
    const mapping = rawMapping
    addId(mapping.id, `${base}.id`, ids, issue)
    const kind = isOnAirGraphicKind(mapping.kind) ? mapping.kind : null
    if (!kind) issue('invalidKind', `${base}.kind`)
    if (typeof mapping.sourceTemplate !== 'string' || !mapping.sourceTemplate.trim()) issue('required', `${base}.sourceTemplate`)
    if (mapping.exitMode !== undefined && mapping.exitMode !== 'manual-resume' && mapping.exitMode !== 'template-duration') issue('invalidExitMode', `${base}.exitMode`)
    if (mapping.durationSeconds !== undefined && (typeof mapping.durationSeconds !== 'number' || !Number.isFinite(mapping.durationSeconds) || mapping.durationSeconds <= 0 || mapping.durationSeconds > 86400)) issue('invalidDuration', `${base}.durationSeconds`)
    const key = `${String(mapping.kind)}\0${String(mapping.sourceTemplate)}`
    if (sourceKeys.has(key)) issue('duplicateSource', `${base}.sourceTemplate`)
    sourceKeys.add(key)

    const section = typeof mapping.sectionId === 'string' ? sectionById.get(mapping.sectionId) : undefined
    if (typeof mapping.sectionId !== 'string' || !section) issue('invalidSection', `${base}.sectionId`)
    const targetIds = new Set(section?.targets.map(target => target.id) ?? [])
    const usedDestinations = new Map<string, Set<string>>()

    mapping.fields.forEach((rawField: unknown, fieldIndex: number) => {
      const fieldPath = `${base}.fields[${fieldIndex}]`
      if (!isRecord(rawField) || !isRecord(rawField.targetFields)) {
        issue('invalidStructure', fieldPath)
        return
      }
      const field = rawField
      addId(field.id, `${fieldPath}.id`, ids, issue)
      if (typeof field.sourceField !== 'string' || !field.sourceField.trim()) issue('required', `${fieldPath}.sourceField`)
      else if (kind && !onAirSourceFields[kind].includes(field.sourceField)) issue('invalidSourceField', `${fieldPath}.sourceField`)
      if (field.sourceField2 !== undefined) {
        if (typeof field.sourceField2 !== 'string' || !field.sourceField2.trim()) issue('invalidSourceField', `${fieldPath}.sourceField2`)
        else if (kind && !onAirSourceFields[kind].includes(field.sourceField2)) issue('invalidSourceField', `${fieldPath}.sourceField2`)
        else if (field.sourceField2 === field.sourceField) issue('duplicateSourceField', `${fieldPath}.sourceField2`)
      }
      if (field.separator !== undefined && typeof field.separator !== 'string') issue('invalidSeparator', `${fieldPath}.separator`)

      const targetFields = field.targetFields as Record<string, unknown>
      for (const [targetId, rawDestinations] of Object.entries(targetFields)) {
        if (!targetIds.has(targetId)) {
          issue('invalidTarget', `${fieldPath}.targetFields.${targetId}`)
          continue
        }
        if (!Array.isArray(rawDestinations) || rawDestinations.length === 0 || rawDestinations.some(destination => typeof destination !== 'string' || !destination.trim())) {
          issue('invalidTargetFields', `${fieldPath}.targetFields.${targetId}`)
          continue
        }
        let destinations = usedDestinations.get(targetId)
        if (!destinations) {
          destinations = new Set<string>()
          usedDestinations.set(targetId, destinations)
        }
        for (const destination of rawDestinations as string[]) {
          if (destinations.has(destination)) issue('duplicateTargetField', `${fieldPath}.targetFields.${targetId}`)
          destinations.add(destination)
        }
      }
    })
  })
  return issues
}

export function validateOnAirMappings(value: unknown, mappings: MosMappingConfig): OnAirGraphicMapping[] {
  const issues = getOnAirMappingIssues(value, mappings)
  if (issues.length) throw new Error(`Invalid OnAir mappings: ${issues.map(({ code, path }) => `${code} at ${path}`).join(', ')}`)
  return (value as OnAirGraphicMapping[]).map(mapping => ({
    ...mapping,
    exitMode: mapping.exitMode ?? 'manual-resume',
    durationSeconds: mapping.durationSeconds ?? 6,
    fields: mapping.fields.map(field => ({
      ...field,
      targetFields: Object.fromEntries(Object.entries(field.targetFields).map(([targetId, destinations]) => [targetId, [...destinations]])),
    })),
  }))
}

export function resolveOnAirGraphic(
  kind: OnAirGraphicKind,
  sourceTemplate: string,
  values: Record<string, string>,
  project: { mappings: MosMappingConfig; onAirMappings?: OnAirGraphicMapping[]; onAirDefaultTemplates?: OnAirDefaultTemplates },
): OnAirGraphicResolution {
  const effectiveTemplate = getOnAirEffectiveTemplate(kind, sourceTemplate, project.onAirDefaultTemplates)
  if (!effectiveTemplate) return { status: 'missing-template', kind, sourceTemplate: effectiveTemplate }
  const graphicMapping = project.onAirMappings?.find(mapping => mapping.kind === kind && mapping.sourceTemplate === effectiveTemplate)
  if (!graphicMapping) return { status: 'unmapped', kind, sourceTemplate: effectiveTemplate }

  const section = project.mappings.sections.find(candidate => candidate.id === graphicMapping.sectionId)
  if (!section) return { status: 'missing-template', kind, sourceTemplate: effectiveTemplate, sectionId: graphicMapping.sectionId }
  const targets = section.targets.map(target => ({ id: target.id, template: target.template, fields: {} as Record<string, string> }))
  const targetsById = new Map(targets.map(target => [target.id, target]))
  for (const field of graphicMapping.fields) {
    const primary = values[field.sourceField] ?? ''
    const secondary = field.sourceField2 ? values[field.sourceField2] ?? '' : ''
    const value = field.sourceField2
      ? primary && secondary
        ? `${primary}${field.separator ?? ', '}${secondary}`
        : primary || secondary
      : primary
    for (const [targetId, destinationFields] of Object.entries(field.targetFields)) {
      const target = targetsById.get(targetId)
      if (!target) return { status: 'missing-template', kind, sourceTemplate: effectiveTemplate, sectionId: section.id, targetId }
      for (const destination of destinationFields) target.fields[destination] = value
    }
  }
  return { status: 'matched', sourceTemplate: effectiveTemplate, section: { id: section.id, name: section.name }, exitMode: graphicMapping.exitMode ?? 'manual-resume', durationSeconds: graphicMapping.durationSeconds ?? 6, targets }
}

function addId(value: unknown, path: string, ids: Set<string>, issue: (code: string, path: string) => void) {
  if (typeof value !== 'string' || !value.trim()) {
    issue('required', path)
    return
  }
  if (ids.has(value)) issue('duplicateId', path)
  ids.add(value)
}

function isOnAirGraphicKind(value: unknown): value is OnAirGraphicKind {
  return value === 'titles' || value === 'persons' || value === 'locations' || value === 'phones' || value === 'waitTitlesLocations'
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
