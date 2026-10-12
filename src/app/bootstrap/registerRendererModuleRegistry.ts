import type { AppConfig } from '../../../config/types'
import { resolveRendererModules } from '@/shared/modules/registry'
import { createUpdateRendererModule } from '@/features/update/module'

export function registerRendererModuleRegistry(config: AppConfig) {
  return resolveRendererModules(
    [createUpdateRendererModule()],
    config,
  )
}
