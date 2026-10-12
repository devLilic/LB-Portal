import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import path from 'node:path'
import { preloadPath } from '../bootstrap/paths'

export function createSecureBrowserWindow(
  options: BrowserWindowConstructorOptions = {},
) {
  return new BrowserWindow(mergeWithSecureDefaults(options))
}

function mergeWithSecureDefaults(
  options: BrowserWindowConstructorOptions,
): BrowserWindowConstructorOptions {
  return {
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    ...options,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      ...options.webPreferences,
    },
  }
}
