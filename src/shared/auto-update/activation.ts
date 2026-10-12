import type { AppConfig } from '../../../config/types'

export function isAutoUpdateEnabled(config: AppConfig) {
  return config.features.autoUpdate && config.environment === 'production'
}
