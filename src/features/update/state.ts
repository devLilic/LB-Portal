import type { ProgressInfo } from 'electron-updater'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from '@/shared/types/update'

export interface UpdateViewState {
  modalOpen: boolean
  readyToInstall: boolean
  updateAvailable: boolean
  versionInfo?: VersionInfo
  updateError?: UpdateErrorPayload
  progressInfo?: Partial<ProgressInfo>
}

export const initialUpdateViewState: UpdateViewState = {
  modalOpen: false,
  readyToInstall: false,
  updateAvailable: false,
}

export function reduceUpdateState(
  state: UpdateViewState,
  event: UpdateStateEvent,
): UpdateViewState {
  switch (event.type) {
    case 'availability-changed':
      return {
        ...state,
        modalOpen: true,
        readyToInstall: false,
        updateAvailable: event.payload.update,
        versionInfo: event.payload,
        updateError: undefined,
      }
    case 'download-progress':
      return {
        ...state,
        modalOpen: true,
        progressInfo: event.payload,
      }
    case 'error':
      return {
        ...state,
        modalOpen: true,
        updateAvailable: false,
        updateError: event.payload,
      }
    case 'downloaded':
      return {
        ...state,
        modalOpen: true,
        readyToInstall: true,
        progressInfo: { percent: 100 },
      }
  }
}
