import type { AppConfig } from '../../../config/types'
import { isAppProtectionEnabled } from '../../../src/shared/app-protection/activation'

export function bootstrapAppProtection(config: AppConfig) {
  if (!isAppProtectionEnabled(config)) {
    return {
      active: false,
      profile: config.appProtection.profile,
    }
  }

  switch (config.appProtection.profile) {
    case 'commercial':
      return {
        active: true,
        profile: 'commercial' as const,
      }
    case 'standard':
    default:
      return {
        active: true,
        profile: 'standard' as const,
      }
  }
}
