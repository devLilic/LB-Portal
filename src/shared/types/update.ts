export interface VersionInfo {
  update: boolean
  version: string
  newVersion?: string
}

export interface UpdateErrorPayload {
  message: string
  error: Error
}

export type UpdateStateEvent =
  | {
    type: 'availability-changed'
    payload: VersionInfo
  }
  | {
    type: 'download-progress'
    payload: import('electron-updater').ProgressInfo
  }
  | {
    type: 'error'
    payload: UpdateErrorPayload
  }
  | {
    type: 'downloaded'
  }
