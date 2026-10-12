
window.ipcRenderer.on('main-process-message', (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
  console.log('[Receive Main-process message]:', ...args)
})
