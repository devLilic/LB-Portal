import { contextBridge } from 'electron'
import type { AppLanguage } from '../../../config/types'
import { ipcInvokeChannels } from '../../../src/shared/ipc/contracts'
import { invoke } from './shared'

export function registerI18nApi() {
  contextBridge.exposeInMainWorld('i18nApi', {
    getCurrentLanguage() {
      return invoke(ipcInvokeChannels.i18nGetCurrentLanguage)
    },
    getSupportedLanguages() {
      return invoke(ipcInvokeChannels.i18nGetSupportedLanguages)
    },
    getResources(payload: { language: AppLanguage; namespaces: string[] }) {
      return invoke(ipcInvokeChannels.i18nGetResources, payload)
    },
    setLanguage(payload: { language: AppLanguage }) {
      return invoke(ipcInvokeChannels.i18nSetLanguage, payload)
    },
  })
}
