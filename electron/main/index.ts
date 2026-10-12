import { app, type BrowserWindow } from 'electron'
import { loadConfig } from '../../config/loadConfig'
import { registerAppLifecycle, registerSingleInstance } from './bootstrap/appLifecycle'
import './bootstrap/paths'
import { registerMainModuleRegistry } from './bootstrap/registerMainModuleRegistry'
import { createMainWindow } from './bootstrap/createMainWindow'
import { bootstrapAppProtection } from './security/appProtection'
import { applyAppSecurity } from './security/appSecurity'

const config = loadConfig()

applyAppSecurity()
bootstrapAppProtection(config)
registerSingleInstance()

let mainWindow: BrowserWindow | null = null

async function bootstrap() {
  mainWindow = await createMainWindow()

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

void registerMainModuleRegistry(config, () => mainWindow)
registerAppLifecycle(() => mainWindow, bootstrap)

app.whenReady().then(bootstrap)
