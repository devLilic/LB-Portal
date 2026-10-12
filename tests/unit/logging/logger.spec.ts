import { describe, expect, it, vi } from 'vitest'
import { createLogger, type LogEntry } from '../../../electron/main/logging'

describe('logger', () => {
  it('suppresses all output when logging is disabled', () => {
    const writer = vi.fn()
    const logger = createLogger(
      {
        logging: {
          enabled: false,
          level: 'debug',
        },
      },
      'core',
      writer,
    )

    logger.info('hello')
    logger.error('boom')

    expect(writer).not.toHaveBeenCalled()
  })

  it('filters entries below the configured level', () => {
    const entries: LogEntry[] = []
    const logger = createLogger(
      {
        logging: {
          enabled: true,
          level: 'warn',
        },
      },
      'core',
      (entry) => {
        entries.push(entry)
      },
    )

    logger.debug('debug')
    logger.info('info')
    logger.warn('warn')
    logger.error('error')

    expect(entries).toEqual([
      {
        level: 'warn',
        scope: 'core',
        message: 'warn',
        args: [],
      },
      {
        level: 'error',
        scope: 'core',
        message: 'error',
        args: [],
      },
    ])
  })

  it('creates scoped child loggers', () => {
    const writer = vi.fn()
    const logger = createLogger(
      {
        logging: {
          enabled: true,
          level: 'debug',
        },
      },
      'database',
      writer,
    )

    logger.child('repository').info('saved', 'app.theme')

    expect(writer).toHaveBeenCalledWith({
      level: 'info',
      scope: 'database:repository',
      message: 'saved',
      args: ['app.theme'],
    })
  })
})
