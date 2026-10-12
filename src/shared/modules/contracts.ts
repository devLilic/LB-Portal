import type { BrowserWindow } from 'electron'
import type { ComponentType } from 'react'
import type { AppConfig } from '../../../config/types'

export interface BaseModule {
  id: string
  isEnabled?: (config: AppConfig) => boolean
}

export interface MainModuleContext {
  config: AppConfig
  getMainWindow: () => BrowserWindow | null
}

export interface MainModule extends BaseModule {
  register: (context: MainModuleContext) => void | Promise<void>
}

export interface PreloadModuleContext {
  config: AppConfig
}

export interface PreloadModule extends BaseModule {
  register: (context: PreloadModuleContext) => void
}

export interface RendererModuleContext {
  config: AppConfig
}

export interface RendererModule extends BaseModule {
  component: ComponentType
}
