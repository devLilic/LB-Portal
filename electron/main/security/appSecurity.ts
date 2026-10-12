import { app } from 'electron'
import os from 'node:os'

export function applyAppSecurity() {
  if (os.release().startsWith('6.1')) {
    app.disableHardwareAcceleration()
  }

  if (process.platform === 'win32') {
    app.setAppUserModelId(app.getName())
  }
}
