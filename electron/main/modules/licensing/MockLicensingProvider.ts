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

export class MockLicensingProvider implements LicensingProvider {
  constructor(private readonly config: AppConfig) {}

  async getStatus() {
    if (!this.config.licensing.enabled) {
      return createInactiveLicenseStatus(this.config)
    }

    return {
      enabled: true,
      status: 'active' as const,
      licenseStatus: 'active' as const,
      activated: true,
      validated: true,
      lastValidatedAt: new Date(0).toISOString(),
      activationId: 'mock-activation-id',
      activationToken: 'mock-activation-token',
      graceUntil: null,
      reasonCode: 'none' as const,
      entitlements: {
        items: [
          {
            key: 'starter.pro',
            name: 'Starter Pro',
            enabled: true,
          },
        ],
      },
      gracePeriod: {
        active: false,
        startedAt: null,
        endsAt: null,
        remainingDays: this.config.licensing.gracePeriodDays,
      },
      degradedMode: {
        active: false,
        mode: 'none' as const,
        reason: null,
      },
    }
  }

  async activate(request: { key: string }) {
    if (!this.config.licensing.enabled || request.key.trim().length === 0) {
      return createActivationFailure(
        this.config,
        'invalid',
        'Mock activation rejected the license key.',
        'invalid_license',
      )
    }

    const status = await this.getStatus()

    return {
      success: true,
      status: status.status,
      licenseStatus: status.status,
      activationId: status.activationId ?? 'mock-activation-id',
      activationToken: status.activationToken ?? 'mock-activation-token',
      activatedAt: new Date(0).toISOString(),
      graceUntil: status.graceUntil ?? null,
      reasonCode: status.reasonCode ?? 'none',
      entitlements: status.entitlements,
      gracePeriod: status.gracePeriod,
      degradedMode: status.degradedMode,
    }
  }

  async validate() {
    if (!this.config.licensing.enabled) {
      return createValidationFailure(this.config, 'unlicensed', 'Licensing is disabled.')
    }

    const status = await this.getStatus()

    return {
      valid: true,
      status: status.status,
      licenseStatus: status.status,
      activationId: status.activationId ?? 'mock-activation-id',
      activationToken: status.activationToken ?? 'mock-activation-token',
      validatedAt: status.lastValidatedAt,
      graceUntil: status.graceUntil ?? null,
      reasonCode: status.reasonCode ?? 'none',
      entitlements: status.entitlements,
      gracePeriod: status.gracePeriod,
      degradedMode: status.degradedMode,
    }
  }

  async heartbeat() {
    if (!this.config.licensing.enabled) {
      return createHeartbeatFailure(this.config, 'unlicensed', 'Licensing is disabled.')
    }

    return {
      ok: true,
      status: 'active' as const,
      licenseStatus: 'active' as const,
      activationId: 'mock-activation-id',
      activationToken: 'mock-activation-token',
      heartbeatAt: new Date(0).toISOString(),
      graceUntil: null,
      reasonCode: 'none' as const,
      gracePeriod: {
        active: false,
        startedAt: null,
        endsAt: null,
        remainingDays: this.config.licensing.gracePeriodDays,
      },
      entitlements: {
        items: [],
      },
      degradedMode: {
        active: false,
        mode: 'none' as const,
        reason: null,
      },
    }
  }

  async getEntitlements(_request: LicenseEntitlementsRequest) {
    if (!this.config.licensing.enabled) {
      return createEntitlementsFailure(this.config, 'unlicensed', 'Licensing is disabled.')
    }

    return {
      status: 'active' as const,
      entitlements: {
        items: [
          {
            key: 'starter.pro',
            name: 'Starter Pro',
            enabled: true,
          },
        ],
      },
      degradedMode: {
        active: false,
        mode: 'none' as const,
        reason: null,
      },
    }
  }
}
