import { emptyMosMappingConfig, validateMosMappings, type MosMappingConfig } from './mosMappings'
import { validateMosInteractions, type MosInteractionRule } from './mosInteractions'
import type { OnAirCsvSource } from '../onair/contracts'
import { validateOnAirMappings, type OnAirGraphicMapping } from '../onair/mappings'

export const builtinTelejurnalProjectId = 'builtin-telejurnal'
export const builtinRetrospectivaProjectId = 'builtin-retrospectiva'

export type MosProjectKind = 'telejurnal' | 'retrospectiva' | 'standalone'
export type MosProjectMode = 'plasma' | 'csv'
export interface MosStaticGraphicField {
  id: string
  label: string
  value: string
  targetFields: Record<string, string[]>
}
export interface MosStaticGraphic {
  id: string
  name: string
  sectionId: string
  exitMode: 'manual-resume' | 'template-duration'
  durationSeconds: number
  fields: MosStaticGraphicField[]
}
export interface MosProject {
  id: string
  name: string
  kind: MosProjectKind
  /** Plasma projects receive the shared plasma.test ingress; CSV projects use the local OnAir CSV workspace. */
  mode?: MosProjectMode
  mappings: MosMappingConfig
  interactions?: MosInteractionRule[]
  onAirCsv?: OnAirCsvSource
  onAirMappings?: OnAirGraphicMapping[]
  staticGraphics?: MosStaticGraphic[]
}
export interface MosProjectsConfig {
  version: 2
  activeProjectId: string
  projects: MosProject[]
}

export type MosMappingSettings = MosMappingConfig | MosProjectsConfig

export const defaultMosProjects = (initialMappings?: MosMappingConfig): MosProjectsConfig => {
  if (initialMappings === undefined) return { version: 2, activeProjectId: '', projects: [] }
  const id = 'migrated-legacy-project'
  return { version: 2, activeProjectId: id, projects: [{ id, name: 'Proiect migrat', kind: 'standalone', mode: 'plasma', mappings: initialMappings }] }
}

export function validateMosProjects(value: unknown): MosProjectsConfig {
  if (!isRecord(value) || value.version !== 2 || typeof value.activeProjectId !== 'string' || !Array.isArray(value.projects)) {
    throw new Error('Invalid MOS projects configuration.')
  }
  const ids = new Set<string>()
  const projects = value.projects.map((raw, index): MosProject => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string' || !raw.name.trim()) {
      throw new Error(`Invalid MOS project at projects[${index}].`)
    }
    if (ids.has(raw.id)) throw new Error(`Duplicate MOS project id: ${raw.id}`)
    ids.add(raw.id)
    if (raw.kind !== 'standalone' && raw.kind !== 'telejurnal' && raw.kind !== 'retrospectiva') throw new Error('Invalid MOS project kind.')
    // Old v2 settings used fixed kinds and IDs for Telejurnal and Retrospectiva.
    // Normalize them into ordinary editable projects while preserving their data.
    const kind: MosProjectKind = 'standalone'
    const wasLegacyBuiltin = raw.id === builtinTelejurnalProjectId || raw.id === builtinRetrospectivaProjectId || raw.kind === 'telejurnal' || raw.kind === 'retrospectiva'
    const mode: MosProjectMode = raw.mode === undefined ? wasLegacyBuiltin ? 'plasma' : 'csv' : raw.mode as MosProjectMode
    if (mode !== 'plasma' && mode !== 'csv') throw new Error('Invalid MOS project mode.')
    const mappings = validateMosMappings(raw.mappings, { allowEmptySources: true })
    const onAirCsv = raw.onAirCsv === undefined ? undefined : validateOnAirCsvSource(raw.onAirCsv)
    const onAirMappings = raw.onAirMappings === undefined ? undefined : validateOnAirMappings(raw.onAirMappings, mappings)
    const staticGraphics = raw.staticGraphics === undefined ? undefined : validateMosStaticGraphics(raw.staticGraphics, mappings)
    return {
      id: raw.id,
      name: raw.name,
      kind,
      mode,
      mappings,
      ...(raw.interactions === undefined ? {} : { interactions: validateMosInteractions(raw.interactions, mappings) }),
      ...(onAirCsv === undefined ? {} : { onAirCsv }),
      ...(onAirMappings === undefined ? {} : { onAirMappings }),
      ...(staticGraphics === undefined ? {} : { staticGraphics }),
    }
  })
  if (value.activeProjectId && !ids.has(value.activeProjectId)) throw new Error('The active MOS project must exist.')
  return { version: 2, activeProjectId: value.activeProjectId, projects }
}

export function validateMosStaticGraphics(value: unknown, mappings: MosMappingConfig): MosStaticGraphic[] {
  if (!Array.isArray(value)) throw new Error('Invalid static project graphics.')
  const ids = new Set<string>()
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || typeof item.sectionId !== 'string' || !Array.isArray(item.fields)) throw new Error(`Invalid static project graphic at index ${index}.`)
    ids.add(item.id)
    const section = mappings.sections.find(candidate => candidate.id === item.sectionId)
    if (!section) throw new Error(`Static project graphic at index ${index} references a missing section.`)
    if (item.exitMode !== 'manual-resume' && item.exitMode !== 'template-duration') throw new Error(`Invalid static project graphic exit mode at index ${index}.`)
    if (typeof item.durationSeconds !== 'number' || !Number.isFinite(item.durationSeconds) || item.durationSeconds <= 0) throw new Error(`Invalid static project graphic duration at index ${index}.`)
    const fields = item.fields.map((field, fieldIndex): MosStaticGraphicField => {
      if (!isRecord(field) || typeof field.id !== 'string' || !field.id.trim() || typeof field.value !== 'string' || !isRecord(field.targetFields)) throw new Error(`Invalid static project graphic field at ${index}.${fieldIndex}.`)
      const targets = new Set(section.targets.map(target => target.id))
      const targetFields: Record<string, string[]> = {}
      for (const [targetId, rawFields] of Object.entries(field.targetFields)) {
        if (!targets.has(targetId) || !Array.isArray(rawFields) || rawFields.some(name => typeof name !== 'string' || !name.trim())) throw new Error(`Invalid static project graphic destination at ${index}.${fieldIndex}.`)
        targetFields[targetId] = [...new Set(rawFields as string[]) ]
      }
      if (!Object.values(targetFields).some(destinations => destinations.length)) throw new Error(`Static project graphic field at ${index}.${fieldIndex} has no destination.`)
      if (field.label !== undefined && (typeof field.label !== 'string' || !field.label.trim())) throw new Error(`Invalid static project graphic field label at ${index}.${fieldIndex}.`)
      const legacyLabel = Object.values(targetFields).flat()[0] ?? 'Câmp'
      return { id: field.id, label: typeof field.label === 'string' ? field.label.trim() : legacyLabel, value: field.value, targetFields }
    })
    return { id: item.id, name: item.name, sectionId: item.sectionId, exitMode: item.exitMode, durationSeconds: item.durationSeconds, fields }
  })
}

export function validateOnAirCsvSource(value: unknown): OnAirCsvSource {
  if (!isRecord(value) || value.format !== 'pa-csv' || typeof value.folderPath !== 'string') {
    throw new Error('Invalid OnAir CSV source.')
  }
  const folderPath = value.folderPath.trim()
  if (!folderPath || folderPath.includes('\0') || !isAbsoluteDirectoryPath(folderPath)) {
    throw new Error('OnAir CSV folder path must be a nonempty absolute directory path.')
  }
  return { format: 'pa-csv', folderPath }
}

function isAbsoluteDirectoryPath(value: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/')) return true
  if (/^\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(value)) return true
  return /^\/\/[^/]+\/[^/]+(?:\/|$)/.test(value)
}

export function normalizeMosProjects(value: unknown): MosProjectsConfig {
  if (isRecord(value) && value.version === 1) {
    const mappings = validateMosMappings(value)
    return validateMosProjects(defaultMosProjects(mappings))
  }
  return validateMosProjects(value)
}

export function setActiveProjectMappings(value: unknown, mappings: MosMappingConfig): MosProjectsConfig {
  const projects = normalizeMosProjects(value)
  if (!projects.activeProjectId) {
    if (projects.projects.length) throw new Error('There is no active MOS project.')
    return validateMosProjects(defaultMosProjects(validateMosMappings(mappings)))
  }
  const active = projects.projects.find(project => project.id === projects.activeProjectId)!
  const validated = validateMosMappings(mappings, { allowEmptySources: true })
  return validateMosProjects({ ...projects, projects: projects.projects.map(project => project.id === projects.activeProjectId ? { ...project, mappings: validated } : project) })
}

export function getActiveMosProject(value: unknown): MosProject {
  const config = normalizeMosProjects(value)
  return config.projects.find(project => project.id === config.activeProjectId) ?? {
    id: '', name: '', kind: 'standalone', mode: 'csv', mappings: emptyMosMappingConfig,
  }
}

/** Creates an independent, editable standalone copy of a MOS project. */
export function duplicateMosProject(project: MosProject, name: string, createId: () => string): MosProject {
  const projectId = createId()
  const sectionIds = new Map(project.mappings.sections.map(section => [section.id, createId()]))
  const targetIds = new Map(project.mappings.sections.flatMap(section => section.targets.map(target => [target.id, createId()] as const)))

  return {
    id: projectId,
    name,
    kind: 'standalone',
    mode: 'csv',
    mappings: {
      version: project.mappings.version,
      sections: project.mappings.sections.map(section => ({
        ...section,
        ...(section.csvSource === undefined ? {} : { csvSource: { ...section.csvSource, ...(section.csvSource.columns === undefined ? {} : { columns: { ...section.csvSource.columns } }) } }),
        id: sectionIds.get(section.id)!,
        targets: section.targets.map(target => ({ ...target, id: targetIds.get(target.id)! })),
        sources: section.sources.map(source => ({
          ...source,
          id: createId(),
          fields: source.fields.map(field => ({
            ...field,
            id: createId(),
            targetFields: Object.fromEntries(Object.entries(field.targetFields).map(([targetId, destinations]) => [
              targetIds.get(targetId) ?? targetId,
              Array.isArray(destinations) ? [...destinations] : destinations,
            ])),
          })),
        })),
      })),
    },
    ...(project.onAirCsv === undefined ? {} : { onAirCsv: { ...project.onAirCsv } }),
    ...(project.onAirMappings === undefined ? {} : {
      onAirMappings: project.onAirMappings.map(graphicMapping => ({
        ...graphicMapping,
        id: createId(),
        sectionId: sectionIds.get(graphicMapping.sectionId) ?? graphicMapping.sectionId,
        fields: graphicMapping.fields.map(field => ({
          ...field,
          id: createId(),
          targetFields: Object.fromEntries(Object.entries(field.targetFields).map(([targetId, destinations]) => [
            targetIds.get(targetId) ?? targetId,
            [...destinations],
          ])),
        })),
      })),
    }),
    ...(project.staticGraphics === undefined ? {} : {
      staticGraphics: project.staticGraphics.map(graphic => ({
        ...graphic, id: createId(), sectionId: sectionIds.get(graphic.sectionId) ?? graphic.sectionId,
        fields: graphic.fields.map(field => ({ ...field, id: createId(), targetFields: Object.fromEntries(Object.entries(field.targetFields).map(([targetId, destinations]) => [targetIds.get(targetId) ?? targetId, [...destinations]])) })),
      })),
    }),
    ...(project.interactions === undefined ? {} : {
      interactions: project.interactions.map(rule => ({
        ...rule,
        id: createId(),
        triggerSectionId: sectionIds.get(rule.triggerSectionId) ?? rule.triggerSectionId,
        actions: rule.actions.map(action => ({
          ...action,
          id: createId(),
          sectionId: sectionIds.get(action.sectionId) ?? action.sectionId,
          ...(action.targetId === undefined ? {} : { targetId: targetIds.get(action.targetId) ?? action.targetId }),
        })),
      })),
    }),
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
