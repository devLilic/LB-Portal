import type { RendererModule } from '@/shared/modules/contracts'
import { isAutoUpdateEnabled } from '@/shared/auto-update/activation'
import UpdateFeature from './index'

export function createUpdateRendererModule(): RendererModule {
  return {
    id: 'update',
    isEnabled(config) {
      return isAutoUpdateEnabled(config)
    },
    component: UpdateFeature,
  }
}
