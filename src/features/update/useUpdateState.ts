import type { ProgressInfo } from 'electron-updater'
import { useEffect, useState } from 'react'
import type { UpdateErrorPayload, UpdateStateEvent, VersionInfo } from '@/shared/types/update'
import { initialUpdateViewState, reduceUpdateState } from './state'

interface UpdateState {
  checking: boolean
  modalOpen: boolean
  readyToInstall: boolean
  updateAvailable: boolean
  versionInfo?: VersionInfo
  updateError?: UpdateErrorPayload
  progressInfo?: Partial<ProgressInfo>
  checkForUpdates: () => Promise<void>
  closeModal: () => void
  confirmAction: () => Promise<void>
}

export function useUpdateState(): UpdateState {
  const [checking, setChecking] = useState(false)
  const [state, setState] = useState(initialUpdateViewState)

  useEffect(() => {
    const unsubscribe = window.updateApi.onStateChange((event) => {
      setState((currentState) => reduceUpdateState(currentState, event))
    })

    return () => {
      unsubscribe()
    }
  }, [])

  return {
    checking,
    modalOpen: state.modalOpen,
    readyToInstall: state.readyToInstall,
    updateAvailable: state.updateAvailable,
    versionInfo: state.versionInfo,
    updateError: state.updateError,
    progressInfo: state.progressInfo,
    async checkForUpdates() {
      setChecking(true)
      const result = await window.updateApi.checkForUpdates()
      setState((currentState) => ({
        ...currentState,
        modalOpen: true,
        progressInfo: { percent: 0 },
      }))
      setChecking(false)

      if ((result as { error?: Error }).error) {
        setState((currentState) => ({
          ...currentState,
          updateAvailable: false,
          updateError: result as UpdateErrorPayload,
        }))
      }
    },
    closeModal() {
      setState((currentState) => ({
        ...currentState,
        modalOpen: false,
      }))
    },
    async confirmAction() {
      if (state.readyToInstall) {
        await window.updateApi.quitAndInstall()
        return
      }

      await window.updateApi.downloadUpdate()
    },
  }
}
