import type { AppConfig } from '../../../config/types'

export function isAppProtectionEnabled(config: AppConfig) {
  return config.environment === 'production' && config.features.appProtection && config.appProtection.enabled
}
