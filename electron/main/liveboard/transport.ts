import { StringDecoder } from 'node:string_decoder'
import { Socket, createConnection } from 'node:net'
import type { LiveBoardConnectionSettings, LiveBoardConnectionSnapshot } from '../../../src/shared/liveboard/connection'

export interface LiveBoardCommandResult { command: string; response: string; acknowledged: boolean }
export interface LiveBoardTransport {
  mode: 'simulation' | 'tcp'
  getSnapshot(): LiveBoardConnectionSnapshot
  connect(): Promise<void>
  disconnect(): void
  setField(template: string, field: string, value: string): Promise<LiveBoardCommandResult>
  play(template: string): Promise<LiveBoardCommandResult>
  resume(template: string): Promise<LiveBoardCommandResult>
  stop(template: string): Promise<LiveBoardCommandResult>
}

export class LiveBoardTransportError extends Error {
  constructor(message: string, readonly sent: boolean, options?: ErrorOptions) { super(message, options); this.name = 'LiveBoardTransportError' }
}

export function encodeLiveBoardCommand(name: string, ...args: string[]): string {
  if (!['LBC_PLAYCONTENT', 'LBC_RESUMECONTENT', 'LBC_STOPCONTENT', 'LBC_SETTEMPLATEOBJECTVALUE'].includes(name)) {
    throw new Error('Unsupported LiveBoard command.')
  }
  const expectedArgs = name === 'LBC_SETTEMPLATEOBJECTVALUE' ? 3 : 1
  if (args.length !== expectedArgs) throw new Error(`${name} requires ${expectedArgs} argument${expectedArgs === 1 ? '' : 's'}.`)
  const quoted = args.map(value => `"${escapeArgument(value)}"`).join(', ')
  const command = `${name}${quoted ? ` ${quoted}` : ''}\n`
  if (Buffer.byteLength(command, 'utf8') > 65536) throw new Error('LiveBoard command exceeds the 65536-byte limit.')
  return command
}

function escapeArgument(value: string): string {
  if (typeof value !== 'string') throw new TypeError('LiveBoard command arguments must be strings.')
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value)) throw new Error('LiveBoard argument contains an unsupported control character.')
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')
}

export function createLiveBoardTransport(settings: LiveBoardConnectionSettings, onChange?: (snapshot: LiveBoardConnectionSnapshot) => void): LiveBoardTransport {
  return settings.mode === 'simulation' ? new SimulationTransport(settings, onChange) : new TcpLiveBoardTransport(settings, onChange)
}

class SimulationTransport implements LiveBoardTransport {
  mode = 'simulation' as const
  constructor(private readonly settings: LiveBoardConnectionSettings, private readonly onChange?: (snapshot: LiveBoardConnectionSnapshot) => void) { this.changed() }
  getSnapshot(): LiveBoardConnectionSnapshot { return { mode: this.mode, status: 'simulation', host: this.settings.host, port: this.settings.port, error: null } }
  async connect() { this.changed() }
  disconnect() { this.changed() }
  async setField(template: string, field: string, value: string) { return this.result(encodeLiveBoardCommand('LBC_SETTEMPLATEOBJECTVALUE', template, field, value)) }
  async play(template: string) { return this.result(encodeLiveBoardCommand('LBC_PLAYCONTENT', template)) }
  async resume(template: string) { return this.result(encodeLiveBoardCommand('LBC_RESUMECONTENT', template)) }
  async stop(template: string) { return this.result(encodeLiveBoardCommand('LBC_STOPCONTENT', template)) }
  private result(command: string): LiveBoardCommandResult { return { command, response: 'SIMULATED OK', acknowledged: false } }
  private changed() { this.onChange?.(this.getSnapshot()) }
}

class TcpLiveBoardTransport implements LiveBoardTransport {
  mode = 'tcp' as const
  private socket: Socket | null = null
  private status: LiveBoardConnectionSnapshot['status'] = 'disconnected'
  private error: string | null = null
  private buffer = ''
  private decoder = new StringDecoder('utf8')
  private welcomeTimer: ReturnType<typeof setTimeout> | null = null
  private commandTimer: ReturnType<typeof setTimeout> | null = null
  private connectedResolve: (() => void) | null = null
  private connectedReject: ((error: Error) => void) | null = null
  private connectPromise: Promise<void> | null = null
  private commandResolve: ((result: LiveBoardCommandResult) => void) | null = null
  private commandReject: ((error: Error) => void) | null = null
  private activeCommand = ''
  private queue: Array<{ command: string; resolve: (result: LiveBoardCommandResult) => void; reject: (error: Error) => void }> = []
  private activeSent = false
  private readonly maxPendingCommands = 100

  constructor(private readonly settings: LiveBoardConnectionSettings, private readonly onChange?: (snapshot: LiveBoardConnectionSnapshot) => void) {}
  getSnapshot(): LiveBoardConnectionSnapshot { return { mode: this.mode, status: this.status, host: this.settings.host, port: this.settings.port, error: this.error } }

  connect(): Promise<void> {
    if (this.status === 'connected') return Promise.resolve()
    if (this.status === 'connecting' && this.connectPromise) return this.connectPromise
    this.status = 'connecting'; this.error = null; this.changed()
    this.buffer = ''
    this.decoder = new StringDecoder('utf8')
    this.connectPromise = new Promise((resolve, reject) => {
      this.connectedResolve = resolve; this.connectedReject = reject
      const socket = createConnection({ host: this.settings.host, port: this.settings.port! })
      this.socket = socket
      socket.on('data', chunk => this.onData(socket, chunk))
      socket.on('error', error => this.onSocketError(socket, error))
      socket.on('close', () => { if (this.socket === socket) this.fail('LiveBoard connection closed.', this.activeSent, socket) })
      this.welcomeTimer = setTimeout(() => this.fail('Timed out waiting for LiveBoard welcome banner.', false, socket), this.settings.timeoutMs)
    })
    return this.connectPromise
  }

  disconnect() { this.fail('LiveBoard disconnected.', this.activeSent); this.socket?.destroy(); this.socket = null; this.status = 'disconnected'; this.error = null; this.changed() }
  setField(template: string, field: string, value: string) { return this.send(encodeLiveBoardCommand('LBC_SETTEMPLATEOBJECTVALUE', template, field, value)) }
  play(template: string) { return this.send(encodeLiveBoardCommand('LBC_PLAYCONTENT', template)) }
  resume(template: string) { return this.send(encodeLiveBoardCommand('LBC_RESUMECONTENT', template)) }
  stop(template: string) { return this.send(encodeLiveBoardCommand('LBC_STOPCONTENT', template)) }

  private send(command: string): Promise<LiveBoardCommandResult> {
    if (this.status !== 'connected' || !this.socket) return Promise.reject(new LiveBoardTransportError('LiveBoard is not connected.', false))
    if (this.queue.length + (this.commandResolve ? 1 : 0) >= this.maxPendingCommands) {
      return Promise.reject(new LiveBoardTransportError(`LiveBoard command queue is full (${this.maxPendingCommands}).`, false))
    }
    return new Promise((resolve, reject) => { this.queue.push({ command, resolve, reject }); this.pump() })
  }
  private pump() {
    if (!this.socket || this.commandResolve || this.queue.length === 0 || this.status !== 'connected') return
    const item = this.queue.shift()!
    this.commandResolve = item.resolve; this.commandReject = item.reject; this.activeCommand = item.command; this.activeSent = true
    const socket = this.socket
    this.commandTimer = setTimeout(() => this.fail('Timed out waiting for LiveBoard command response.', true, socket), this.settings.timeoutMs)
    socket.write(item.command, 'utf8', error => { if (error && this.socket === socket) this.fail(error.message, this.activeSent, socket) })
  }
  private onData(socket: Socket, chunk: Buffer | string) {
    if (this.socket !== socket) return
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.write(chunk)
    if (Buffer.byteLength(this.buffer, 'utf8') > 65536) { this.fail('LiveBoard response exceeded the 65536-byte limit.', this.activeSent, socket); return }
    let completedCommand = false
    let newline: number
    while ((newline = this.buffer.indexOf('\n')) >= 0) {
      const line = this.buffer.slice(0, newline).replace(/\r$/, '').trim()
      this.buffer = this.buffer.slice(newline + 1)
      if (!line) continue
      if (/^welcome\b/i.test(line)) {
        if (this.status === 'connecting') { this.clearWelcomeTimer(); this.status = 'connected'; this.error = null; this.changed(); this.connectedResolve?.(); this.connectedResolve = null; this.connectedReject = null; this.connectPromise = null; this.pump() }
        continue
      }
      if (this.status === 'connecting') continue
      if (!this.commandResolve) {
        this.fail(`Unexpected LiveBoard response with no command pending: ${line}`, false, socket)
        return
      }
      const resolve = this.commandResolve; const reject = this.commandReject; const command = this.activeCommand
      this.commandResolve = null; this.commandReject = null; this.activeCommand = ''; this.activeSent = false; this.clearCommandTimer()
      completedCommand = true
      if (/^error\b/i.test(line)) reject?.(new LiveBoardTransportError(line, true))
      else if (/^ok\b/i.test(line)) resolve({ command, response: line, acknowledged: true })
      else {
        reject?.(new LiveBoardTransportError(`Unexpected LiveBoard response: ${line}`, true))
        this.fail(`Unexpected LiveBoard response: ${line}`, true, socket)
        return
      }
    }
    // Inspect every complete frame in this data delivery before dispatching
    // another command, so a duplicate OK cannot acknowledge a queued command.
    if (completedCommand && this.socket === socket) this.pump()
  }
  private onSocketError(socket: Socket, error: Error) {
    if (this.socket === socket) this.fail(error.message, this.activeSent, socket)
  }
  private fail(message: string, sent: boolean, sourceSocket?: Socket) {
    if (sourceSocket && this.socket !== sourceSocket) return
    this.clearWelcomeTimer(); this.clearCommandTimer()
    const error = new LiveBoardTransportError(message, sent)
    this.connectedReject?.(error); this.connectedReject = null; this.connectedResolve = null
    this.connectPromise = null
    this.commandReject?.(error); this.commandReject = null; this.commandResolve = null; this.activeCommand = ''
    for (const item of this.queue.splice(0)) item.reject(new LiveBoardTransportError(message, false))
    if (this.status !== 'disconnected') { this.status = 'error'; this.error = message; this.changed() }
    this.activeSent = false
    const socket = this.socket
    this.socket = null
    socket?.destroy()
  }
  private clearWelcomeTimer() { if (this.welcomeTimer) clearTimeout(this.welcomeTimer); this.welcomeTimer = null }
  private clearCommandTimer() { if (this.commandTimer) clearTimeout(this.commandTimer); this.commandTimer = null }
  private changed() { this.onChange?.(this.getSnapshot()) }
}
