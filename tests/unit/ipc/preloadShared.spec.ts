import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ipcEventChannels, ipcInvokeChannels } from '../../../src/shared/ipc/contracts'

const on = vi.fn()
const off = vi.fn()
const invokeRenderer = vi.fn()

vi.mock('electron', () => ({
  ipcRenderer: {
    on,
    off,
    invoke: invokeRenderer,
  },
}))

describe('preload ipc mapping helpers', () => {
  beforeEach(() => {
    on.mockReset()
    off.mockReset()
    invokeRenderer.mockReset()
  })

  it('subscribes and unsubscribes payload listeners using the declared event channel', async () => {
    const { subscribe } = await import('../../../electron/preload/modules/shared')
    const listener = vi.fn()

    const unsubscribe = subscribe(ipcEventChannels.updateAvailabilityChanged, listener)

    expect(on).toHaveBeenCalledTimes(1)
    expect(on.mock.calls[0][0]).toBe(ipcEventChannels.updateAvailabilityChanged)

    const wrappedListener = on.mock.calls[0][1]
    wrappedListener({}, { update: true, version: '1.0.0', newVersion: '1.1.0' })

    expect(listener).toHaveBeenCalledWith({
      update: true,
      version: '1.0.0',
      newVersion: '1.1.0',
    })

    unsubscribe()

    expect(off).toHaveBeenCalledWith(
      ipcEventChannels.updateAvailabilityChanged,
      wrappedListener,
    )
  })

  it('subscribes signal listeners without requiring a payload', async () => {
    const { subscribeSignal } = await import('../../../electron/preload/modules/shared')
    const listener = vi.fn()

    const unsubscribe = subscribeSignal(ipcEventChannels.updateDownloaded, listener)

    expect(on).toHaveBeenCalledWith(ipcEventChannels.updateDownloaded, expect.any(Function))

    const wrappedListener = on.mock.calls[0][1]
    wrappedListener()

    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()

    expect(off).toHaveBeenCalledWith(ipcEventChannels.updateDownloaded, wrappedListener)
  })

  it('maps invoke requests to the declared channel and payload shape', async () => {
    const { invoke } = await import('../../../electron/preload/modules/shared')

    invokeRenderer.mockResolvedValue({ ok: true })

    const response = await invoke(ipcInvokeChannels.appOpenWindow, { route: '/settings' })

    expect(invokeRenderer).toHaveBeenCalledWith(
      ipcInvokeChannels.appOpenWindow,
      { route: '/settings' },
    )
    expect(response).toEqual({ ok: true })
  })

  it('supports invoke channels without request payloads', async () => {
    const { invoke } = await import('../../../electron/preload/modules/shared')

    invokeRenderer.mockResolvedValue({ version: '1.0.0' })

    await invoke(ipcInvokeChannels.appGetInfo)

    expect(invokeRenderer).toHaveBeenCalledWith(ipcInvokeChannels.appGetInfo)
  })
})
