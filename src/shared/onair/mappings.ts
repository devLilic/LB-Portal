import type { MosMappingConfig } from '../settings/mosMappings'

export type OnAirGraphicKind = 'titles' | 'persons' | 'locations' | 'phones'
export type OnAirDefaultTemplates = Partial<Record<'locations' | 'phones', string>>

export interface OnAirGraphicFieldMapping {
  id: string
  sourceField: string
  targetFields: Record<string, string[]>
}

export interface OnAirGraphicMapping {
  id: string
  kind: OnAirGraphicKind
  sourceTemplate: string
  sectionId: string
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
    const value = values[field.sourceField] ?? ''
    for (const [targetId, destinationFields] of Object.entries(field.targetFields)) {
      const target = targetsById.get(targetId)
      if (!target) return { status: 'missing-template', kind, sourceTemplate: effectiveTemplate, sectionId: section.id, targetId }
      for (const destination of destinationFields) target.fields[destination] = value
    }
  }
  return { status: 'matched', sourceTemplate: effectiveTemplate, section: { id: section.id, name: section.name }, targets }
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
  return value === 'titles' || value === 'persons' || value === 'locations' || value === 'phones'
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
