import type { LiveBoardConnectionSnapshot } from './connection'
import type { MosProjectKind, MosProjectMode } from '../settings/mosProjects'
import type { LiveBoardSettingsDenialCode } from '../ipc/contracts'

export type LiveBoardSectionState = 'OFF' | 'ON_A' | 'ON_B' | 'ON_SINGLE' | 'SUSPENDED' | 'NEEDS_RESYNC'
export type LiveBoardBuffer = 'A' | 'B' | 'single'
export type LiveBoardExecutionStatus = 'queued' | 'running' | 'completed' | 'noop' | 'blocked' | 'failed'
export type LiveBoardConfirmation = 'simulated' | 'protocol-acknowledged' | 'unconfirmed'

export interface LiveBoardStep {
  kind: 'set-field' | 'wait-data' | 'resume' | 'wait-transition' | 'play' | 'stop' | 'suspend'
  state: 'pending' | 'running' | 'completed' | 'failed'
  template?: string
  targetId?: string
  buffer?: LiveBoardBuffer
  field?: string
  value?: string
  ms?: number
  command?: string
  response?: string
  error?: string
  timestamp?: string
  interactionRuleName?: string
  interactionAction?: 'resume' | 'stop' | 'suspend' | 'play'
  sourceSectionId?: string
  sourceSectionName?: string
  affectedSectionId?: string
  affectedSectionName?: string
  provenance?: 'manual' | 'interaction' | 'auto-exit' | 'resume' | 'stop'
}
export interface LiveBoardExecutionReport {
  operationId?: string
  origin?: 'mos-play' | 'manual' | 'interaction' | 'auto-exit'
  projectId?: string
  projectName?: string
  projectKind?: MosProjectKind
  status: LiveBoardExecutionStatus
  mode: 'simulation' | 'tcp'
  sectionId: string | null
  sectionName: string | null
  sourceTemplate: string
  beforeState: LiveBoardSectionState | null
  afterState: LiveBoardSectionState | null
  selectedTargetId: string | null
  selectedBuffer: LiveBoardBuffer | null
  previousTargetId: string | null
  nextBuffer: LiveBoardBuffer | null
  steps: LiveBoardStep[]
  error: string | null
  confirmation: LiveBoardConfirmation
  interactionRuleName?: string
  interactionSourceSectionId?: string
  autoExitSourceTemplate?: string
}
export interface LiveBoardBufferSnapshot { id: string; template: string; buffer: LiveBoardBuffer; fields: Record<string, string> | null }
export interface LiveBoardSectionSnapshot {
  sectionId: string
  name: string
  state: LiveBoardSectionState
  activeTargetId: string | null
  activeBuffer: LiveBoardBuffer | null
  busy: boolean
  buffers: LiveBoardBufferSnapshot[]
  sourceTemplate: string | null
  exitMode?: 'manual-resume' | 'template-duration' | null
  error: string | null
  confirmation: LiveBoardConfirmation | null
  suspendedBy?: { sectionId: string; sectionName: string; template: string } | null
  pendingRestore?: boolean
  pendingTemplate?: string | null
}
export interface LiveBoardProjectSummary { id:string; name:string; kind:MosProjectKind; mode:MosProjectMode }
export interface LiveBoardSnapshot { connection: LiveBoardConnectionSnapshot; activeProject:LiveBoardProjectSummary; projects:LiveBoardProjectSummary[]; sections: LiveBoardSectionSnapshot[]; operations: LiveBoardExecutionReport[] }
export type LiveBoardResyncState = 'OFF' | 'A' | 'B' | 'single'
export type ProjectActivationResult = {ok:true;value:LiveBoardSnapshot}|{ok:false;error:{code:LiveBoardSettingsDenialCode|'LIVEBOARD_PROJECT_NOT_FOUND';sectionNames:string[]}}
export type LiveBoardStopAllResult = {snapshot:LiveBoardSnapshot;stopped:number;failedSectionIds:string[]}

export interface LiveBoardApi {
  getSnapshot(): Promise<LiveBoardSnapshot>
  onSnapshot(listener: (snapshot: LiveBoardSnapshot) => void): () => void
  connect(): Promise<LiveBoardSnapshot>
  disconnect(): Promise<LiveBoardSnapshot>
  takeOutSection(sectionId: string): Promise<LiveBoardSnapshot>
  stopSection(sectionId: string): Promise<LiveBoardSnapshot>
  stopAllProjectSections(projectId: string): Promise<LiveBoardStopAllResult>
  resyncSection(sectionId: string, state: LiveBoardResyncState): Promise<LiveBoardSnapshot>
  setActiveProject(projectId:string):Promise<ProjectActivationResult>
}
export const liveBoardInvokeChannels = { getSnapshot:'liveboard:get-snapshot', connect:'liveboard:connect', disconnect:'liveboard:disconnect', takeOut:'liveboard:take-out', stop:'liveboard:stop', stopAll:'liveboard:stop-all', resync:'liveboard:resync', setActiveProject:'liveboard:set-active-project' } as const
export const liveBoardEventChannels = { snapshot:'liveboard:snapshot' } as const
