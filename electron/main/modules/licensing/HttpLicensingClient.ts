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
import { LicensingHttpError } from './LicensingHttpError'

type FetchLike = typeof fetch

export class HttpLicensingClient {
  constructor(
    private readonly config: AppConfig,
    private readonly fetchImpl: FetchLike = fetch,
  ) {}

  getStatus() {
    return this.request<LicenseStatusSnapshot>('status')
  }

  activateLicense(request: LicenseActivationRequest) {
    return this.request<LicenseActivationResult>('activate', request)
  }

  validateLicense(request: LicenseValidationRequest) {
    return this.request<LicenseValidationResult>('validate', request)
  }

  sendHeartbeat(request: LicenseHeartbeatRequest) {
    return this.request<LicenseHeartbeatResult>('heartbeat', request)
  }

  getEntitlements(request: LicenseEntitlementsRequest) {
    return this.request<LicenseEntitlementsResult>('entitlements', request)
  }

  private async request<TResponse>(
    endpoint: keyof AppConfig['licensing']['endpoints'],
    body?: unknown,
  ): Promise<TResponse> {
    if (!this.config.licensing.apiBaseUrl) {
      throw new Error('HTTP licensing provider requires licensing.apiBaseUrl.')
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), this.config.licensing.timeoutMs)

    try {
      const response = await this.fetchImpl(
        new URL(this.config.licensing.endpoints[endpoint], this.config.licensing.apiBaseUrl).toString(),
        {
          method: body ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        },
      )

      if (!response.ok) {
        throw await createLicensingHttpError(response)
      }

      return (await response.json()) as TResponse
    } catch (error) {
      if (error instanceof LicensingHttpError) {
        throw error
      }

      throw new LicensingHttpError('server-unavailable', 'Licensing server is unavailable.')
    } finally {
      clearTimeout(timeout)
    }
  }
}

async function createLicensingHttpError(response: Response) {
  const reason = mapResponseStatusToReason(response.status)
  let message = `Licensing HTTP request failed with status ${response.status}.`

  try {
    const body = (await response.json()) as { message?: string } | null

    if (body?.message) {
      message = body.message
    }
  } catch {
    // ignore non-json bodies
  }

  return new LicensingHttpError(reason, message)
}

function mapResponseStatusToReason(status: number) {
  if (status === 400 || status === 422) {
    return 'invalid-license' as const
  }

  if (status === 402) {
    return 'expired-license' as const
  }

  if (status === 403) {
    return 'revoked-license' as const
  }

  return 'server-unavailable' as const
}
