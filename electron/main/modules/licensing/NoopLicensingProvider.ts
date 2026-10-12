import type { AppConfig } from '../../../../config/types'
import type { LicenseEntitlementsRequest } from '../../../../src/shared/licensing/contracts'
import type { LicensingProvider } from './LicensingProvider'
import {
  createActivationFailure,
  createEntitlementsFailure,
  createHeartbeatFailure,
  createInactiveLicenseStatus,
  createValidationFailure,
} from './shared'

export class NoopLicensingProvider implements LicensingProvider {
  constructor(private readonly config: AppConfig) {}

  async getStatus() {
    return createInactiveLicenseStatus(this.config)
  }

  async activate() {
    return createActivationFailure(this.config, 'unlicensed', 'Licensing provider is disabled.')
  }

  async validate() {
    return createValidationFailure(this.config, 'unlicensed', 'Licensing provider is disabled.')
  }

  async heartbeat() {
    return createHeartbeatFailure(this.config, 'unlicensed', 'Licensing provider is disabled.')
  }

  async getEntitlements(_request: LicenseEntitlementsRequest) {
    return createEntitlementsFailure(this.config, 'unlicensed', 'Licensing provider is disabled.')
  }
}
