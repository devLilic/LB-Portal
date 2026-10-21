export interface OnAirIpcSenderEvent {
  sender: object
  senderFrame?: { url: string } | null
}

export interface OnAirMainFrameWindow {
  webContents: {
    mainFrame: object
  }
}

export function validateOnAirIpcSender(
  event: OnAirIpcSenderEvent,
  window: OnAirMainFrameWindow | null,
  devServerUrl = process.env.VITE_DEV_SERVER_URL,
): void {
  const frame = event.senderFrame
  if (!window || event.sender !== window.webContents || !frame || frame !== window.webContents.mainFrame) {
    throw new Error('Untrusted renderer.')
  }
  if (frame.url.startsWith('file://')) return
  try {
    if (devServerUrl && new URL(frame.url).origin === new URL(devServerUrl).origin) return
  } catch {
    // Invalid renderer URLs are rejected below.
  }
  throw new Error('Untrusted renderer.')
}
