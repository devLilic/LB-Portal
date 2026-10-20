import { getMosTargetFields, type MosMappingConfig } from '../settings/mosMappings'
import { normalizeMosProjects, type MosMappingSettings, type MosProjectKind } from '../settings/mosProjects'

export type MosMappingResolution =
  | { status: 'matched'; template: string; commandType?: 'mos-play' | 'mos-resume'; project: { id:string; name:string; kind:MosProjectKind }; section: { id: string; name: string }; targets: Array<{ id: string; template: string; fields: Array<{ param: string; fields: string[]; value: string | null }> }>; exitMode: 'manual-resume' | 'template-duration'; durationSeconds: number; resumePlayDelayMs: number; dataPropagationDelayMs:number; missingParams: string[]; unmappedParams: string[] }
  | { status: 'project-disabled'; template: string; project: { id:string; name:string; kind:MosProjectKind } }
  | { status: 'unmapped' | 'invalid-request'; template: string | null; project?:{id:string;name:string;kind:MosProjectKind} }
  | { status: 'settings-error'; template: string | null }

export function resolveMosMapping(body: Record<string, unknown>, saved: MosMappingSettings): MosMappingResolution {
  const template = body.template
  let config:ReturnType<typeof normalizeMosProjects>
  try{config=normalizeMosProjects(saved)}catch{return {status:'settings-error',template:typeof template==='string'?template:null}}
  const project=config.projects.find(item=>item.id===config.activeProjectId)!
  const projectInfo={id:project.id,name:project.name,kind:project.kind}
  if (typeof template !== 'string' || !template.trim()) return { status: 'invalid-request', template: typeof template === 'string' ? template : null,project:projectInfo }
  const isResume = body.type === 'mos-resume'
  const rawParams = body.params
  if (!isResume && rawParams !== undefined && (!isRecord(rawParams) || Object.entries(rawParams).some(([param, value]) => !param.trim() || typeof value !== 'string'))) {
    return { status: 'invalid-request', template,project:projectInfo }
  }
  const params = (isResume ? {} : rawParams ?? {}) as Record<string, string>
  if(project.kind==='standalone')return {status:'project-disabled',template,project:projectInfo}
  const mappings: MosMappingConfig=project.mappings
  const section = mappings.sections.find(item => item.sources.some(source => source.template === template))
  const source = section?.sources.find(item => item.template === template)
  if (!section || !source) return { status: 'unmapped', template,project:projectInfo }
  const mappedParams = new Set(source.fields.filter(field => section.targets.some(target => getMosTargetFields(field.targetFields[target.id]).length > 0)).map(field => field.param))
  return {
    status: 'matched', template, ...(body.type === 'mos-play' || isResume ? { commandType: body.type as 'mos-play' | 'mos-resume' } : {}), project:{id:project.id,name:project.name,kind:project.kind},
    section: { id: section.id, name: section.name },
    targets: section.targets.map(target => ({
      id: target.id, template: target.template,
      fields: source.fields.map(field => ({ param: field.param, fields: getMosTargetFields(field.targetFields[target.id]), value: Object.hasOwn(params, field.param) ? params[field.param]! : null })),
    })),
    exitMode: source.exitMode, durationSeconds: source.durationSeconds, resumePlayDelayMs: section.resumePlayDelayMs, dataPropagationDelayMs:section.dataPropagationDelayMs??250,
    missingParams: isResume ? [] : [...new Set(source.fields.filter(field => section.targets.some(target => getMosTargetFields(field.targetFields[target.id]).length > 0) && !Object.hasOwn(params, field.param)).map(field => field.param))],
    unmappedParams: isResume ? [] : Object.keys(params).filter(param => !mappedParams.has(param)),
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
