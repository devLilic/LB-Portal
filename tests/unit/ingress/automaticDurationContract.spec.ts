import net, { type Server } from 'node:net'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { afterEach, describe, expect, it } from 'vitest'
import { LBPortalReceiver } from '../../../electron/main/ingress/LBPortalReceiver'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import { resolveMosMapping } from '../../../src/shared/ingress/mosMappingResolution'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import type { ReceivedRequest } from '../../../src/shared/ingress/contracts'

const sectionId = 'duration-contract-section'
const requestSource = 'plasma.test'
const accessKey = 'fictional-duration-test-key'
const controllers: LiveBoardController[] = []
const servers: Server[] = []

afterEach(async () => {
  for (const controller of controllers.splice(0)) controller.dispose()
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

describe('automatic duration HTTP contract', () => {
  it('returns configured and remaining duration for PLAY, same-ID replay, and fresh-ID noop without resending PLAY', async () => {
    const commands: string[] = []
    const rig = await createRig({ exitMode: 'template-duration', durationSeconds: 6, onCommand: line => { commands.push(line); return undefined } })
    const body = playBody('timed-1', 'DURATION_SOURCE', 'Same title')

    const first = await rig.post(body)
    expect(first.statusCode).toBe(200)
    expect(first.payload).toMatchObject({
      ok: true,
      requestId: 'timed-1',
      execution: { status: 'completed', playbackState: 'ON_SINGLE', onAir: true, automaticDurationSeconds: 6 },
    })
    expect(execution(first.payload).remainingDurationMs).toBeGreaterThan(0)
    expect(execution(first.payload).remainingDurationMs).toBeLessThanOrEqual(6000)
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT'))).toHaveLength(1)

    await delay(80)
    const freshNoop = await rig.post(playBody('timed-2', 'DURATION_SOURCE', 'Same title'))
    expect(freshNoop.payload).toMatchObject({
      requestId: 'timed-2',
      execution: { status: 'noop', onAir: true, automaticDurationSeconds: 6 },
    })
    expect(execution(freshNoop.payload).remainingDurationMs).toBeLessThan(execution(first.payload).remainingDurationMs as number)
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT'))).toHaveLength(1)

    await delay(80)
    rig.setResolution('manual-resume', 8)
    const sameId = await rig.post(body)
    expect(sameId.payload.requestId).toBe('timed-1')
    expect(execution(sameId.payload)).toMatchObject({ automaticDurationSeconds: 6 })
    expect(execution(sameId.payload).remainingDurationMs).toBeLessThan(execution(freshNoop.payload).remainingDurationMs as number)
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT'))).toHaveLength(1)
  })

  it('reports zero for a replay after replacement and after the replacement timer expires', async () => {
    const commands: string[] = []
    const rig = await createRig({ exitMode: 'template-duration', durationSeconds: 1, onCommand: line => { commands.push(line); return undefined } })
    await rig.post(playBody('old-instance', 'DURATION_SOURCE', 'First title'))
    await delay(100)
    const replacement = await rig.post(playBody('replacement-instance', 'DURATION_SOURCE', 'Second title'))
    expect(execution(replacement.payload)).toMatchObject({ automaticDurationSeconds: 1, status: 'completed', onAir: true })

    const oldReplay = await rig.post(playBody('old-instance', 'DURATION_SOURCE', 'First title'))
    expect(execution(oldReplay.payload)).toMatchObject({
      automaticDurationSeconds: 1,
      remainingDurationMs: 0,
      status: 'completed', onAir: true,
    })
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT'))).toHaveLength(2)
    const commandsAfterReplacement = [...commands]

    await delay(1050)
    expect(commands).toEqual(commandsAfterReplacement)
    const expiredReplay = await rig.post(playBody('replacement-instance', 'DURATION_SOURCE', 'Second title'))
    expect(execution(expiredReplay.payload)).toMatchObject({
      automaticDurationSeconds: 1,
      remainingDurationMs: 0,
      status: 'completed',
    })
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT'))).toHaveLength(2)
  })

  it('omits duration metadata for manual mode, RESUME, blocked PLAY, and failed PLAY while preserving the request envelope and bearer auth', async () => {
    const requests: Array<{ body: Record<string, unknown>; authorization?: string }> = []
    let rejectPlay = false
    const rig = await createRig({
      exitMode: 'manual-resume',
      durationSeconds: 2,
      onCommand: line => {
        if (line.startsWith('LBC_PLAYCONTENT') && rejectPlay) {
          rejectPlay = false
          return 'Error: injected TCP rejection\n'
        }
      },
      onHttpRequest: (body, authorization) => requests.push({ body, authorization }),
    })

    const manualBody = playBody('manual-play', 'DURATION_SOURCE', 'Manual title')
    const manual = await rig.post(manualBody)
    expect(manual.payload.execution).toMatchObject({ status: 'completed', onAir: true })
    expect(execution(manual.payload)).not.toHaveProperty('automaticDurationSeconds')
    expect(execution(manual.payload)).not.toHaveProperty('remainingDurationMs')

    rig.setResolution('template-duration', 8)
    const manualReplayAfterSettingsEdit = await rig.post(manualBody)
    expect(manualReplayAfterSettingsEdit.payload.execution).toMatchObject({ status: 'completed', onAir: true })
    expect(execution(manualReplayAfterSettingsEdit.payload)).not.toHaveProperty('automaticDurationSeconds')
    expect(execution(manualReplayAfterSettingsEdit.payload)).not.toHaveProperty('remainingDurationMs')

    const resume = await rig.post({ requestId: 'manual-resume', source: requestSource, type: 'mos-resume', template: 'DURATION_SOURCE' })
    expect(resume.payload.execution).toMatchObject({ status: 'completed', onAir: false })
    expect(execution(resume.payload)).not.toHaveProperty('automaticDurationSeconds')
    expect(execution(resume.payload)).not.toHaveProperty('remainingDurationMs')

    const blocked = await rig.post(playBody('blocked-play', 'UNKNOWN_SOURCE', 'Unknown'))
    expect(blocked.payload.execution).toMatchObject({ status: 'blocked', onAir: false })
    expect(execution(blocked.payload)).not.toHaveProperty('automaticDurationSeconds')
    expect(execution(blocked.payload)).not.toHaveProperty('remainingDurationMs')

    // Use a separate section runtime state after the preceding manual RESUME.
    rejectPlay = true
    const failed = await rig.post(playBody('failed-play', 'DURATION_SOURCE', 'Failure title'))
    expect(failed.payload.execution).toMatchObject({ status: 'failed', onAir: false })
    expect(execution(failed.payload)).not.toHaveProperty('automaticDurationSeconds')
    expect(execution(failed.payload)).not.toHaveProperty('remainingDurationMs')

    expect(requests.map(item => item.authorization)).toEqual(Array(5).fill(`Bearer ${accessKey}`))
    const expectedBodies = [
      manualBody,
      manualBody,
      { requestId: 'manual-resume', source: requestSource, type: 'mos-resume', template: 'DURATION_SOURCE' },
      playBody('blocked-play', 'UNKNOWN_SOURCE', 'Unknown'),
      playBody('failed-play', 'DURATION_SOURCE', 'Failure title'),
    ]
    expect(requests.map(item => item.body)).toEqual(expectedBodies)
    expect(rig.receivedBodies()).toEqual(expectedBodies)
  })
})

function playBody(requestId: string, template: string, title: string) {
  return { requestId, source: requestSource, type: 'mos-play', template, params: { Title: title } }
}

function createMapping(exitMode: 'manual-resume' | 'template-duration', durationSeconds: number): MosMappingConfig {
  return {
    version: 1,
    sections: [{
      id: sectionId,
      name: 'Duration contract QA',
      resumePlayDelayMs: 0,
      dataPropagationDelayMs: 0,
      targets: [{ id: 'single-target', template: 'FICTIONAL_LB_TEMPLATE' }],
      sources: [{
        id: 'duration-source',
        template: 'DURATION_SOURCE',
        exitMode,
        durationSeconds,
        fields: [{ id: 'title-field', param: 'Title', targetFields: { 'single-target': 'TITLE_FIELD' } }],
      }],
    }],
  }
}

async function createRig(options: {
  exitMode: 'manual-resume' | 'template-duration'
  durationSeconds: number
  onCommand?: (line: string) => string | undefined
  onHttpRequest?: (body: Record<string, unknown>, authorization: string | undefined) => void
}) {
  const config = createMapping(options.exitMode, options.durationSeconds)
  const resolutionConfig = structuredClone(config)
  const port = await listen(line => options.onCommand?.(line) ?? 'OK\n')
  const controller = new LiveBoardController({ mode: 'tcp', host: '127.0.0.1', port, timeoutMs: 500 }, config)
  controllers.push(controller)
  await controller.connect()

  const receiver = new LBPortalReceiver(
    'unused',
    () => undefined,
    body => resolveMosMapping(body, resolutionConfig),
    () => undefined,
    async (entry: ReceivedRequest) => {
      const body = entry.body!
      if (body.type === 'mos-resume') return controller.resumeSource(String(body.template), entry.mapping)
      const rawParams = body.params
      return controller.execute({
        requestId: String(body.requestId),
        template: String(body.template),
        ...(rawParams && typeof rawParams === 'object' ? { params: rawParams as Record<string, unknown> } : {}),
        ...(entry.mapping ? { mapping: entry.mapping } : {}),
      })
    },
    (entry, execution) => controller.getAutomaticDurationForRequest(String(entry.body?.requestId), execution, entry.mapping),
  )
  ;(receiver as unknown as { key: string }).key = accessKey
  const handle = (receiver as unknown as { handle(request: IncomingMessage, response: ServerResponse): Promise<void> }).handle.bind(receiver)

  return {
    setResolution(exitMode: 'manual-resume' | 'template-duration', durationSeconds: number) {
      resolutionConfig.sections[0]!.sources[0]!.exitMode = exitMode
      resolutionConfig.sections[0]!.sources[0]!.durationSeconds = durationSeconds
    },
    receivedBodies() {
      return receiver.getRequests().reverse().map(entry => entry.body)
    },
    post(body: Record<string, unknown>) {
      const serialized = JSON.stringify(body)
      const request = Readable.from([Buffer.from(serialized)]) as IncomingMessage
      const authorization = `Bearer ${accessKey}`
      Object.assign(request, {
        headers: { host: 'localhost:47835', origin: 'http://plasma.test', authorization, 'content-type': 'application/json' },
        socket: { remoteAddress: '127.0.0.1' },
        method: 'POST',
        url: '/v1/requests',
      })
      options.onHttpRequest?.(JSON.parse(serialized) as Record<string, unknown>, authorization)
      const state = { statusCode: 0, headers: {} as Record<string, string>, responseBody: '' }
      const response = {
        setHeader(name: string, value: string) { state.headers[name] = value },
        end(value?: string) { state.responseBody = value ?? '' },
      } as unknown as ServerResponse
      Object.defineProperty(response, 'statusCode', { get: () => state.statusCode, set: (value: number) => { state.statusCode = value }, configurable: true })
      return handle(request, response).then(() => ({
        statusCode: state.statusCode,
        headers: state.headers,
        payload: JSON.parse(state.responseBody) as Record<string, unknown>,
      }))
    },
  }
}

function listen(onCommand: (line: string) => string): Promise<number> {
  const server = net.createServer(socket => {
    socket.on('error', () => undefined)
    socket.write('Welcome to LiveBoard mock\n')
    let buffer = ''
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      let index: number
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        socket.write(onCommand(line))
      }
    })
  })
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
  })
}

function execution(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.execution as Record<string, unknown>
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}
