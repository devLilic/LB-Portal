export interface LiveBoardConnectionSettings {
  mode: 'simulation' | 'tcp'
  host: string
  port: number | null
  timeoutMs: number
}

export interface LiveBoardConnectionSnapshot {
  mode: 'simulation' | 'tcp'
  status: 'simulation' | 'disconnected' | 'connecting' | 'connected' | 'error'
  host: string
  port: number | null
  error: string | null
}

export const defaultLiveBoardConnection: LiveBoardConnectionSettings = {
  mode: 'simulation',
  host: '127.0.0.1',
  port: null,
  timeoutMs: 5000,
}

export function validateLiveBoardConnection(value: unknown): LiveBoardConnectionSettings {
  if (!isRecord(value)) throw new Error('LiveBoard connection settings must be an object.')
  const { mode, host, port, timeoutMs } = value
  if (mode !== 'simulation' && mode !== 'tcp') throw new Error('LiveBoard connection mode is invalid.')
  if (typeof host !== 'string' || host.trim() === '' || /[\s/\\\x00-\x1f\x7f]/.test(host)) {
    throw new Error('LiveBoard host must be nonblank and contain no whitespace or path/control characters.')
  }
  if (mode === 'tcp' && (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)) {
    throw new Error('TCP mode requires a port from 1 through 65535.')
  }
  if (mode === 'simulation' && port !== null && (!Number.isInteger(port) || (port as number) < 1 || (port as number) > 65535)) {
    throw new Error('Port must be null or an integer from 1 through 65535.')
  }
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 60000) {
    throw new Error('LiveBoard timeout must be between 100 and 60000 milliseconds.')
  }
  return { mode, host, port: port as number | null, timeoutMs }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
