export interface MosMappingConfig {
  version: 1
  sections: MosMappingSection[]
}

export interface MosMappingSection {
  id: string
  name: string
  targets: MosMappingTarget[]
  resumePlayDelayMs: number
  dataPropagationDelayMs?: number
  sources: MosMappingSource[]
  /** Section-specific CSV file and selected headers for each semantic field. Omit for sections without CSV input. */
  csvSource?: {
    kind: 'titles' | 'persons' | 'locations' | 'phones' | 'waitTitlesLocations'
    fileName: string
    columns?: Record<string, string>
  }
}

export interface MosMappingTarget {
  id: string
  template: string
}

export interface MosMappingSource {
  id: string
  template: string
  exitMode: 'manual-resume' | 'template-duration'
  durationSeconds: number
  fields: MosFieldMapping[]
}

export interface MosFieldMapping {
  id: string
  param: string
  /** A legacy string is accepted so existing saved settings remain readable. */
  targetFields: Record<string, string | string[]>
}

export function getMosTargetFields(value: unknown): string[] {
  const fields = Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  return fields.filter((field): field is string => typeof field === 'string' && Boolean(field.trim()))
}

export const emptyMosMappingConfig: MosMappingConfig = { version: 1, sections: [] }
export const mosMappingResumeDelayChoices = [0, 50, 100, 150, 200, 250, 500, 1000] as const
export const mosMappingDataPropagationDelayChoices = [0, 100, 250, 500, 1000] as const

export interface MosMappingIssue { code: string; path: string }

export function getMosMappingIssues(value: unknown, options:{allowEmptySources?:boolean} = {}): MosMappingIssue[] {
  const issues: MosMappingIssue[] = []
  const issue = (code: string, path: string) => issues.push({ code, path })
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.sections)) {
    return [{ code: 'invalidStructure', path: '$' }]
  }

  const ids = new Set<string>()
  const sourceTemplates = new Set<string>()
  const targetTemplates = new Set<string>()
  const addId = (id: unknown, path: string) => {
    if (typeof id !== 'string' || !id.trim()) { issue('required', path); return }
    if (ids.has(id)) issue('duplicateId', path)
    ids.add(id)
  }
  const addTemplate = (value: unknown, path: string, seen: Set<string>, duplicate: string) => {
    if (typeof value !== 'string' || !value.trim()) { issue('required', path); return }
    if (seen.has(value)) issue(duplicate, path)
    seen.add(value)
  }
  value.sections.forEach((rawSection: unknown, si: number) => {
    const sp = `sections[${si}]`
    if (!isRecord(rawSection) || !Array.isArray(rawSection.targets) || !Array.isArray(rawSection.sources)) {
      issue('invalidStructure', sp); return
    }
    const section = rawSection
    addId(section.id, `${sp}.id`)
    if (typeof section.name !== 'string' || !section.name.trim()) issue('required', `${sp}.name`)
    if (section.csvSource !== undefined) {
      const csv = section.csvSource
      if (!isRecord(csv) || !['titles', 'persons', 'locations', 'phones', 'waitTitlesLocations'].includes(String(csv.kind)) || typeof csv.fileName !== 'string' || !/^[^\\/:*?"<>|\0]+\.csv$/i.test(csv.fileName.trim()) || (csv.columns !== undefined && (!isRecord(csv.columns) || Object.values(csv.columns).some(value => typeof value !== 'string')))) issue('invalidStructure', `${sp}.csvSource`)
      else if (isRecord(csv.columns)) {
        const requiredCsvFields: Record<string, string[]> = {
          titles: ['Nr', 'Titlu', 'Supratitlu', 'Template'],
          persons: ['Sectiune', 'Nume', 'Functie', 'Template'],
          locations: ['Locatie'],
          phones: ['Nume', 'Functie', 'Image'],
          waitTitlesLocations: ['Titlu', 'Locatie', 'Template'],
        }
        for (const field of requiredCsvFields[String(csv.kind)] ?? []) {
          if (typeof csv.columns[field] !== 'string' || !csv.columns[field].trim()) issue('required', `${sp}.csvSource.columns.${field}`)
        }
      }
    }
    if (!mosMappingResumeDelayChoices.includes(section.resumePlayDelayMs as typeof mosMappingResumeDelayChoices[number])) issue('invalidDelay', `${sp}.resumePlayDelayMs`)
    if (section.dataPropagationDelayMs !== undefined && !mosMappingDataPropagationDelayChoices.includes(section.dataPropagationDelayMs as typeof mosMappingDataPropagationDelayChoices[number])) issue('invalidDelay', `${sp}.dataPropagationDelayMs`)
    if (section.targets.length < 1 || section.targets.length > 2) issue('invalidStructure', `${sp}.targets`)
    section.targets.forEach((rawTarget: unknown, ti: number) => {
      const tp = `${sp}.targets[${ti}]`
      if (!isRecord(rawTarget)) { issue('invalidStructure', tp); return }
      addId(rawTarget.id, `${tp}.id`)
      addTemplate(rawTarget.template, `${tp}.template`, targetTemplates, 'duplicateTarget')
    })
    if (section.sources.length === 0&&!options.allowEmptySources) issue('invalidStructure', `${sp}.sources`)
    section.sources.forEach((rawSource: unknown, ri: number) => {
      const rp = `${sp}.sources[${ri}]`
      if (!isRecord(rawSource) || !Array.isArray(rawSource.fields)) { issue('invalidStructure', rp); return }
      const source = rawSource
      addId(source.id, `${rp}.id`)
      addTemplate(source.template, `${rp}.template`, sourceTemplates, 'duplicateSource')
      if (source.exitMode !== 'manual-resume' && source.exitMode !== 'template-duration') issue('invalidStructure', `${rp}.exitMode`)
      if (typeof source.durationSeconds !== 'number' || !Number.isFinite(source.durationSeconds) || source.durationSeconds <= 0) issue('invalidDuration', `${rp}.durationSeconds`)
      const destinationsByTarget = new Map<string, Set<string>>()
      source.fields.forEach((rawField: unknown, fi: number) => {
        const fp = `${rp}.fields[${fi}]`
        if (!isRecord(rawField) || !isRecord(rawField.targetFields)) { issue('invalidStructure', fp); return }
        const field = rawField
        addId(field.id, `${fp}.id`)
        if (typeof field.param !== 'string' || !field.param.trim()) issue('required', `${fp}.param`)
        const mapping = field.targetFields
        const sectionTargetIds = new Set(section.targets.flatMap((target: unknown) => isRecord(target) && typeof target.id === 'string' ? [target.id] : []))
        for (const targetId of Object.keys(mapping)) {
          if (!sectionTargetIds.has(targetId)) issue('invalidStructure', `${fp}.targetFields.${targetId}`)
        }
        for (const target of section.targets) {
          const targetId = isRecord(target) ? target.id : undefined
          if (typeof targetId !== 'string') continue
        }
        for (const [targetId, rawDest] of Object.entries(mapping)) {
          if (typeof rawDest !== 'string' && !Array.isArray(rawDest)) { issue('invalidStructure', `${fp}.targetFields.${targetId}`); continue }
          if (Array.isArray(rawDest) && rawDest.some(dest => typeof dest !== 'string' || !dest.trim())) issue('required', `${fp}.targetFields.${targetId}`)
          const destinations = getMosTargetFields(rawDest)
          let seen = destinationsByTarget.get(targetId)
          if (!seen) { seen = new Set(); destinationsByTarget.set(targetId, seen) }
          for (const dest of destinations) {
            if (seen.has(dest)) issue('duplicateField', `${fp}.targetFields.${targetId}`)
            seen.add(dest)
          }
        }
      })
    })
  })
  return issues
}

export function validateMosMappings(value: unknown, options:{allowEmptySources?:boolean} = {}): MosMappingConfig {
  const issues = getMosMappingIssues(value,options)
  if (issues.length) throw new Error(`Invalid MOS mappings: ${issues.map(({ code, path }) => `${code} at ${path}`).join(', ')}`)
  return value as MosMappingConfig
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
