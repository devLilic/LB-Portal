import { describe, expect, it } from 'vitest'
import { resolveMosMapping } from '../../../src/shared/ingress/mosMappingResolution'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'

const config: MosMappingConfig = { version: 1, sections: [{ id: 's1', name: 'Headlines', targets: [{ id: 't1', template: 'LB-1' }, { id: 't2', template: 'LB-2' }], resumePlayDelayMs: 150, sources: [{ id: 'src', template: 'Plasma', exitMode: 'template-duration', durationSeconds: 7, fields: [{ id: 'f1', param: 'Title', targetFields: { t1: 'TextA', t2: 'TextB' } }, { id: 'f2', param: 'Sub', targetFields: { t1: 'SubA', t2: 'SubB' } }] }] }] }

describe('resolveMosMapping', () => {
  it('resolves each buffer field and keeps distinct received values', () => {
    expect(resolveMosMapping({ template: 'Plasma', params: { Title: 'Main', Sub: 'Second' } }, config)).toEqual({ status: 'matched', template: 'Plasma',project:{id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal'}, section: { id: 's1', name: 'Headlines' }, targets: [{ id: 't1', template: 'LB-1', fields: [{ param: 'Title', fields: ['TextA'], value: 'Main' }, { param: 'Sub', fields: ['SubA'], value: 'Second' }] }, { id: 't2', template: 'LB-2', fields: [{ param: 'Title', fields: ['TextB'], value: 'Main' }, { param: 'Sub', fields: ['SubB'], value: 'Second' }] }], exitMode: 'template-duration', durationSeconds: 7, resumePlayDelayMs: 150, dataPropagationDelayMs:250, missingParams: [], unmappedParams: [] })
  })
  it('reports missing and extra params, including empty values as present', () => {
    const result = resolveMosMapping({ template: 'Plasma', params: { Title: '', Extra: 'x' } }, config)
    expect(result.status).toBe('matched')
    if (result.status === 'matched') { expect(result.targets[0]?.fields[0]?.value).toBe(''); expect(result.targets[0]?.fields[1]?.value).toBeNull(); expect(result.missingParams).toEqual(['Sub']); expect(result.unmappedParams).toEqual(['Extra']) }
  })
  it('fans one source parameter out to several destination fields and permits unmapped source fields', () => {
    const partial: MosMappingConfig = { ...config, sections: config.sections.map(section => ({ ...section, sources: section.sources.map(source => ({ ...source, fields: [
      { id: 'title', param: 'Title', targetFields: { t1: ['TextA', 'TextA_M'], t2: ['TextB', 'TextB_M'] } },
      { id: 'unused', param: 'Unused', targetFields: { t1: [], t2: [] } },
    ] })) })) }
    const result = resolveMosMapping({ template: 'Plasma', params: { Title: 'Main' } }, partial)
    expect(result.status).toBe('matched')
    if (result.status === 'matched') {
      expect(result.targets[0]?.fields).toEqual([{ param: 'Title', fields: ['TextA', 'TextA_M'], value: 'Main' }, { param: 'Unused', fields: [], value: null }])
      expect(result.missingParams).toEqual([])
      expect(result.unmappedParams).toEqual([])
    }
  })
  it('keeps repeated source-parameter rows as separate destination mappings', () => {
    const repeated: MosMappingConfig = { ...config, sections: config.sections.map(section => ({ ...section, sources: section.sources.map(source => ({ ...source, fields: [
      { id: 'title-main', param: 'Title', targetFields: { t1: ['TextA'], t2: ['TextB'] } },
      { id: 'title-copy', param: 'Title', targetFields: { t1: ['TextA_M'], t2: ['TextB_M'] } },
    ] })) })) }
    const result = resolveMosMapping({ template: 'Plasma', params: { Title: 'Main' } }, repeated)
    expect(result.status).toBe('matched')
    if (result.status === 'matched') {
      expect(result.targets[0]?.fields).toEqual([{ param: 'Title', fields: ['TextA'], value: 'Main' }, { param: 'Title', fields: ['TextA_M'], value: 'Main' }])
      expect(result.missingParams).toEqual([])
    }
  })
  it('resolves RESUME by template without requiring or interpreting mapped parameters', () => {
    const result = resolveMosMapping({ type: 'mos-resume', template: 'Plasma' }, config)
    expect(result.status).toBe('matched')
    if (result.status === 'matched') {
      expect(result.commandType).toBe('mos-resume')
      expect(result.targets[0]?.fields.map(field => field.value)).toEqual([null, null])
      expect(result.missingParams).toEqual([])
      expect(result.unmappedParams).toEqual([])
    }
    expect(resolveMosMapping({ type: 'mos-resume', template: 'Plasma', params: 'ignored' }, config).status).toBe('matched')
  })
  it('matches graphic-only templates and distinguishes unmapped and invalid requests', () => {
    const graphic: MosMappingConfig = { ...config, sections: [{ ...config.sections[0]!, sources: [{ ...config.sections[0]!.sources[0]!, template: 'Graphic', fields: [] }] }] }
    expect(resolveMosMapping({ template: 'Graphic' }, graphic).status).toBe('matched')
    const project={id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal'}
    expect(resolveMosMapping({ template: 'Other' }, config)).toEqual({ status: 'unmapped', template: 'Other',project })
    expect(resolveMosMapping({ template: 'Plasma', params: { Title: 3 } }, config)).toEqual({ status: 'invalid-request', template: 'Plasma',project })
    expect(resolveMosMapping({ template: '  ' }, config)).toEqual({ status: 'invalid-request', template: '  ',project })
  })
  it('blocks Plasma mapping while a standalone project is active',()=>{
    const standalone={version:2 as const,activeProjectId:'standalone-1',projects:[{id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal' as const,mappings:config},{id:'builtin-retrospectiva',name:'Retrospectiva săptămânii',kind:'retrospectiva' as const,mappings:{version:1 as const,sections:[]}},{id:'standalone-1',name:'Direct LiveBoard',kind:'standalone' as const,mappings:{version:1 as const,sections:[]}}]}
    expect(resolveMosMapping({template:'Plasma'},standalone)).toEqual({status:'project-disabled',template:'Plasma',project:{id:'standalone-1',name:'Direct LiveBoard',kind:'standalone'}})
  })
  it('captures the active built-in project for unknown and invalid requests',()=>{
    const projects={version:2 as const,activeProjectId:'builtin-retrospectiva',projects:[{id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal' as const,mappings:config},{id:'builtin-retrospectiva',name:'Retrospectiva săptămânii',kind:'retrospectiva' as const,mappings:{version:1 as const,sections:[]}}]}
    expect(resolveMosMapping({template:'Unknown'},projects)).toEqual({status:'unmapped',template:'Unknown',project:{id:'builtin-retrospectiva',name:'Retrospectiva săptămânii',kind:'retrospectiva'}})
    expect(resolveMosMapping({template:'Known',params:{Title:1}},projects)).toEqual({status:'invalid-request',template:'Known',project:{id:'builtin-retrospectiva',name:'Retrospectiva săptămânii',kind:'retrospectiva'}})
  })
})
