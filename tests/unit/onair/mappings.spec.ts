import { describe, expect, it } from 'vitest'
import {
  getOnAirMappingIssues,
  getOnAirEffectiveTemplate,
  onAirSourceFields,
  resolveOnAirGraphic,
  validateOnAirMappings,
  type OnAirGraphicMapping,
} from '../../../src/shared/onair/mappings'
import { duplicateMosProject, normalizeMosProjects, validateMosProjects, builtinTelejurnalProjectId } from '../../../src/shared/settings/mosProjects'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'

const mosMappings: MosMappingConfig = {
  version: 1,
  sections: [{
    id: 'section-titles', name: 'Titluri', resumePlayDelayMs: 100,
    targets: [{ id: 'target-a', template: 'OUT-A' }, { id: 'target-b', template: 'OUT-B' }],
    sources: [{ id: 'mos-source', template: 'MOS-TITLE', exitMode: 'manual-resume', durationSeconds: 6, fields: [] }],
  }],
}

const mapping: OnAirGraphicMapping = {
  id: 'onair-title',
  kind: 'titles',
  sourceTemplate: '01_Titlu',
  sectionId: 'section-titles',
  fields: [
    { id: 'title-field', sourceField: 'Titlu', targetFields: { 'target-a': ['TITLE_A'], 'target-b': ['TITLE_B', 'TITLE_B_COPY'] } },
    { id: 'super-field', sourceField: 'Supratitlu', targetFields: { 'target-a': ['SUPER_A'], 'target-b': ['SUPER_B'] } },
  ],
}

function project(onAirMappings: OnAirGraphicMapping[] = [mapping]) {
  const config = normalizeMosProjects(mosMappings)
  const base = config.projects.find(candidate => candidate.id === builtinTelejurnalProjectId)!
  return { ...base, onAirMappings }
}

describe('OnAir graphic mapping validation', () => {
  it('exposes the exact CSV source field choices per graphic kind', () => {
    expect(onAirSourceFields).toEqual({
      titles: ['Titlu', 'Supratitlu'],
      persons: ['Nume', 'Functie'],
      locations: ['Locatie'],
      phones: ['Nume', 'Functie', 'Image'],
    })
  })

  it('accepts valid sections, targets and field mappings and returns a detached normalized value', () => {
    const input = [mapping]
    const result = validateOnAirMappings(input, mosMappings)
    expect(result).toEqual([{ ...mapping, exitMode: 'manual-resume', durationSeconds: 6 }])
    expect(result).not.toBe(input)
    expect(result[0]?.fields[0]?.targetFields['target-b']).not.toBe(mapping.fields[0]?.targetFields['target-b'])
  })

  it('reports duplicate IDs/sources, unsupported fields, stale references and conflicting target fields', () => {
    const invalid: OnAirGraphicMapping[] = [
      mapping,
      {
        ...mapping,
        id: 'onair-title',
        fields: [
          { id: 'title-field', sourceField: 'Unknown', targetFields: { 'missing-target': ['TITLE_A'], 'target-a': ['TITLE_A'] } },
          { id: 'another-field', sourceField: 'Titlu', targetFields: { 'target-a': ['TITLE_A'] } },
        ],
      },
      { ...mapping, id: 'other-kind', kind: 'persons', sourceTemplate: '01_Titlu', sectionId: 'missing-section', fields: [] },
      { ...mapping, id: 'duplicate-source', sourceTemplate: '01_Titlu' },
    ]
    const codes = getOnAirMappingIssues(invalid, mosMappings).map(issue => issue.code)
    expect(codes).toContain('duplicateId')
    expect(codes).toContain('duplicateSource')
    expect(codes).toContain('invalidSourceField')
    expect(codes).toContain('invalidTarget')
    expect(codes).toContain('invalidSection')
    expect(codes).toContain('duplicateTargetField')
    expect(() => validateOnAirMappings(invalid, mosMappings)).toThrow(/Invalid OnAir mappings/)
  })

  it('validates an optional second source field and text separator', () => {
    const combined: OnAirGraphicMapping = { ...mapping, kind: 'persons', fields: [{
      id: 'combined', sourceField: 'Nume', sourceField2: 'Functie', separator: ', ', targetFields: { 'target-a': ['PERSON'] },
    }] }
    expect(getOnAirMappingIssues([combined], mosMappings)).toEqual([])
    expect(getOnAirMappingIssues([{ ...combined, fields: [{ ...combined.fields[0]!, sourceField2: 'Unknown' }] }], mosMappings).map(issue => issue.code)).toContain('invalidSourceField')
    expect(getOnAirMappingIssues([{ ...combined, fields: [{ ...combined.fields[0]!, sourceField2: '' }] }], mosMappings).map(issue => issue.code)).toContain('invalidSourceField')
    expect(getOnAirMappingIssues([{ ...combined, fields: [{ ...combined.fields[0]!, sourceField2: 'Nume' }] }], mosMappings).map(issue => issue.code)).toContain('duplicateSourceField')
    expect(getOnAirMappingIssues([{ ...combined, fields: [{ ...combined.fields[0]!, separator: 3 as unknown as string }] }], mosMappings).map(issue => issue.code)).toContain('invalidSeparator')
  })
})

describe('OnAir graphic mapping resolution and project persistence', () => {
  it('prefers exact CSV templates and applies only configured location/phone defaults', () => {
    expect(getOnAirEffectiveTemplate('locations', ' PA-Loc ' , { locations: 'Fallback' })).toBe(' PA-Loc ')
    expect(getOnAirEffectiveTemplate('locations', '', { locations: '  DEFAULT_LOC  ' })).toBe('DEFAULT_LOC')
    expect(getOnAirEffectiveTemplate('phones', '', { phones: 'DEFAULT_PHONE' })).toBe('DEFAULT_PHONE')
    expect(getOnAirEffectiveTemplate('titles', '', { locations: 'DEFAULT_LOC', phones: 'DEFAULT_PHONE' })).toBe('')
    expect(getOnAirEffectiveTemplate('persons', '  ', { locations: 'DEFAULT_LOC', phones: 'DEFAULT_PHONE' })).toBe('')
    expect(getOnAirEffectiveTemplate('locations', undefined as unknown as string, { locations: 'DEFAULT_LOC' })).toBe('DEFAULT_LOC')
  })

  it('resolves rows with blank CSV templates through explicit per-project location and phone defaults', () => {
    const defaults = { locations: 'LOC_DEFAULT', phones: 'PHONE_DEFAULT' }
    const location: OnAirGraphicMapping = {
      id: 'location-map', kind: 'locations', sourceTemplate: 'LOC_DEFAULT', sectionId: 'section-titles',
      fields: [{ id: 'location-field', sourceField: 'Locatie', targetFields: { 'target-a': ['LOCATION'] } }],
    }
    const phone: OnAirGraphicMapping = {
      id: 'phone-map', kind: 'phones', sourceTemplate: 'PHONE_DEFAULT', sectionId: 'section-titles',
      fields: [{ id: 'phone-field', sourceField: 'Image', targetFields: { 'target-b': ['IMAGE'] } }],
    }
    const configuredProject = { ...project([location, phone]), onAirDefaultTemplates: defaults }
    expect(resolveOnAirGraphic('locations', '', { Locatie: 'Studio 1' }, configuredProject)).toMatchObject({
      status: 'matched', sourceTemplate: 'LOC_DEFAULT', targets: [{ fields: { LOCATION: 'Studio 1' } }, {}],
    })
    expect(resolveOnAirGraphic('phones', '', { Image: '' }, configuredProject)).toMatchObject({
      status: 'matched', sourceTemplate: 'PHONE_DEFAULT', targets: [{}, { fields: { IMAGE: '' } }],
    })
    expect(resolveOnAirGraphic('titles', '', { Titlu: 'Title' }, configuredProject)).toMatchObject({ status: 'missing-template' })
  })

  it('fans one source field out to several destination fields and retains empty string values', () => {
    expect(resolveOnAirGraphic('titles', '01_Titlu', { Titlu: '', Supratitlu: 'SUPRA' }, project())).toEqual({
      status: 'matched',
      sourceTemplate: '01_Titlu',
      section: { id: 'section-titles', name: 'Titluri' },
      exitMode: 'manual-resume',
      durationSeconds: 6,
      targets: [
        { id: 'target-a', template: 'OUT-A', fields: { TITLE_A: '', SUPER_A: 'SUPRA' } },
        { id: 'target-b', template: 'OUT-B', fields: { TITLE_B: '', TITLE_B_COPY: '', SUPER_B: 'SUPRA' } },
      ],
    })
  })

  it('combines two CSV fields into one destination and keeps legacy single-field mappings unchanged', () => {
    const personMapping: OnAirGraphicMapping = {
      id: 'person-map', kind: 'persons', sourceTemplate: '02_Nume', sectionId: 'section-titles',
      fields: [{ id: 'person-name-role', sourceField: 'Nume', sourceField2: 'Functie', targetFields: { 'target-a': ['NAME_ROLE'] } }],
    }
    const personProject = project([personMapping])
    expect(resolveOnAirGraphic('persons', '02_Nume', { Nume: 'ION POPESCU', Functie: 'Ministru' }, personProject)).toMatchObject({
      status: 'matched', targets: [{ fields: { NAME_ROLE: 'ION POPESCU, Ministru' } }, {}],
    })
    expect(resolveOnAirGraphic('persons', '02_Nume', { Nume: 'ION POPESCU', Functie: '' }, personProject)).toMatchObject({
      targets: [{ fields: { NAME_ROLE: 'ION POPESCU' } }, {}],
    })
    expect(resolveOnAirGraphic('persons', '02_Nume', { Nume: '', Functie: 'Ministru' }, personProject)).toMatchObject({
      targets: [{ fields: { NAME_ROLE: 'Ministru' } }, {}],
    })
    expect(resolveOnAirGraphic('persons', '02_Nume', { Nume: '', Functie: '' }, personProject)).toMatchObject({
      targets: [{ fields: { NAME_ROLE: '' } }, {}],
    })
    const explicitSeparator = project([{ ...personMapping, fields: [{ ...personMapping.fields[0]!, separator: ' / ' }] }])
    expect(resolveOnAirGraphic('persons', '02_Nume', { Nume: 'ION POPESCU', Functie: 'Ministru' }, explicitSeparator)).toMatchObject({
      targets: [{ fields: { NAME_ROLE: 'ION POPESCU / Ministru' } }, {}],
    })
    expect(resolveOnAirGraphic('titles', '01_Titlu', { Titlu: 'Legacy value' }, project())).toMatchObject({
      targets: [{ fields: { TITLE_A: 'Legacy value' } }, { fields: { TITLE_B: 'Legacy value', TITLE_B_COPY: 'Legacy value' } }],
    })
  })

  it('validates and resolves the configured per-template exit mode and duration', () => {
    const timed = validateOnAirMappings([{ ...mapping, exitMode: 'template-duration', durationSeconds: 4.5 }], mosMappings)
    expect(timed[0]).toMatchObject({ exitMode: 'template-duration', durationSeconds: 4.5 })
    expect(resolveOnAirGraphic('titles', '01_Titlu', { Titlu: 'Timed' }, project(timed))).toMatchObject({
      exitMode: 'template-duration', durationSeconds: 4.5,
    })
    expect(() => validateOnAirMappings([{ ...mapping, exitMode: 'template-duration', durationSeconds: 0 }], mosMappings)).toThrow(/invalidDuration/)
  })

  it('distinguishes unmapped sources from missing templates/references', () => {
    expect(resolveOnAirGraphic('titles', 'unknown', {}, project())).toEqual({ status: 'unmapped', kind: 'titles', sourceTemplate: 'unknown' })
    expect(resolveOnAirGraphic('titles', '', {}, project())).toMatchObject({ status: 'missing-template', kind: 'titles' })
    const broken = project([{ ...mapping, sectionId: 'deleted' }])
    expect(resolveOnAirGraphic('titles', mapping.sourceTemplate, {}, broken)).toEqual({
      status: 'missing-template', kind: 'titles', sourceTemplate: mapping.sourceTemplate, sectionId: 'deleted',
    })
  })

  it('persists optional project mappings and duplicates mapping, field, section, and target references independently', () => {
    const config = normalizeMosProjects(mosMappings)
    const source = { ...config.projects.find(candidate => candidate.id === builtinTelejurnalProjectId)!, onAirMappings: [mapping] }
    const projects = validateMosProjects({ ...config, projects: config.projects.map(candidate => candidate.id === source.id ? source : candidate) })
    expect(projects.projects.find(candidate => candidate.id === source.id)?.onAirMappings).toEqual([{ ...mapping, exitMode: 'manual-resume', durationSeconds: 6 }])

    let id = 0
    const copy = duplicateMosProject(source, 'Copy', () => `copy-${++id}`)
    const duplicatedMapping = copy.onAirMappings?.[0]
    expect(duplicatedMapping).toBeDefined()
    expect(duplicatedMapping?.id).not.toBe(mapping.id)
    expect(duplicatedMapping?.sectionId).not.toBe(mapping.sectionId)
    expect(duplicatedMapping?.fields.map(field => field.id)).not.toEqual(mapping.fields.map(field => field.id))
    const newTargetIds = copy.mappings.sections[0]?.targets.map(target => target.id)
    expect(Object.keys(duplicatedMapping!.fields[0]!.targetFields)).toEqual([newTargetIds![0], newTargetIds![1]])
    expect(duplicatedMapping!.fields[0]!.targetFields[newTargetIds![1]!]).not.toBe(mapping.fields[0]!.targetFields['target-b'])
    expect(validateMosProjects({ ...config, projects: [...config.projects, copy] }).projects.at(-1)?.onAirMappings).toEqual(copy.onAirMappings?.map(item => ({ ...item, exitMode: 'manual-resume', durationSeconds: 6 })))
  })

  it('validates, trims, persists and independently duplicates per-project defaults', () => {
    const config = normalizeMosProjects(mosMappings)
    const source = {
      ...config.projects.find(candidate => candidate.id === builtinTelejurnalProjectId)!,
      onAirDefaultTemplates: { locations: '  LOC_DEFAULT  ', phones: ' PHONE_DEFAULT ' },
    }
    const configured = validateMosProjects({
      ...config,
      projects: config.projects.map(candidate => candidate.id === source.id ? source : candidate),
    })
    expect(configured.projects.find(candidate => candidate.id === source.id)?.onAirDefaultTemplates).toEqual({
      locations: 'LOC_DEFAULT', phones: 'PHONE_DEFAULT',
    })
    const blank = validateMosProjects({
      ...config,
      projects: config.projects.map(candidate => candidate.id === source.id
        ? { ...candidate, onAirDefaultTemplates: { locations: '  ', phones: '' } }
        : candidate),
    })
    expect(blank.projects.find(candidate => candidate.id === source.id)?.onAirDefaultTemplates).toEqual({})
    expect(() => validateMosProjects({
      ...config,
      projects: config.projects.map(candidate => candidate.id === source.id
        ? { ...candidate, onAirDefaultTemplates: { titles: 'not-allowed' } }
        : candidate),
    })).toThrow(/Unsupported OnAir default template kind/)
    const copy = duplicateMosProject(configured.projects.find(candidate => candidate.id === source.id)!, 'Copy', () => 'copy-id')
    expect(copy.onAirDefaultTemplates).toEqual({ locations: 'LOC_DEFAULT', phones: 'PHONE_DEFAULT' })
    expect(copy.onAirDefaultTemplates).not.toBe(source.onAirDefaultTemplates)
  })
})
