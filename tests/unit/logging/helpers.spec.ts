import { describe, expect, it, vi } from 'vitest'
import {
  createConfigLogger,
  createDatabaseLogger,
  createLicensingLogger,
  createLogger,
  createUpdateLogger,
  type LogEntry,
} from '../../../electron/main/logging'
import { loadConfig } from '../../../config/loadConfig'

function createEntriesLogger(scope: string) {
  const entries: LogEntry[] = []
  const logger = createLogger(
    {
      logging: {
        enabled: true,
        level: 'debug',
      },
    },
    scope,
    (entry) => {
      entries.push(entry)
    },
  )

  return { entries, logger }
}

describe('logging helpers', () => {
  it('logs resolved config summaries', () => {
    const { entries, logger } = createEntriesLogger('config')
    const config = loadConfig('production', {})

    createConfigLogger(logger).resolved(config)

    expect(entries[0]?.message).toBe('config_resolved')
  })

  it('logs low-noise update events', () => {
    const { entries, logger } = createEntriesLogger('updates')

    createUpdateLogger(logger).stateChanged('update-available', { version: '1.2.3' })

    expect(entries[0]).toEqual({
      level: 'info',
      scope: 'updates',
      message: 'update_state_changed',
      args: [{ event: 'update-available', version: '1.2.3' }],
    })
  })

  it('logs licensing helper events', () => {
    const { entries, logger } = createEntriesLogger('licensing')

    const licensingLogger = createLicensingLogger(logger)
    licensingLogger.schedulerStarted(1000)
    licensingLogger.activated(true)

    expect(entries).toHaveLength(2)
    expect(entries[0]?.message).toBe('licensing_heartbeat_started')
    expect(entries[1]?.message).toBe('licensing_activation_completed')
  })

  it('logs database helper events', () => {
    const { entries, logger } = createEntriesLogger('database')

    const databaseLogger = createDatabaseLogger(logger)
    databaseLogger.connectionOpened({
      filePath: ':memory:',
      inMemory: true,
    })
    databaseLogger.repositoryReady('appMetadata')

    expect(entries[0]?.message).toBe('database_connection_opened')
    expect(entries[1]?.message).toBe('database_repository_ready')
  })
})
