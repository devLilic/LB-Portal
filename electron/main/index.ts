import { app, type BrowserWindow } from 'electron'
import { copyFileSync, existsSync, mkdirSync, renameSync } from 'node:fs'
import path from 'node:path'
import { loadConfig } from '../../config/loadConfig'
import { registerAppLifecycle, registerSingleInstance } from './bootstrap/appLifecycle'
import './bootstrap/paths'
import { registerMainModuleRegistry } from './bootstrap/registerMainModuleRegistry'
import { createMainWindow } from './bootstrap/createMainWindow'
import { bootstrapAppProtection } from './security/appProtection'
import { applyAppSecurity } from './security/appSecurity'
import { registerLBPortalIngress } from './ingress/registerLBPortalIngress'

if (app.isPackaged && !process.env.APP_ENV) {
  process.env.APP_ENV = 'production'
}

preserveLegacyUserDataPath()

const config = loadConfig()

applyAppSecurity()
bootstrapAppProtection(config)
registerSingleInstance()

let mainWindow: BrowserWindow | null = null

async function bootstrap() {
  mainWindow = await createMainWindow(config)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

void registerMainModuleRegistry(config, () => mainWindow)
registerLBPortalIngress(() => mainWindow)
registerAppLifecycle(() => mainWindow, bootstrap)

app.whenReady().then(bootstrap)

function preserveLegacyUserDataPath() {
  if (!app.isPackaged) return

  const appDataPath = app.getPath('appData')
  const legacyPaths = [
    path.join(appDataPath, 'Default Electron App'),
    path.join(appDataPath, 'default-electron-app-template'),
  ].filter(existsSync)
  const currentPath = app.getPath('userData')
  const legacyPath = legacyPaths.find(candidate => candidate.toLowerCase() !== currentPath.toLowerCase())
  if (!legacyPath) return

  try {
    if (!existsSync(currentPath)) {
      renameSync(legacyPath, currentPath)
      return
    }

    mkdirSync(currentPath, { recursive: true })
    for (const fileName of ['settings.json', 'lb-portal-receiver.json']) {
      const oldFile = path.join(legacyPath, fileName)
      const newFile = path.join(currentPath, fileName)
      if (existsSync(oldFile) && !existsSync(newFile)) copyFileSync(oldFile, newFile)
    }
  } catch (error) {
    console.warn('[startup] Could not migrate legacy user data. The original files were kept.', error)
    app.setPath('userData', legacyPath)
  }
}
