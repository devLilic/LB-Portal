import type { AppConfig } from '../../../config/types'
import type {
  DegradedModeStatus,
  LicenseGracePeriod,
  LicenseStatus,
} from './contracts'

export type LicensingFailureReason =
  | 'server-unavailable'
  | 'invalid-license'
  | 'expired-license'
  | 'revoked-license'

export interface LicensingPolicyInput {
  now?: Date
  lastSuccessfulAt?: string | null
  status?: LicenseStatus
  failureReason?: LicensingFailureReason
}

export interface LicensingPolicyResolution {
  status: LicenseStatus
  gracePeriod: LicenseGracePeriod
  degradedMode: DegradedModeStatus
}

const DAY_IN_MS = 24 * 60 * 60 * 1000

export function resolveLicensingPolicy(
  config: AppConfig,
  input: LicensingPolicyInput,
): LicensingPolicyResolution {
  const now = input.now ?? new Date()

  if (input.failureReason === 'server-unavailable') {
    return resolveServerUnavailablePolicy(config, now, input.lastSuccessfulAt ?? null)
  }

  if (input.failureReason === 'invalid-license') {
    return createImmediateDegradedPolicy(config, 'invalid', 'License is invalid.')
  }

  if (input.failureReason === 'expired-license') {
    return createImmediateDegradedPolicy(config, 'expired', 'License has expired.')
  }

  if (input.failureReason === 'revoked-license') {
    return createImmediateDegradedPolicy(config, 'revoked', 'License has been revoked.')
  }

  if (input.status === 'invalid') {
    return createImmediateDegradedPolicy(config, 'invalid', 'License is invalid.')
  }

  if (input.status === 'expired') {
    return createImmediateDegradedPolicy(config, 'expired', 'License has expired.')
  }

  if (input.status === 'revoked') {
    return createImmediateDegradedPolicy(config, 'revoked', 'License has been revoked.')
  }

  if (input.status === 'grace-period' || input.status === 'degraded') {
    return resolveServerUnavailablePolicy(config, now, input.lastSuccessfulAt ?? null)
  }

  return {
    status: input.status ?? 'active',
    gracePeriod: createInactiveGracePeriod(config),
    degradedMode: createInactiveDegradedMode(),
  }
}

function resolveServerUnavailablePolicy(
  config: AppConfig,
  now: Date,
  lastSuccessfulAt: string | null,
): LicensingPolicyResolution {
  const gracePeriod = createGracePeriodFromLastSuccess(config, now, lastSuccessfulAt)

  if (gracePeriod.active) {
    return {
      status: 'grace-period',
      gracePeriod,
      degradedMode: createInactiveDegradedMode(),
    }
  }

  return {
    status: 'degraded',
    gracePeriod,
    degradedMode: {
      active: true,
      mode: config.licensing.degradedMode,
      reason: 'Licensing server is unavailable.',
    },
  }
}

function createImmediateDegradedPolicy(
  config: AppConfig,
  status: LicenseStatus,
  reason: string,
): LicensingPolicyResolution {
  return {
    status,
    gracePeriod: createInactiveGracePeriod(config),
    degradedMode: {
      active: true,
      mode: config.licensing.degradedMode,
      reason,
    },
  }
}

function createGracePeriodFromLastSuccess(
  config: AppConfig,
  now: Date,
  lastSuccessfulAt: string | null,
): LicenseGracePeriod {
  if (!lastSuccessfulAt) {
    return createExpiredGracePeriod(config, null, now)
  }

  const startedAt = new Date(lastSuccessfulAt)

  if (Number.isNaN(startedAt.getTime())) {
    return createExpiredGracePeriod(config, null, now)
  }

  const endsAtDate = new Date(startedAt.getTime() + config.licensing.gracePeriodDays * DAY_IN_MS)
  const remainingMs = endsAtDate.getTime() - now.getTime()

  if (remainingMs > 0) {
    return {
      active: true,
      startedAt: lastSuccessfulAt,
      endsAt: endsAtDate.toISOString(),
      remainingDays: Math.ceil(remainingMs / DAY_IN_MS),
    }
  }

  return createExpiredGracePeriod(config, lastSuccessfulAt, endsAtDate)
}

function createExpiredGracePeriod(
  config: AppConfig,
  startedAt: string | null,
  endDate: Date,
): LicenseGracePeriod {
  return {
    active: false,
    startedAt,
    endsAt: endDate.toISOString(),
    remainingDays: 0,
  }
}

function createInactiveGracePeriod(config: AppConfig): LicenseGracePeriod {
  return {
    active: false,
    startedAt: null,
    endsAt: null,
    remainingDays: config.licensing.gracePeriodDays,
  }
}

function createInactiveDegradedMode(): DegradedModeStatus {
  return {
    active: false,
    mode: 'none',
    reason: null,
  }
}
