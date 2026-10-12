import type { AppConfig } from '../../../../config/types'
import { HttpLicensingProvider } from './HttpLicensingProvider'
import type { LicensingProvider } from './LicensingProvider'
import { MockLicensingProvider } from './MockLicensingProvider'
import { NoopLicensingProvider } from './NoopLicensingProvider'

export function createLicensingProvider(config: AppConfig): LicensingProvider {
  if (config.environment !== 'production' || !config.features.licensing || !config.licensing.enabled) {
    return new NoopLicensingProvider(config)
  }

  switch (config.licensing.provider) {
    case 'mock':
      return new MockLicensingProvider(config)
    case 'http':
      return new HttpLicensingProvider(config)
    case 'noop':
    default:
      return new NoopLicensingProvider(config)
  }
}
