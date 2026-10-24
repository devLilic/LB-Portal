import type { MosProjectKind } from '../settings/mosProjects'
import type { LiveBoardExecutionReport } from '../liveboard/runtime'
import type { OnAirGraphicKind } from './mappings'
export type { OnAirDefaultTemplates, OnAirGraphicFieldMapping, OnAirGraphicKind, OnAirGraphicMapping, OnAirGraphicMappingIssue, OnAirGraphicResolution } from './mappings'

export interface OnAirCsvSource {
  format: 'pa-csv'
  folderPath: string
  filePrefix?: string
}

export interface OnAirProjectSummary {
  id: string
  name: string
  kind: MosProjectKind
  folderPath: string | null
}

export interface OnAirItemSource {
  file: string
  record: number
  line: number
}

export interface OnAirItem {
  id: string
  source: OnAirItemSource
}

export interface OnAirTitle extends OnAirItem {
  nr: string
  title: string
  supratitle: string
  template: string
}

export interface OnAirPerson extends OnAirItem {
  name: string
  role: string
  template: string
}

export interface OnAirLocation extends OnAirItem {
  location: string
  template: string
}

export interface OnAirPhone extends OnAirItem {
  name: string
  role: string
  imagePath: string
  template: string
}

export type OnAirGroupKind = 'beta' | 'invited' | 'ungrouped' | 'other'

export interface OnAirGroup {
  id: string
  name: string
  kind: OnAirGroupKind
  titles: OnAirTitle[]
  persons: OnAirPerson[]
  locations: OnAirLocation[]
  phones: OnAirPhone[]
}

export interface OnAirSnapshot {
  projectId: string
  folderPath: string
  loadedAt: string
  groups: OnAirGroup[]
}

export type OnAirErrorCode =
  | 'NOT_CONFIGURED'
  | 'PROJECT_NOT_FOUND'
  | 'READ_FAILED'
  | 'INVALID_CSV'
  | 'FILES_CHANGED'
  | 'SOURCE_CHANGED'
  | 'SETTINGS_INVALID'

export interface OnAirError {
  code: OnAirErrorCode
  file?: string
  record?: number
  detail?: string
}

export interface OnAirState {
  projectId: string
  folderPath: string | null
  snapshot: OnAirSnapshot | null
  error: OnAirError | null
  busy: boolean
}

export interface OnAirPlaybackRequest {
  projectId: string
  kind: OnAirGraphicKind
  itemId: string
  sourceTemplate: string
  values: Record<string, string>
  action: 'play' | 'resume'
}

export interface OnAirPlaybackResult {
  itemId: string
  kind: OnAirGraphicKind
  sourceTemplate: string
  execution: LiveBoardExecutionReport
}

export interface OnAirApi {
  listProjects(): Promise<OnAirProjectSummary[]>
  chooseFolder(): Promise<string | null>
  getSnapshot(projectId: string): Promise<OnAirState>
  refresh(projectId: string): Promise<OnAirState>
  playItem(request: OnAirPlaybackRequest): Promise<OnAirPlaybackResult>
}

export const onAirInvokeChannels = {
  listProjects: 'onair:list-projects',
  chooseFolder: 'onair:choose-folder',
  getSnapshot: 'onair:get-snapshot',
  refresh: 'onair:refresh',
  playItem: 'onair:play-item',
} as const
