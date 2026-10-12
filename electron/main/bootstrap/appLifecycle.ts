import { app, BrowserWindow } from 'electron'

export function registerSingleInstance() {
  if (!app.requestSingleInstanceLock()) {
    app.quit()
    process.exit(0)
  }
}

export function registerAppLifecycle(
  getMainWindow: () => BrowserWindow | null,
  createWindow: () => Promise<void>,
) {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('second-instance', () => {
    const window = getMainWindow()

    if (!window) {
      return
    }

    if (window.isMinimized()) {
      window.restore()
    }

    window.focus()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length > 0) {
      BrowserWindow.getAllWindows()[0].focus()
      return
    }

    void createWindow()
  })
}
