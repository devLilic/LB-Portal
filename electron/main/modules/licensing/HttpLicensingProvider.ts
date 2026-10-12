import type { AppConfig } from '../../../../config/types'
import type {
  LicenseActivationRequest,
  LicenseActivationResult,
  LicenseEntitlementsRequest,
  LicenseEntitlementsResult,
  LicenseHeartbeatRequest,
  LicenseHeartbeatResult,
  LicenseStatusSnapshot,
  LicenseValidationRequest,
  LicenseValidationResult,
} from '../../../../src/shared/licensing/contracts'
import { resolveLicensingPolicy } from '../../../../src/shared/licensing/policy'
import type { LicensingProvider } from './LicensingProvider'
import { HttpLicensingClient } from './HttpLicensingClient'
import { LicensingHttpError } from './LicensingHttpError'

export class HttpLicensingProvider implements LicensingProvider {
  constructor(
    private readonly config: AppConfig,
    private readonly client: HttpLicensingClient = new HttpLicensingClient(config),
  ) {}

  async getStatus() {
    try {
      const result = await this.client.getStatus()
      const policy = resolveLicensingPolicy(this.config, {
        status: result.status,
        lastSuccessfulAt: result.lastValidatedAt,
      })

      return {
        ...result,
        status: policy.status,
        gracePeriod: policy.gracePeriod,
        degradedMode: policy.degradedMode,
      }
    } catch (error) {
      return this.createStatusFallback(error, null)
    }
  }

  async activate(request: LicenseActivationRequest) {
    try {
      const result = await this.client.activateLicense(request)
      const policy = resolveLicensingPolicy(this.config, {
        status: result.status,
        lastSuccessfulAt: result.activatedAt,
      })

      return {
        ...result,
        status: policy.status,
        gracePeriod: policy.gracePeriod,
        degradedMode: policy.degradedMode,
      }
    } catch (error) {
      return this.createActivationFallback(error)
    }
  }

  async validate(request: LicenseValidationRequest) {
    try {
      const result = await this.client.validateLicense(request)
      const policy = resolveLicensingPolicy(this.config, {
        status: result.status,
        lastSuccessfulAt: result.validatedAt,
      })

      return {
        ...result,
        status: policy.status,
        gracePeriod: policy.gracePeriod,
        degradedMode: policy.degradedMode,
      }
    } catch (error) {
      return this.createValidationFallback(error, request.lastValidatedAt ?? null)
    }
  }

  async heartbeat(request: LicenseHeartbeatRequest) {
    try {
      const result = await this.client.sendHeartbeat(request)
      const policy = resolveLicensingPolicy(this.config, {
        status: result.status,
        lastSuccessfulAt: result.heartbeatAt,
      })

      return {
        ...result,
        status: policy.status,
        gracePeriod: policy.gracePeriod,
        degradedMode: policy.degradedMode,
      }
    } catch (error) {
      return this.createHeartbeatFallback(error, request.lastHeartbeatAt ?? null)
    }
  }

  async getEntitlements(request: LicenseEntitlementsRequest) {
    try {
      const result = await this.client.getEntitlements(request)
      const policy = resolveLicensingPolicy(this.config, {
        status: result.status,
      })

      return {
        ...result,
        status: policy.status,
        degradedMode: policy.degradedMode,
      }
    } catch (error) {
      const failure = toLicensingFailureReason(error)
      const policy = resolveLicensingPolicy(this.config, {
        failureReason: failure,
      })

      return {
        status: policy.status,
        entitlements: {
          items: [],
        },
        degradedMode: policy.degradedMode,
      }
    }
  }

  private createStatusFallback(error: unknown, lastSuccessfulAt: string | null): LicenseStatusSnapshot {
    const policy = resolveLicensingPolicy(this.config, {
      failureReason: toLicensingFailureReason(error),
      lastSuccessfulAt,
    })

    return {
      enabled: true,
      status: policy.status,
      licenseStatus: policy.status,
      activated: false,
      validated: false,
      lastValidatedAt: lastSuccessfulAt,
      activationId: null,
      activationToken: null,
      graceUntil: policy.gracePeriod.endsAt,
      reasonCode: mapPolicyStatusToReasonCode(policy.status),
      entitlements: {
        items: [],
      },
      gracePeriod: policy.gracePeriod,
      degradedMode: policy.degradedMode,
    }
  }

  private createActivationFallback(error: unknown): LicenseActivationResult {
    const policy = resolveLicensingPolicy(this.config, {
      failureReason: toLicensingFailureReason(error),
    })

    return {
      success: false,
      status: policy.status,
      licenseStatus: policy.status,
      activationId: null,
      activationToken: null,
      activatedAt: null,
      graceUntil: policy.gracePeriod.endsAt,
      reasonCode: mapPolicyStatusToReasonCode(policy.status),
      entitlements: {
        items: [],
      },
      gracePeriod: policy.gracePeriod,
      degradedMode: policy.degradedMode,
    }
  }

  private createValidationFallback(
    error: unknown,
    lastSuccessfulAt: string | null,
  ): LicenseValidationResult {
    const policy = resolveLicensingPolicy(this.config, {
      failureReason: toLicensingFailureReason(error),
      lastSuccessfulAt,
    })

    return {
      valid: policy.status === 'grace-period',
      status: policy.status,
      licenseStatus: policy.status,
      activationId: null,
      activationToken: null,
      validatedAt: lastSuccessfulAt,
      graceUntil: policy.gracePeriod.endsAt,
      reasonCode: mapPolicyStatusToReasonCode(policy.status),
      entitlements: {
        items: [],
      },
      gracePeriod: policy.gracePeriod,
      degradedMode: policy.degradedMode,
    }
  }

  private createHeartbeatFallback(
    error: unknown,
    lastSuccessfulAt: string | null,
  ): LicenseHeartbeatResult {
    const policy = resolveLicensingPolicy(this.config, {
      failureReason: toLicensingFailureReason(error),
      lastSuccessfulAt,
    })

    return {
      ok: policy.status === 'grace-period',
      status: policy.status,
      licenseStatus: policy.status,
      activationId: null,
      activationToken: null,
      heartbeatAt: lastSuccessfulAt,
      graceUntil: policy.gracePeriod.endsAt,
      reasonCode: mapPolicyStatusToReasonCode(policy.status),
      gracePeriod: policy.gracePeriod,
      entitlements: {
        items: [],
      },
      degradedMode: policy.degradedMode,
    }
  }
}

function mapPolicyStatusToReasonCode(status: LicenseStatusSnapshot['status']) {
  if (status === 'expired') {
    return 'expired' as const
  }

  if (status === 'revoked') {
    return 'revoked' as const
  }

  if (status === 'invalid') {
    return 'invalid_license' as const
  }

  return 'none' as const
}

function toLicensingFailureReason(error: unknown) {
  if (error instanceof LicensingHttpError) {
    return error.reason
  }

  return 'server-unavailable' as const
}
