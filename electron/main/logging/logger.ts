import type { AppConfig, LogLevel, LoggingConfig } from '../../../config/types'

export interface LogEntry {
  level: Exclude<LogLevel, 'silent'>
  scope: string
  message: string
  args: unknown[]
}

export interface Logger {
  debug: (message: string, ...args: unknown[]) => void
  info: (message: string, ...args: unknown[]) => void
  warn: (message: string, ...args: unknown[]) => void
  error: (message: string, ...args: unknown[]) => void
  child: (scope: string) => Logger
}

export type LogWriter = (entry: LogEntry) => void

const levelWeights: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
}

export function createLogger(
  config: Pick<AppConfig, 'logging'>,
  scope = 'app',
  writer: LogWriter = writeLogEntry,
): Logger {
  return createScopedLogger(config.logging, scope, writer)
}

function createScopedLogger(
  config: LoggingConfig,
  scope: string,
  writer: LogWriter,
): Logger {
  return {
    debug(message, ...args) {
      log(config, scope, 'debug', message, args, writer)
    },
    info(message, ...args) {
      log(config, scope, 'info', message, args, writer)
    },
    warn(message, ...args) {
      log(config, scope, 'warn', message, args, writer)
    },
    error(message, ...args) {
      log(config, scope, 'error', message, args, writer)
    },
    child(childScope) {
      return createScopedLogger(config, `${scope}:${childScope}`, writer)
    },
  }
}

function log(
  config: LoggingConfig,
  scope: string,
  level: Exclude<LogLevel, 'silent'>,
  message: string,
  args: unknown[],
  writer: LogWriter,
) {
  if (!shouldLog(config, level)) {
    return
  }

  writer({
    level,
    scope,
    message,
    args,
  })
}

function shouldLog(
  config: LoggingConfig,
  level: Exclude<LogLevel, 'silent'>,
) {
  if (!config.enabled || config.level === 'silent') {
    return false
  }

  return levelWeights[level] <= levelWeights[config.level]
}

function writeLogEntry(entry: LogEntry) {
  const prefix = `[${entry.level.toUpperCase()}][${entry.scope}] ${entry.message}`

  switch (entry.level) {
    case 'debug':
    case 'info':
      console.log(prefix, ...entry.args)
      return
    case 'warn':
      console.warn(prefix, ...entry.args)
      return
    case 'error':
      console.error(prefix, ...entry.args)
      return
  }
}
