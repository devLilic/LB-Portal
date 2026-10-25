import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createSettingsStore } from '../../../electron/main/modules/settings/settingsStore'
import { normalizeMosProjects, validateMosProjects, setActiveProjectMappings, duplicateMosProject, defaultMosProjects, builtinRetrospectivaProjectId, builtinTelejurnalProjectId, type MosProjectsConfig } from '../../../src/shared/settings/mosProjects'
import { exportMosProjectFile, importMosProjectFile } from '../../../src/shared/settings/mosProjectFiles'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'

const dirs:string[]=[]
afterEach(()=>{while(dirs.length)rmSync(dirs.pop()!,{recursive:true,force:true})})
function storeAtTemp(){const dir=mkdtempSync(path.join(os.tmpdir(),'mos-projects-'));dirs.push(dir);return{dir,store:createSettingsStore(dir)}}
function makeIdFactory(){let next=0;return()=>`duplicate-${++next}`}

const legacy:MosMappingConfig={version:1,sections:[{id:'legacy-section',name:'Old titles',targets:[{id:'t1',template:'OUT-A'}],resumePlayDelayMs:100,sources:[{id:'src',template:'OLD-MOS',exitMode:'manual-resume',durationSeconds:6,fields:[{id:'f',param:'Text',targetFields:{t1:'Text'}}]}]}]}

describe('MOS projects',()=>{
  it('starts empty and migrates legacy flat sections intact into an editable Plasma project',()=>{
    expect(defaultMosProjects()).toEqual({version:2,activeProjectId:'',projects:[]})
    const config=normalizeMosProjects(legacy)
    expect(config.version).toBe(2)
    expect(config.activeProjectId).toBe('migrated-legacy-project')
    expect(config.projects).toHaveLength(1)
    expect(config.projects[0]).toMatchObject({name:'Proiect migrat',kind:'standalone',mode:'plasma',mappings:legacy})
  })

  it('persists canonical projects after a legacy save and legacy writes update only the active project',()=>{
    const {dir,store}=storeAtTemp()
    store.setSetting('mosMappings',legacy)
    let canonical=store.getSetting('mosMappings') as MosProjectsConfig
    expect(JSON.parse(readFileSync(path.join(dir,'settings.json'),'utf8')).mosMappings.version).toBe(2)
    canonical={...canonical,projects:canonical.projects.map(p=>({...p,mappings:legacy}))}
    store.setSetting('mosMappings',canonical)
    const second={...legacy,sections:legacy.sections.map(s=>({...s,name:'Updated legacy section'}))}
    store.setSetting('mosMappings',second)
    const saved=store.getSetting('mosMappings') as MosProjectsConfig
    expect(saved.projects.find(p=>p.id===canonical.activeProjectId)?.mappings).toEqual(second)
  })

  it('allows source-free standalone sections and repeated MOS templates across projects',()=>{
    const base=normalizeMosProjects(legacy)
    const standalone={id:'direct',name:'Direct control',kind:'standalone' as const,mappings:{version:1 as const,sections:[{id:'direct-section',name:'Direct title',targets:[{id:'d',template:'OUT-D'}],resumePlayDelayMs:0,sources:[]}]}}
    const projects={...base,projects:[...base.projects,standalone]}
    expect(validateMosProjects(projects).projects.at(-1)).toMatchObject({mode:'csv',mappings:{sections:[{sources:[]}]}})
  })
  it('keeps optional static graphics with project data and supports source-free Plasma sections',()=>{
    const base=normalizeMosProjects(legacy)
    const project={id:'graphics',name:'Show',kind:'standalone' as const,mode:'plasma' as const,mappings:{version:1 as const,sections:[{id:'logo-section',name:'Logo',targets:[{id:'logo-target',template:'LOGO'}],resumePlayDelayMs:100,sources:[]}]},staticGraphics:[{id:'logo',name:'Logo',sectionId:'logo-section',exitMode:'manual-resume' as const,durationSeconds:6,fields:[{id:'path',label:'Image',value:'logo.png',targetFields:{'logo-target':['Image','Image_M']}}]}]}
    const templateOnly={id:'background',name:'Background',sectionId:'logo-section',exitMode:'manual-resume' as const,durationSeconds:6,fields:[]}
    const configured={...project,staticGraphics:[...project.staticGraphics,templateOnly]}
    const validated=validateMosProjects({...base,activeProjectId:project.id,projects:[configured]})
    expect(validated.projects[0]?.staticGraphics?.[0]).toEqual(project.staticGraphics[0])
    expect(validated.projects[0]?.staticGraphics?.[1]?.fields).toEqual([])
    const withoutLabel={...project,staticGraphics:[{...project.staticGraphics[0]!,fields:[{id:'legacy-path',value:'logo.png',targetFields:{'logo-target':['Image','Image_M']}}]}]}
    expect(validateMosProjects({...base,activeProjectId:project.id,projects:[withoutLabel]}).projects[0]?.staticGraphics?.[0]?.fields[0]?.label).toBe('Image')
    const copy=duplicateMosProject(validated.projects[0]!, 'Copy', makeIdFactory())
    const targetId=copy.mappings.sections[0]!.targets[0]!.id
    expect(copy.staticGraphics?.[0]?.sectionId).toBe(copy.mappings.sections[0]?.id)
    expect(copy.staticGraphics?.[0]?.fields[0]?.targetFields).toEqual({[targetId]:['Image','Image_M']})
    expect(copy.staticGraphics?.[0]?.id).not.toBe('logo')
  })
  it('keeps Plasma built-ins enabled and validates an explicit custom project mode',()=>{
    const base=normalizeMosProjects(legacy)
    expect(base.projects.map(project=>project.mode)).toEqual(['plasma'])
    const plasmaProject={id:'custom-plasma',name:'Retrospectiva',kind:'standalone' as const,mode:'plasma' as const,mappings:legacy}
    expect(validateMosProjects({...base,projects:[...base.projects,plasmaProject]}).projects.at(-1)?.mode).toBe('plasma')
    expect(()=>validateMosProjects({...base,projects:[...base.projects,{...plasmaProject,mode:'unknown'}]})).toThrow(/Invalid MOS project mode/)
  })
  it('round-trips a source-free standalone project through the legacy flat setting API',()=>{
    const {store}=storeAtTemp()
    const base=normalizeMosProjects(legacy)
    const standalone={id:'direct',name:'Direct control',kind:'standalone' as const,mappings:{version:1 as const,sections:[{id:'direct-section',name:'Direct title',targets:[{id:'d',template:'OUT-D'}],resumePlayDelayMs:0,sources:[]}]}}
    const projects={...base,activeProjectId:standalone.id,projects:[...base.projects,standalone]}
    store.setSetting('mosMappings',projects)
    const flat=normalizeMosProjects(store.getSetting('mosMappings')).projects.find(p=>p.id===standalone.id)!.mappings
    store.setSetting('mosMappings',flat)
    expect(normalizeMosProjects(store.getSetting('mosMappings')).projects.find(p=>p.id===standalone.id)!.mappings).toEqual(flat)
  })

  it('persists project interactions and preserves them when the active mappings are edited',()=>{
    const {store}=storeAtTemp()
    const mappings={...legacy,sections:[...legacy.sections,{...legacy.sections[0],id:'section-2',name:'Second titles',targets:[{id:'t2',template:'OUT-B'}],sources:[{...legacy.sections[0].sources[0],id:'src-2',template:'SECOND-MOS',fields:[{id:'f2',param:'Text',targetFields:{t2:'Text'}}]}]}]}
    const base=normalizeMosProjects(mappings)
    const interactions=[{id:'rule-1',name:'Stop together',enabled:true,triggerSectionId:'legacy-section',event:'after-stop' as const,actions:[{id:'action-1',kind:'stop' as const,sectionId:'section-2',delayMs:0}]}]
    const configured={...base,projects:base.projects.map(project=>project.id===base.activeProjectId?{...project,interactions}:project)}
    store.setSetting('mosMappings',configured)
    const saved=normalizeMosProjects(store.getSetting('mosMappings'))
    expect(saved.projects.find(project=>project.id===base.activeProjectId)?.interactions).toEqual(interactions)

    const edited={...mappings,sections:mappings.sections.map(section=>({...section,name:'Renamed titles'}))}
    const updated=setActiveProjectMappings(saved,edited)
    expect(updated.projects.find(project=>project.id===base.activeProjectId)?.interactions).toEqual(interactions)
  })

  it('duplicates a project with fresh IDs, remapped references, and independent nested data',()=>{
    const mappings={...legacy,sections:[
      {...legacy.sections[0],targets:[{id:'t1',template:'OUT-A'},{id:'t1b',template:'OUT-AUX'}],sources:[{...legacy.sections[0].sources[0],fields:[{id:'f1',param:'Text',targetFields:{t1:['Text','Title'],t1b:'Slug'}}]}]},
      {...legacy.sections[0],id:'section-2',name:'Second titles',targets:[{id:'t2',template:'OUT-B'}],sources:[{...legacy.sections[0].sources[0],id:'src-2',template:'SECOND-MOS',fields:[{id:'f2',param:'Text',targetFields:{t2:'Text'}}]}]},
    ]}
    const base=normalizeMosProjects(mappings)
    const source=base.projects.find(project=>project.id===base.activeProjectId)!
    const interactions=[
      {id:'rule-1',name:'Play second',enabled:true,triggerSectionId:'legacy-section',event:'before-play' as const,actions:[{id:'action-1',kind:'play' as const,sectionId:'section-2',targetId:'t2',delayMs:175}]},
      {id:'rule-2',name:'Restore first',enabled:false,triggerSectionId:'section-2',event:'before-play' as const,actions:[{id:'action-2',kind:'suspend' as const,sectionId:'legacy-section',delayMs:25,restoreOn:'any-exit' as const}]},
    ]
    const sourceWithRules={...source,interactions}
    const before=JSON.parse(JSON.stringify(sourceWithRules))
    const copy=duplicateMosProject(sourceWithRules,'Morning edition',makeIdFactory())

    expect(copy).toMatchObject({id:'duplicate-1',name:'Morning edition',kind:'standalone'})
    expect(copy.mode).toBe('csv')
    expect(copy.mappings.sections.map(section=>section.name)).toEqual(['Old titles','Second titles'])
    expect(copy.mappings.sections[0]?.targets.map(target=>target.template)).toEqual(['OUT-A','OUT-AUX'])
    expect(copy.mappings.sections[0]?.sources[0]).toMatchObject({template:'OLD-MOS',exitMode:'manual-resume',durationSeconds:6})
    const [sectionOne,sectionTwo]=copy.mappings.sections
    expect(sectionOne?.sources[0]?.fields[0]?.targetFields).toEqual({[sectionOne!.targets[0]!.id]:['Text','Title'],[sectionOne!.targets[1]!.id]:'Slug'})
    expect(copy.interactions).toEqual([
      {id:'duplicate-11',name:'Play second',enabled:true,triggerSectionId:sectionOne?.id,event:'before-play',actions:[{id:'duplicate-12',kind:'play',sectionId:sectionTwo?.id,targetId:sectionTwo?.targets[0]?.id,delayMs:175}]},
      {id:'duplicate-13',name:'Restore first',enabled:false,triggerSectionId:sectionTwo?.id,event:'before-play',actions:[{id:'duplicate-14',kind:'suspend',sectionId:sectionOne?.id,delayMs:25,restoreOn:'any-exit'}]},
    ])
    expect(validateMosProjects({...base,projects:[...base.projects,copy]}).projects.at(-1)).toEqual(copy)
    expect(sourceWithRules).toEqual(before)
    expect(copy.mappings.sections).not.toBe(sourceWithRules.mappings.sections)
    expect(copy.mappings.sections[0]?.targets).not.toBe(sourceWithRules.mappings.sections[0]?.targets)
    expect(copy.mappings.sections[0]?.sources[0]?.fields[0]?.targetFields).not.toBe(sourceWithRules.mappings.sections[0]?.sources[0]?.fields[0]?.targetFields)
    expect(copy.mappings.sections[0]?.sources[0]?.fields[0]?.targetFields[sectionOne!.targets[0]!.id]).not.toBe(sourceWithRules.mappings.sections[0]?.sources[0]?.fields[0]?.targetFields.t1)
    expect(copy.interactions?.[0]?.actions).not.toBe(sourceWithRules.interactions?.[0]?.actions)
  })


  it('persists a duplicated project and reordered sections without changing the active project',()=>{
    const {store}=storeAtTemp()
    const base=normalizeMosProjects({...legacy,sections:[...legacy.sections,{...legacy.sections[0],id:'section-2',name:'Second titles',targets:[{id:'t2',template:'OUT-B'}],sources:[{...legacy.sections[0].sources[0],id:'src-2',template:'SECOND-MOS',fields:[{id:'f2',param:'Text',targetFields:{t2:'Text'}}]}]}]})
    const activeProjectId=base.activeProjectId
    const source=base.projects.find(project=>project.id===base.activeProjectId)!
    const duplicate=duplicateMosProject(source,'Copy',makeIdFactory())
    duplicate.mappings.sections.reverse()
    const config={...base,projects:[...base.projects,duplicate]}
    store.setSetting('mosMappings',config)
    const saved=normalizeMosProjects(store.getSetting('mosMappings'))
    expect(saved.activeProjectId).toBe(activeProjectId)
    expect(saved.projects.at(-1)?.mappings.sections.map(section=>section.name)).toEqual(['Second titles','Old titles'])
    expect(saved.projects.at(-1)).toEqual(duplicate)
  })

  it('rejects a mapping edit that would orphan an interaction reference',()=>{
    const mappings={...legacy,sections:[...legacy.sections,{...legacy.sections[0],id:'section-2',name:'Second titles',targets:[{id:'t2',template:'OUT-B'}],sources:[{...legacy.sections[0].sources[0],id:'src-2',template:'SECOND-MOS',fields:[{id:'f2',param:'Text',targetFields:{t2:'Text'}}]}]}]}
    const base=normalizeMosProjects(mappings)
    const interactions=[{id:'rule-1',name:'Stop together',enabled:false,triggerSectionId:'legacy-section',event:'after-stop' as const,actions:[{id:'action-1',kind:'stop' as const,sectionId:'section-2',delayMs:0}]}]
    const configured={...base,projects:base.projects.map(project=>project.id===base.activeProjectId?{...project,interactions}:project)}
    expect(()=>setActiveProjectMappings(configured,{version:1,sections:[]})).toThrow(/invalidReference/)
  })

  it('allows deleting every project and rejects an unknown active id',()=>{
    const base=normalizeMosProjects(legacy)
    expect(validateMosProjects({version:2,activeProjectId:'',projects:[]})).toEqual({version:2,activeProjectId:'',projects:[]})
    expect(()=>validateMosProjects({...base,activeProjectId:'missing'})).toThrow(/must exist/)
  })

  it('converts old fixed project kinds to editable standalone projects',()=>{
    const old={version:2,activeProjectId:builtinRetrospectivaProjectId,projects:[
      {id:builtinTelejurnalProjectId,name:'Telejurnal',kind:'telejurnal',mappings:legacy},
      {id:builtinRetrospectivaProjectId,name:'Retrospectiva săptămânii',kind:'retrospectiva',mappings:{version:1,sections:[]}},
    ]}
    expect(validateMosProjects(old).projects).toMatchObject([
      {id:builtinTelejurnalProjectId,kind:'standalone',mode:'plasma'},
      {id:builtinRetrospectivaProjectId,kind:'standalone',mode:'plasma'},
    ])
  })

  it('exports and imports complete projects as independent copies with fresh IDs',()=>{
    const base=normalizeMosProjects(legacy)
    const source=base.projects[0]!
    const file=exportMosProjectFile(source)
    const imported=importMosProjectFile(file,makeIdFactory())
    expect(imported).toMatchObject({name:source.name,kind:'standalone',mode:'plasma'})
    expect(imported.id).not.toBe(source.id)
    expect(imported.mappings.sections[0]?.id).not.toBe(source.mappings.sections[0]?.id)
    expect(()=>importMosProjectFile('{bad json}',makeIdFactory())).toThrow(/Invalid MOS project file/)
  })

  it('keeps corrupt project data visible as an error and preserves it on unrelated writes',()=>{
    const {dir,store}=storeAtTemp()
    const corrupt={version:2,activeProjectId:'bad',projects:[]}
    const file=path.join(dir,'settings.json')
    writeFileSync(file,JSON.stringify({language:'ro',mosMappings:corrupt}), 'utf8')
    expect(()=>store.getSetting('mosMappings')).toThrow(/active MOS project must exist/)
    store.setSetting('language','en')
    expect(JSON.parse(readFileSync(file,'utf8')).mosMappings).toEqual(corrupt)
  })
})
