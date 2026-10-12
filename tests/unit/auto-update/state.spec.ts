import { describe, expect, it } from 'vitest'
import { initialUpdateViewState, reduceUpdateState } from '../../../src/features/update/state'

describe('update state mapping', () => {
  it('maps availability events to an available update state', () => {
    const nextState = reduceUpdateState(initialUpdateViewState, {
      type: 'availability-changed',
      payload: {
        update: true,
        version: '1.0.0',
        newVersion: '1.1.0',
      },
    })

    expect(nextState.modalOpen).toBe(true)
    expect(nextState.updateAvailable).toBe(true)
    expect(nextState.readyToInstall).toBe(false)
    expect(nextState.versionInfo?.newVersion).toBe('1.1.0')
  })

  it('maps download progress events to progress state', () => {
    const nextState = reduceUpdateState(initialUpdateViewState, {
      type: 'download-progress',
      payload: {
        percent: 42,
      } as never,
    })

    expect(nextState.modalOpen).toBe(true)
    expect(nextState.progressInfo?.percent).toBe(42)
  })

  it('maps error events to an error state', () => {
    const nextState = reduceUpdateState(initialUpdateViewState, {
      type: 'error',
      payload: {
        message: 'Network error',
        error: new Error('Network error'),
      },
    })

    expect(nextState.modalOpen).toBe(true)
    expect(nextState.updateAvailable).toBe(false)
    expect(nextState.updateError?.message).toBe('Network error')
  })

  it('maps downloaded events to install-ready state', () => {
    const nextState = reduceUpdateState(initialUpdateViewState, {
      type: 'downloaded',
    })

    expect(nextState.modalOpen).toBe(true)
    expect(nextState.readyToInstall).toBe(true)
    expect(nextState.progressInfo?.percent).toBe(100)
  })
})
