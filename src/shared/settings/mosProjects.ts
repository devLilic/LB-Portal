import { emptyMosMappingConfig, validateMosMappings, type MosMappingConfig } from './mosMappings'
import { validateMosInteractions, type MosInteractionRule } from './mosInteractions'
import type { OnAirCsvSource } from '../onair/contracts'
import { validateOnAirMappings, type OnAirDefaultTemplates, type OnAirGraphicMapping } from '../onair/mappings'

export const builtinTelejurnalProjectId = 'builtin-telejurnal'
export const builtinRetrospectivaProjectId = 'builtin-retrospectiva'

export type MosProjectKind = 'telejurnal' | 'retrospectiva' | 'standalone'
export interface MosProject {
  id: string
  name: string
  kind: MosProjectKind
  mappings: MosMappingConfig
  interactions?: MosInteractionRule[]
  onAirCsv?: OnAirCsvSource
  onAirMappings?: OnAirGraphicMapping[]
  onAirDefaultTemplates?: OnAirDefaultTemplates
}
export interface MosProjectsConfig {
  version: 2
  activeProjectId: string
  projects: MosProject[]
}

export type MosMappingSettings = MosMappingConfig | MosProjectsConfig

export const defaultMosProjects = (telejurnalMappings: MosMappingConfig = emptyMosMappingConfig): MosProjectsConfig => ({
  version: 2,
  activeProjectId: builtinTelejurnalProjectId,
  projects: [
    { id: builtinTelejurnalProjectId, name: 'Telejurnal', kind: 'telejurnal', mappings: telejurnalMappings },
    { id: builtinRetrospectivaProjectId, name: 'Retrospectiva săptămânii', kind: 'retrospectiva', mappings: emptyMosMappingConfig },
  ],
})

export function validateMosProjects(value: unknown): MosProjectsConfig {
  if (!isRecord(value) || value.version !== 2 || typeof value.activeProjectId !== 'string' || !Array.isArray(value.projects)) {
    throw new Error('Invalid MOS projects configuration.')
  }
  const ids = new Set<string>()
  let telejurnal = false
  let retrospectiva = false
  const projects = value.projects.map((raw, index): MosProject => {
    if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id.trim() || typeof raw.name !== 'string' || !raw.name.trim()) {
      throw new Error(`Invalid MOS project at projects[${index}].`)
    }
    if (ids.has(raw.id)) throw new Error(`Duplicate MOS project id: ${raw.id}`)
    ids.add(raw.id)
    let kind: MosProjectKind
    if (raw.id === builtinTelejurnalProjectId) {
      if (raw.kind !== 'telejurnal' || raw.name !== 'Telejurnal') throw new Error('The Telejurnal built-in project cannot be renamed or retyped.')
      telejurnal = true; kind = 'telejurnal'
    } else if (raw.id === builtinRetrospectivaProjectId) {
      if (raw.kind !== 'retrospectiva' || raw.name !== 'Retrospectiva săptămânii') throw new Error('The weekly retrospective built-in project cannot be renamed or retyped.')
      retrospectiva = true; kind = 'retrospectiva'
    } else {
      if (raw.kind !== 'standalone') throw new Error('Only built-in MOS projects may receive Plasma requests.')
      kind = 'standalone'
    }
    const mappings = validateMosMappings(raw.mappings, { allowEmptySources: kind === 'standalone' })
    const onAirCsv = raw.onAirCsv === undefined ? undefined : validateOnAirCsvSource(raw.onAirCsv)
    const onAirMappings = raw.onAirMappings === undefined ? undefined : validateOnAirMappings(raw.onAirMappings, mappings)
    const onAirDefaultTemplates = raw.onAirDefaultTemplates === undefined ? undefined : validateOnAirDefaultTemplates(raw.onAirDefaultTemplates)
    return {
      id: raw.id,
      name: raw.name,
      kind,
      mappings,
      ...(raw.interactions === undefined ? {} : { interactions: validateMosInteractions(raw.interactions, mappings) }),
      ...(onAirCsv === undefined ? {} : { onAirCsv }),
      ...(onAirMappings === undefined ? {} : { onAirMappings }),
      ...(onAirDefaultTemplates === undefined ? {} : { onAirDefaultTemplates }),
    }
  })
  if (!telejurnal || !retrospectiva) throw new Error('Both built-in MOS projects must be retained.')
  if (!ids.has(value.activeProjectId)) throw new Error('The active MOS project must exist.')
  return { version: 2, activeProjectId: value.activeProjectId, projects }
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

export function validateOnAirDefaultTemplates(value: unknown): OnAirDefaultTemplates {
  if (!isRecord(value)) throw new Error('Invalid OnAir default templates.')
  const result: OnAirDefaultTemplates = {}
  for (const kind of ['locations', 'phones'] as const) {
    if (!(kind in value)) continue
    if (typeof value[kind] !== 'string') throw new Error(`OnAir default template for ${kind} must be a string.`)
    const template = value[kind].trim()
    if (template) result[kind] = template
  }
  for (const key of Object.keys(value)) {
    if (key !== 'locations' && key !== 'phones') throw new Error(`Unsupported OnAir default template kind: ${key}`)
  }
  return result
}

function isAbsoluteDirectoryPath(value: string): boolean {
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/')) return true
  if (/^\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$)/.test(value)) return true
  return /^\/\/[^/]+\/[^/]+(?:\/|$)/.test(value)
}

export function normalizeMosProjects(value: unknown): MosProjectsConfig {
  if (isRecord(value) && value.version === 1) return defaultMosProjects(validateMosMappings(value))
  return validateMosProjects(value)
}

export function setActiveProjectMappings(value: unknown, mappings: MosMappingConfig): MosProjectsConfig {
  const projects = normalizeMosProjects(value)
  const active = projects.projects.find(project => project.id === projects.activeProjectId)!
  const validated = validateMosMappings(mappings, { allowEmptySources: active.kind === 'standalone' })
  return validateMosProjects({ ...projects, projects: projects.projects.map(project => project.id === projects.activeProjectId ? { ...project, mappings: validated } : project) })
}

export function getActiveMosProject(value: unknown): MosProject {
  const config = normalizeMosProjects(value)
  return config.projects.find(project => project.id === config.activeProjectId)!
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
    mappings: {
      version: project.mappings.version,
      sections: project.mappings.sections.map(section => ({
        ...section,
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
    ...(project.onAirDefaultTemplates === undefined ? {} : {
      onAirDefaultTemplates: { ...project.onAirDefaultTemplates },
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
