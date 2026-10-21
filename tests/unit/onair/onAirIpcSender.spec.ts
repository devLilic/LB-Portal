import { describe, expect, it } from 'vitest'
import { validateOnAirIpcSender } from '../../../electron/main/onair/validateOnAirIpcSender'

function proof(url: string) {
  const mainFrame = { url }
  const webContents = { mainFrame }
  const window = { webContents }
  return { mainFrame, sender: webContents, window, event: { sender: webContents, senderFrame: mainFrame } }
}

describe('OnAir IPC sender validation', () => {
  it('accepts only the current window main frame with the app file URL or configured dev origin', () => {
    const packaged = proof('file:///C:/app/index.html')
    expect(() => validateOnAirIpcSender(packaged.event, packaged.window, undefined)).not.toThrow()

    const development = proof('http://127.0.0.1:7777/onair')
    expect(() => validateOnAirIpcSender(development.event, development.window, 'http://127.0.0.1:7777/')).not.toThrow()
  })

  it('rejects subframes, other webContents, and foreign renderer origins', () => {
    const { sender, mainFrame, window, event } = proof('file:///C:/app/index.html')
    expect(() => validateOnAirIpcSender({ ...event, senderFrame: { url: 'file:///other.html' } }, window, undefined)).toThrow('Untrusted renderer.')
    expect(() => validateOnAirIpcSender({ ...event, sender: {} }, window, undefined)).toThrow('Untrusted renderer.')
    expect(() => validateOnAirIpcSender({ sender, senderFrame: { url: 'https://example.test/' } }, window, 'http://127.0.0.1:7777')).toThrow('Untrusted renderer.')
    expect(() => validateOnAirIpcSender({ sender, senderFrame: mainFrame }, null, undefined)).toThrow('Untrusted renderer.')
  })
})
