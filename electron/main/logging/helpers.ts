import type { AppConfig } from '../../../config/types'
import type { Logger } from './logger'

export function createConfigLogger(logger: Logger) {
  return {
    resolved(config: AppConfig) {
      logger.info('config_resolved', {
        environment: config.environment,
        features: config.features,
        logging: config.logging,
      })
    },
  }
}

export function createUpdateLogger(logger: Logger) {
  return {
    stateChanged(event: string, details: Record<string, unknown> = {}) {
      logger.info('update_state_changed', {
        event,
        ...details,
      })
    },
    disabled(reason: string) {
      logger.debug('update_disabled', { reason })
    },
    failed(action: string, error: unknown) {
      logger.warn('update_failed', {
        action,
        error: error instanceof Error ? error.message : String(error),
      })
    },
  }
}

export function createLicensingLogger(logger: Logger) {
  return {
    schedulerStarted(intervalMs: number) {
      logger.info('licensing_heartbeat_started', { intervalMs })
    },
    statusQueried() {
      logger.debug('licensing_status_queried')
    },
    activated(success: boolean) {
      logger.info('licensing_activation_completed', { success })
    },
    entitlementsQueried() {
      logger.debug('licensing_entitlements_queried')
    },
  }
}

export function createDatabaseLogger(logger: Logger) {
  return {
    connectionOpened(details: { filePath: string; inMemory: boolean }) {
      logger.info('database_connection_opened', details)
    },
    repositoryReady(name: string) {
      logger.debug('database_repository_ready', { repository: name })
    },
  }
}
