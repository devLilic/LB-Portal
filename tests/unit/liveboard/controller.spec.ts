import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import { emptyMosMappingConfig, type MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import { defaultMosProjects } from '../../../src/shared/settings/mosProjects'
import { guardLiveBoardSetting } from '../../../electron/main/liveboard/settingsGuard'
import { LiveBoardSettingsGuardError } from '../../../electron/main/liveboard/settingsGuard'
import { resolveMosMapping } from '../../../src/shared/ingress/mosMappingResolution'

const mapping: MosMappingConfig = { ...emptyMosMappingConfig, sections:[{id:'s',name:'Headlines',targets:[{id:'a',template:'LB-A'},{id:'b',template:'LB-B'}],resumePlayDelayMs:0,dataPropagationDelayMs:0,sources:[{id:'src',template:'MOS',exitMode:'manual-resume',durationSeconds:6,fields:[{id:'f1',param:'Title',targetFields:{a:'Headline',b:'Headline'}},{id:'f2',param:'strap',targetFields:{a:'Strap',b:'Strap'}}]}]}] }
const connection={mode:'simulation' as const,host:'127.0.0.1',port:null,timeoutMs:1000}

afterEach(() => vi.useRealTimers())

async function executeWithFakeTimers(controller:LiveBoardController,request:Parameters<LiveBoardController['execute']>[0]){
  const pending=controller.execute(request)
  if(vi.isFakeTimers())await vi.advanceTimersByTimeAsync(0)
  return pending
}

describe('LiveBoard controller',()=>{
  it('reports the six-second simulated automatic duration and zero after local expiry',async()=>{
    vi.useFakeTimers()
    const timedMapping:MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,sources:section.sources.map(source=>({...source,exitMode:'template-duration' as const,durationSeconds:6}))}))}
    const receipt=resolveMosMapping({type:'mos-play',template:'MOS',params:{Title:'simulated',strap:'s'}},timedMapping)
    const c=new LiveBoardController(connection,timedMapping)
    try{
      const report=await executeWithFakeTimers(c,{requestId:'simulated-duration',template:'MOS',mapping:receipt})

      expect(report.status).toBe('completed')
      expect(report.confirmation).toBe('simulated')
      expect(c.getAutomaticDurationForRequest('simulated-duration',report,receipt)).toMatchObject({automaticDurationSeconds:6,remainingDurationMs:6000})

      await vi.advanceTimersByTimeAsync(6000)
      await vi.advanceTimersByTimeAsync(0)

      expect(c.snapshot.sections[0]?.state).toBe('OFF')
      expect(c.getAutomaticDurationForRequest('simulated-duration',report,receipt)).toEqual({automaticDurationSeconds:6,remainingDurationMs:0})
    }finally{c.dispose()}
  })
  it('alternates A/B/A with complete values and preserves hidden buffer contents',async()=>{
    const c=new LiveBoardController(connection,mapping)
    const a=await c.execute({requestId:'1',template:'MOS',params:{Title:'first',strap:'s1'}})
    expect(a.steps.filter(s=>s.kind==='set-field').map(s=>s.value)).toEqual(['first','s1'])
    expect(c.snapshot.sections[0].state).toBe('ON_A')
    await c.execute({requestId:'2',template:'MOS',params:{Title:'second',strap:'s2'}})
    expect(c.snapshot.sections[0].state).toBe('ON_B')
    const third=await c.execute({requestId:'3',template:'MOS',params:{Title:'third',strap:'s3'}})
    expect(c.snapshot.sections[0].state).toBe('ON_A')
    expect(c.snapshot.sections[0].buffers.find(b=>b.id==='a')?.fields).toEqual({Headline:'third',Strap:'s3'})
    expect(third.steps.map(s=>s.kind)).toEqual(['set-field','set-field','wait-data','resume','wait-transition','play'])
  })
  it('blocks missing mapped values before writes and no-ops identical active values',async()=>{
    const c=new LiveBoardController(connection,mapping)
    const blocked=await c.execute({requestId:'bad',template:'MOS',params:{Title:''}})
    expect(blocked.status).toBe('blocked');expect(blocked.steps).toHaveLength(0)
    const params={Title:'',strap:'x'}
    expect((await c.execute({requestId:'one',template:'MOS',params})).status).toBe('completed')
    expect((await c.execute({requestId:'two',template:'MOS',params})).status).toBe('noop')
  })
  it('writes one source value to several destination fields and ignores unmapped source fields',async()=>{
    const fanout: MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,sources:section.sources.map(source=>({...source,fields:[
      {id:'title',param:'Title',targetFields:{a:['Headline','Headline_M'],b:['Headline','Headline_M']}},
      {id:'strap',param:'strap',targetFields:{a:['Strap'],b:['Strap']}},
      {id:'ignored',param:'Unused',targetFields:{a:[],b:[]}},
    ]}))}))}
    const c=new LiveBoardController(connection,fanout)
    const report=await c.execute({requestId:'fanout',template:'MOS',params:{Title:'same',strap:'lower'}})
    expect(report.status).toBe('completed')
    expect(report.steps.filter(step=>step.kind==='set-field').map(step=>[step.field,step.value])).toEqual([['Headline','same'],['Headline_M','same'],['Strap','lower']])
    expect(c.snapshot.sections[0]!.buffers[0]!.fields).toEqual({Headline:'same',Headline_M:'same',Strap:'lower'})
  })
  it('executes repeated source-param rows from a receipt snapshot as one value fan-out',async()=>{
    const repeated: MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,sources:section.sources.map(source=>({...source,fields:[
      {id:'title-main',param:'Title',targetFields:{a:['Headline'],b:['Headline']}},
      {id:'title-copy',param:'Title',targetFields:{a:['Headline_M'],b:['Headline_M']}},
    ]}))}))}
    const c=new LiveBoardController(connection,repeated)
    const receipt=resolveMosMapping({type:'mos-play',template:'MOS',params:{Title:'same'}},repeated)
    const report=await c.execute({requestId:'repeated-param',template:'MOS',mapping:receipt})
    expect(report.status).toBe('completed')
    expect(report.steps.filter(step=>step.kind==='set-field').map(step=>[step.field,step.value])).toEqual([['Headline','same'],['Headline_M','same']])
  })
  it('deduplicates identical request ids and blocks conflicting reuse',async()=>{
    const c=new LiveBoardController(connection,mapping);const req={requestId:'same',template:'MOS',params:{Title:'v',strap:'s'}}
    const first=await c.execute(req);expect(await c.execute(req)).toEqual(first)
    expect((await c.execute({...req,params:{Title:'other',strap:'s'}})).status).toBe('blocked')
  })
  it('preserves exact special field names such as __proto__',async()=>{
    const special: MosMappingConfig={...mapping,sections:mapping.sections.map(s=>({...s,sources:s.sources.map(source=>({...source,fields:[{id:'special',param:'p',targetFields:{a:'__proto__',b:'__proto__'}}]}))}))}
    const c=new LiveBoardController(connection,special)
    await c.execute({requestId:'special',template:'MOS',params:{p:'exact'}})
    const fields=c.snapshot.sections[0]!.buffers[0]!.fields!
    expect(Object.hasOwn(fields,'__proto__')).toBe(true)
    expect(fields['__proto__']).toBe('exact')
  })
  it('blocks a receipt-time settings error without sending commands',async()=>{
    const c=new LiveBoardController(connection,mapping)
    const report=await c.execute({requestId:'settings-error',template:'MOS',mapping:{status:'settings-error',template:'MOS'}})
    expect(report.status).toBe('blocked')
    expect(report.steps).toHaveLength(0)
    expect(c.snapshot.sections[0]!.state).toBe('OFF')
  })
  it('plays graphic-only mappings without setters when params are omitted',async()=>{
    const graphic: MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,targets:[section.targets[0]!],sources:[{id:'g',template:'Graphic',exitMode:'manual-resume',durationSeconds:6,fields:[]}]}))}
    const c=new LiveBoardController(connection,graphic)
    const report=await c.execute({requestId:'graphic',template:'Graphic',mapping:{status:'matched',template:'Graphic',project:{id:'migrated-legacy-project',name:'Proiect migrat',kind:'standalone',mode:'plasma'},section:{id:'s',name:'Headlines'},targets:[{id:'a',template:'LB-A',fields:[]}],exitMode:'manual-resume',durationSeconds:6,resumePlayDelayMs:0,dataPropagationDelayMs:0,missingParams:[],unmappedParams:[]}})
    expect(report.status).toBe('completed')
    expect(report.steps.map(step=>step.kind)).toEqual(['wait-data','play'])
  })
  it('resumes a Plasma source through its mapped active buffer and confirms OFF',async()=>{
    const durationMapping: MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,sources:section.sources.map(source=>({...source,exitMode:'template-duration' as const}))}))}
    const c=new LiveBoardController(connection,durationMapping)
    const receipt={status:'matched' as const,template:'MOS',project:{id:'migrated-legacy-project',name:'Proiect migrat',kind:'standalone' as const,mode:'plasma' as const},section:{id:'s',name:'Headlines'},targets:[{id:'a',template:'LB-A',fields:[{param:'Title',fields:['Headline'],value:'Title'},{param:'strap',fields:['Strap'],value:'strap'}]},{id:'b',template:'LB-B',fields:[{param:'Title',fields:['Headline'],value:'Title'},{param:'strap',fields:['Strap'],value:'strap'}]}],exitMode:'template-duration' as const,durationSeconds:6,resumePlayDelayMs:0,dataPropagationDelayMs:0,missingParams:[],unmappedParams:[]}
    await c.execute({requestId:'live-title',template:'MOS',params:{Title:'Title',strap:'strap'}})
    expect(c.snapshot.sections[0]!.state).toBe('ON_A')
    const resumed=await c.resumeSource('MOS',receipt)
    expect(resumed.status).toBe('completed')
    expect(resumed.afterState).toBe('OFF')
    expect(c.snapshot.sections[0]!.state).toBe('OFF')
    expect(c.snapshot.operations.at(-1)?.steps[0]?.command?.trim()).toBe('LBC_RESUMECONTENT "LB-A"')
  })
  it('takes the current timed template out with a template-only RESUME before playing the next item',async()=>{
    const durationMapping:MosMappingConfig={...mapping,sections:mapping.sections.map(section=>({...section,sources:section.sources.map(source=>({...source,exitMode:'template-duration' as const}))}))}
    const c=new LiveBoardController(connection,durationMapping)
    await c.execute({requestId:'timed-current',template:'MOS',params:{Title:'First',strap:'one'}})
    const next=await c.execute({requestId:'timed-next',template:'MOS',params:{Title:'Second',strap:'two'}})
    expect(next.status).toBe('completed')
    expect(next.steps.find(step=>step.kind==='resume')?.command?.trim()).toBe('LBC_RESUMECONTENT "LB-A"')
    expect(next.steps.find(step=>step.kind==='play')?.command?.trim()).toBe('LBC_PLAYCONTENT "LB-B"')
    expect(next.afterState).toBe('ON_B')
    await c.stop('s')
  })
  it('captures project identity for reports and blocks standalone receipts',async()=>{
    const projects=defaultMosProjects(mapping)
    const direct={id:'direct',name:'Direct operator',kind:'standalone' as const,mappings:emptyMosMappingConfig}
    const config={...projects,activeProjectId:direct.id,projects:[...projects.projects,direct]}
    const c=new LiveBoardController(connection,config)
    const report=await c.execute({requestId:'disabled',template:'MOS',mapping:{status:'project-disabled',template:'MOS',project:{id:direct.id,name:direct.name,kind:direct.kind}}})
    expect(report.status).toBe('blocked')
    expect(report.projectId).toBe(direct.id)
    expect(report.projectKind).toBe('standalone')
    expect(report.steps).toHaveLength(0)
    expect(c.snapshot.activeProject).toEqual({id:direct.id,name:direct.name,kind:'standalone',mode:'csv'})
    expect((await c.execute({requestId:'direct-no-map',template:'MOS',params:{Title:'x',strap:'y'}})).status).toBe('blocked')
  })
  it('executes Plasma requests for an explicitly Plasma-enabled custom project',async()=>{
    const projects=defaultMosProjects(mapping)
    const show={id:'weekly-extra',name:'Retrospectiva specială',kind:'standalone' as const,mode:'plasma' as const,mappings:mapping}
    const config={...projects,activeProjectId:show.id,projects:[...projects.projects,show]}
    const c=new LiveBoardController(connection,config)
    const receipt=resolveMosMapping({type:'mos-play',template:'MOS',params:{Title:'Weekly title',strap:'Weekly sub'}},config)
    try{
      const report=await c.execute({requestId:'custom-plasma',template:'MOS',mapping:receipt})
      expect(report.status).toBe('completed')
      expect(report.projectId).toBe(show.id)
      expect(c.snapshot.activeProject).toMatchObject({id:show.id,mode:'plasma'})
    }finally{c.dispose()}
  })
  it('allows an explicit mapped OnAir PLAY in the active standalone project while keeping ordinary requests blocked',async()=>{
    vi.useFakeTimers()
    const projects=defaultMosProjects()
    const direct={id:'direct-onair',name:'Direct OnAir',kind:'standalone' as const,mappings:mapping}
    const config={...projects,activeProjectId:direct.id,projects:[...projects.projects,direct]}
    const c=new LiveBoardController(connection,config)
    const onAirResolution={status:'matched' as const,template:'05_Titlu',project:{id:direct.id,name:direct.name,kind:direct.kind},section:{id:'s',name:'Headlines'},targets:[
      {id:'a',template:'LB-A',fields:[{param:'Titlu',fields:['Headline'],value:'OnAir title'},{param:'Supratitlu',fields:['Strap'],value:''}]},
      {id:'b',template:'LB-B',fields:[{param:'Titlu',fields:['Headline'],value:'OnAir title'},{param:'Supratitlu',fields:['Strap'],value:''}]},
      ],exitMode:'template-duration' as const,durationSeconds:2,resumePlayDelayMs:0,dataPropagationDelayMs:0,missingParams:[],unmappedParams:[]}
    try {
      const report=await executeWithFakeTimers(c,{requestId:'onair-item',template:'05_Titlu',mapping:onAirResolution,allowStandalone:true})
      expect(report.status).toBe('completed')
      expect(report.projectKind).toBe('standalone')
      expect(report.steps.filter(step=>step.kind==='set-field').map(step=>[step.field,step.value])).toEqual([['Headline','OnAir title'],['Strap','']])
      expect(c.snapshot.sections[0]?.state).toBe('ON_A')
      expect(c.snapshot.sections[0]?.exitMode).toBe('template-duration')
      await c.takeOut('s')
      expect(c.snapshot.sections[0]?.state).toBe('ON_A')
      expect((await c.execute({requestId:'ordinary-standalone',template:'MOS',params:{Title:'x'}})).status).toBe('blocked')
      await vi.advanceTimersByTimeAsync(2000)
      await vi.advanceTimersByTimeAsync(0)
      expect(c.snapshot.sections[0]?.state).toBe('OFF')
      expect(c.snapshot.sections[0]?.exitMode).toBeNull()
    } finally { c.dispose() }
  })
  it('resolves OnAir values from B-only fields and rejects stale or mismatched Resume items',async()=>{
    const projects=defaultMosProjects()
    const direct={id:'direct-onair-b',name:'Direct OnAir B',kind:'standalone' as const,mappings:mapping}
    const config={...projects,activeProjectId:direct.id,projects:[...projects.projects,direct]}
    const c=new LiveBoardController(connection,config)
    const makeResolution=(value:string)=>({status:'matched' as const,template:'05_Titlu',project:{id:direct.id,name:direct.name,kind:direct.kind},section:{id:'s',name:'Headlines'},targets:[
      {id:'a',template:'LB-A',fields:[]},
      {id:'b',template:'LB-B',fields:[{param:'Titlu',fields:['HeadlineB'],value}]},
    ],exitMode:'manual-resume' as const,durationSeconds:0,resumePlayDelayMs:0,dataPropagationDelayMs:0,missingParams:[],unmappedParams:[]})
    try {
      const first=await c.execute({requestId:'onair-a',template:'05_Titlu',mapping:makeResolution('first'),allowStandalone:true})
      expect(first.steps.filter(step=>step.kind==='set-field')).toEqual([])
      const next=await c.execute({requestId:'onair-b',template:'05_Titlu',mapping:makeResolution('second'),allowStandalone:true})
      expect(next.steps.filter(step=>step.kind==='set-field').map(step=>[step.field,step.value])).toEqual([['HeadlineB','second']])
      expect(next.afterState).toBe('ON_B')
      const stale=await c.resumeSource('05_Titlu',makeResolution('not active'),true,true)
      expect(stale.status).toBe('blocked')
      const resumed=await c.resumeSource('05_Titlu',makeResolution('second'),true,true)
      expect(resumed.status).toBe('completed')
      expect(resumed.afterState).toBe('OFF')
    } finally { c.dispose() }
  })
  it('requires every section OFF before changing projects and resets to the selected project',async()=>{
    const projects=defaultMosProjects(mapping)
    const c=new LiveBoardController(connection,projects)
    c.installSettingsGuard()
    await c.execute({requestId:'active',template:'MOS',params:{Title:'v',strap:'s'}})
    const second={id:'second-project',name:'Second project',kind:'standalone' as const,mode:'plasma' as const,mappings:emptyMosMappingConfig}
    const switched={...projects,activeProjectId:second.id,projects:[...projects.projects,second]}
    expect(()=>guardLiveBoardSetting('mosMappings',switched)).toThrowError(LiveBoardSettingsGuardError)
    await c.stop('s')
    await new Promise(resolve=>setTimeout(resolve,0))
    guardLiveBoardSetting('mosMappings',switched)
    c.setProjects(switched)
    expect(c.snapshot.activeProject.id).toBe(second.id)
    expect(c.snapshot.sections).toHaveLength(0)
    expect(c.snapshot.projects.map(project=>project.id)).toEqual([projects.activeProjectId,second.id])
  })
  it('allows section reordering while graphics are active and preserves runtime timers',async()=>{
    const second={...mapping.sections[0]!,id:'s2',name:'Second headlines',targets:[{id:'c',template:'LB-C'},{id:'d',template:'LB-D'}],sources:[{...mapping.sections[0]!.sources[0]!,id:'src2',template:'MOS-2',exitMode:'template-duration' as const,durationSeconds:6,fields:[{id:'f3',param:'Title',targetFields:{c:'Headline',d:'Headline'}}]}]}
    const projects=defaultMosProjects({...mapping,sections:[mapping.sections[0]!,second]})
    const c=new LiveBoardController(connection,projects)
    c.installSettingsGuard()
    await c.execute({requestId:'reorder-active',template:'MOS-2',params:{Title:'active'}})
    await new Promise(resolve=>setTimeout(resolve,0))
    expect(c.snapshot.sections.map(section=>section.sectionId)).toEqual(['s','s2'])
    expect(c.snapshot.sections.find(section=>section.sectionId==='s2')?.state).toBe('ON_A')
    const runtimeState=c as unknown as {runtimes:Map<string,{timerExpiresAt:number|null}>}
    const expiryBefore=runtimeState.runtimes.get('s2')?.timerExpiresAt
    const reordered={...projects,projects:projects.projects.map(project=>project.id===projects.activeProjectId?{...project,mappings:{...project.mappings,sections:[...project.mappings.sections].reverse()}}:project)}

    expect(()=>guardLiveBoardSetting('mosMappings',reordered)).not.toThrow()
    c.setProjects(reordered)

    expect(c.snapshot.sections.map(section=>section.sectionId)).toEqual(['s2','s'])
    expect(c.snapshot.sections[0]?.state).toBe('ON_A')
    expect(c.snapshot.sections[0]?.buffers[0]?.fields).toEqual({Headline:'active'})
    expect(runtimeState.runtimes.get('s2')?.timerExpiresAt).toBe(expiryBefore)
    c.dispose()
  })
  it('scopes request id deduplication to the captured project',async()=>{
    const projects=defaultMosProjects(mapping)
    const retrospective={id:'second-project',name:'Second project',kind:'standalone' as const,mode:'plasma' as const,mappings:mapping}
    const both={...projects,projects:[...projects.projects,retrospective]}
    const c=new LiveBoardController(connection,both)
    const request={requestId:'reused',template:'MOS',params:{Title:'same',strap:'same'}}
    expect((await c.execute(request)).projectId).toBe(projects.activeProjectId)
    await c.stop('s')
    c.setProjects({...both,activeProjectId:retrospective.id})
    const second=await c.execute(request)
    expect(second.status).toBe('completed')
    expect(second.projectId).toBe(retrospective.id)
  })
})
