import { describe, expect, it } from 'vitest'
import {
  ipcInvokeChannels,
  type IpcInvokeContract,
} from '../../../src/shared/ipc/contracts'

describe('licensing ipc contracts', () => {
  it('defines the approved licensing invoke channels', () => {
    expect(ipcInvokeChannels.licensingGetStatus).toBe('licensing:get-status')
    expect(ipcInvokeChannels.licensingActivate).toBe('licensing:activate')
    expect(ipcInvokeChannels.licensingRequestReauthorization).toBe(
      'licensing:request-reauthorization',
    )
    expect(ipcInvokeChannels.licensingConfirmRebind).toBe('licensing:confirm-rebind')
    expect(ipcInvokeChannels.licensingGetEntitlements).toBe('licensing:get-entitlements')
  })

  it('maps entitlements payloads to the licensing entitlements channel', () => {
    const payload: IpcInvokeContract[typeof ipcInvokeChannels.licensingGetEntitlements]['request'] = {
      key: 'license-key',
    }

    expect(payload).toEqual({
      key: 'license-key',
    })
  })

  it('maps the rebind payload to the explicit confirm rebind channel', () => {
    const payload: IpcInvokeContract[typeof ipcInvokeChannels.licensingConfirmRebind]['request'] = {
      key: 'license-key',
      deviceName: 'Desktop',
    }

    expect(payload).toEqual({
      key: 'license-key',
      deviceName: 'Desktop',
    })
  })
})
