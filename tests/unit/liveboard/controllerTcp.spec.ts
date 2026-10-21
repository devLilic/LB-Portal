import net, { type Server, type Socket } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import type { LiveBoardConnectionSettings } from '../../../src/shared/liveboard/connection'

const servers: Server[] = []
const controllers: LiveBoardController[] = []
const settings: Omit<LiveBoardConnectionSettings, 'port'> = { mode: 'tcp', host: '127.0.0.1', timeoutMs: 500 }
const sectionId = 'tcp-qa-section'
const mappings: MosMappingConfig = {
  version: 1,
  sections: [{
    id: sectionId, name: 'TCP QA', resumePlayDelayMs: 0, dataPropagationDelayMs: 0,
    targets: [{ id: 'A', template: '01_QA_A' }, { id: 'B', template: '01_QA_B' }],
    sources: [{ id: 'source', template: 'QA_SOURCE', exitMode: 'manual-resume', durationSeconds: 6, fields: [
      { id: 'title', param: 'Title', targetFields: { A: 'TITLE_A', B: 'TITLE_B' } },
      { id: 'subtitle', param: 'Subtitle', targetFields: { A: 'SUBTITLE_A', B: 'SUBTITLE_B' } },
    ] }],
  }],
}

afterEach(async () => {
  for (const controller of controllers.splice(0)) await controller.disconnect().catch(() => undefined)
  await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))))
})

describe('LiveBoard controller over TCP', () => {
  it('completes a protocol-acknowledged A/B/A sequence with full field writes and ordered transitions', async () => {
    const commands: string[] = []
    const port = await listen((line, socket) => { commands.push(line); socket.write('OK\n') })
    const controller = createController(port)
    await controller.connect()

    const a = await controller.execute(request('aba-a', 'A one', 'A subtitle one'))
    const b = await controller.execute(request('aba-b', 'B one', 'B subtitle one'))
    const aAgain = await controller.execute(request('aba-a2', 'A two', 'A subtitle two'))
    expect([a.status, b.status, aAgain.status]).toEqual(['completed', 'completed', 'completed'])
    expect([a.confirmation, b.confirmation, aAgain.confirmation]).toEqual(['protocol-acknowledged', 'protocol-acknowledged', 'protocol-acknowledged'])
    expect(a.steps.map(step => step.kind)).toEqual(['set-field', 'set-field', 'wait-data', 'play'])
    expect(b.steps.map(step => step.kind)).toEqual(['set-field', 'set-field', 'wait-data', 'resume', 'wait-transition', 'play'])
    expect(aAgain.steps.map(step => step.kind)).toEqual(['set-field', 'set-field', 'wait-data', 'resume', 'wait-transition', 'play'])
    expect(commands).toEqual([
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_A", "TITLE_A", "A one"',
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_A", "SUBTITLE_A", "A subtitle one"',
      'LBC_PLAYCONTENT "01_QA_A"',
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_B", "TITLE_B", "B one"',
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_B", "SUBTITLE_B", "B subtitle one"',
      'LBC_RESUMECONTENT "01_QA_A"',
      'LBC_PLAYCONTENT "01_QA_B"',
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_A", "TITLE_A", "A two"',
      'LBC_SETTEMPLATEOBJECTVALUE "01_QA_A", "SUBTITLE_A", "A subtitle two"',
      'LBC_RESUMECONTENT "01_QA_B"',
      'LBC_PLAYCONTENT "01_QA_A"',
    ])
    expect(section(controller).buffers[0].fields).toEqual({ TITLE_A: 'A two', SUBTITLE_A: 'A subtitle two' })
    expect(section(controller).buffers[1].fields).toEqual({ TITLE_B: 'B one', SUBTITLE_B: 'B subtitle one' })
  })

  it('keeps A on-air after a hidden B field error, retries all fields, then resyncs on transition error and tries every STOP', async () => {
    const commands: string[] = []
    let failHiddenBField = true
    let failResume = true
    let failStopA = true
    const port = await listen((line, socket) => {
      commands.push(line)
      if (failHiddenBField && line.includes('"01_QA_B", "SUBTITLE_B"')) { failHiddenBField = false; socket.write('Error injected hidden-buffer field failure\n'); return }
      if (failResume && line.startsWith('LBC_RESUMECONTENT "01_QA_A"')) { failResume = false; socket.write('Error injected RESUME failure\n'); return }
      if (failStopA && line.startsWith('LBC_STOPCONTENT "01_QA_A"')) { failStopA = false; socket.write('Error injected STOP A failure\n'); return }
      socket.write('OK\n')
    })
    const controller = createController(port)
    await controller.connect()

    const first = await controller.execute(request('request-a1', 'A1', 'A subtitle 1'))
    expect(first.status).toBe('completed')
    expect(section(controller).state).toBe('ON_A')

    const bFailed = await controller.execute(request('request-b1', 'B1', 'B subtitle 1'))
    expect(bFailed.status).toBe('failed')
    expect(section(controller).state).toBe('ON_A')
    expect(section(controller).activeBuffer).toBe('A')
    expect(commands.some(line => line.startsWith('LBC_RESUMECONTENT'))).toBe(false)
    expect(commands.some(line => line.startsWith('LBC_PLAYCONTENT "01_QA_B"'))).toBe(false)

    const beforeRetry = commands.filter(line => line.includes('"01_QA_B"'))
    const retry = await controller.execute(request('request-b2', 'B2', 'B subtitle 2'))
    expect(retry.status).toBe('failed')
    expect(retry.afterState).toBe('NEEDS_RESYNC')
    const afterRetry = commands.filter(line => line.includes('"01_QA_B"'))
    expect(afterRetry.slice(beforeRetry.length).map(line => line.match(/"(TITLE_B|SUBTITLE_B)"/)?.[1])).toEqual(['TITLE_B', 'SUBTITLE_B'])
    expect(commands.filter(line => line.startsWith('LBC_PLAYCONTENT "01_QA_B"'))).toHaveLength(0)
    expect(commands.some(line => line.startsWith('LBC_RESUMECONTENT "01_QA_A"'))).toBe(true)
    expect(section(controller).state).toBe('NEEDS_RESYNC')

    const blocked = await controller.execute(request('request-b3', 'B3', 'B subtitle 3'))
    expect(blocked.status).toBe('blocked')
    expect(blocked.error).toMatch(/resync/i)

    const beforeStop = commands.length
    await controller.stop(sectionId)
    const stopCommands = commands.slice(beforeStop).filter(line => line.startsWith('LBC_STOPCONTENT'))
    expect(stopCommands).toEqual(['LBC_STOPCONTENT "01_QA_A"', 'LBC_STOPCONTENT "01_QA_B"'])
    expect(section(controller).state).toBe('NEEDS_RESYNC')

    await controller.stop(sectionId)
    expect(section(controller).state).toBe('OFF')
  })

  it('marks disconnect while timed content is active as NEEDS_RESYNC and reconnect does not replay', async () => {
    const timedMappings = structuredClone(mappings)
    timedMappings.sections[0].sources[0].exitMode = 'template-duration'
    timedMappings.sections[0].sources[0].durationSeconds = 0.05
    const commands: string[] = []
    const port = await listen((line, socket) => { commands.push(line); socket.write('OK\n') })
    const controller = new LiveBoardController({ ...settings, port }, timedMappings)
    controllers.push(controller)
    await controller.connect()
    const report = await controller.execute(request('timed-request', 'timed', 'timed subtitle'))
    expect(report.status).toBe('completed')
    expect(section(controller).state).toBe('ON_A')
    await controller.disconnect()
    expect(section(controller).state).toBe('NEEDS_RESYNC')
    const sentBeforeReconnect = [...commands]
    await controller.connect()
    expect(commands).toEqual(sentBeforeReconnect)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(section(controller).state).toBe('NEEDS_RESYNC')
    expect(commands).toEqual(sentBeforeReconnect)
  })

  it('marks an unexpected server disconnect as NEEDS_RESYNC and cancels the duration timer', async () => {
    const timedMappings = structuredClone(mappings)
    timedMappings.sections[0].sources[0].exitMode = 'template-duration'
    timedMappings.sections[0].sources[0].durationSeconds = 0.05
    const commands: string[] = []
    const port = await listen((line, socket) => {
      commands.push(line)
      socket.write('OK\n')
      if (line.startsWith('LBC_PLAYCONTENT')) setTimeout(() => socket.destroy(), 5)
    })
    const controller = new LiveBoardController({ ...settings, port }, timedMappings)
    controllers.push(controller)
    await controller.connect()
    const report = await controller.execute(request('server-drop-request', 'drop', 'drop subtitle'))
    expect(report.status).toBe('completed')
    await waitUntil(() => controller.snapshot.connection.status === 'error')
    expect(section(controller).state).toBe('NEEDS_RESYNC')
    const beforeWait = [...commands]
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(section(controller).state).toBe('NEEDS_RESYNC')
    expect(commands).toEqual(beforeWait)
  })
})

function createController(port: number) {
  const controller = new LiveBoardController({ ...settings, port }, mappings)
  controllers.push(controller)
  return controller
}

function request(requestId: string, title: string, subtitle: string) {
  return { requestId, template: 'QA_SOURCE', params: { Title: title, Subtitle: subtitle } }
}

function section(controller: LiveBoardController) {
  return controller.snapshot.sections.find(item => item.sectionId === sectionId)!
}

function listen(onCommand: (line: string, socket: Socket) => void): Promise<number> {
  const server = net.createServer(socket => {
    socket.on('error', () => undefined)
    socket.write('Welcome to LiveBoard mock\n')
    let buffer = ''
    socket.on('data', chunk => {
      buffer += chunk.toString('utf8')
      let index
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '')
        buffer = buffer.slice(index + 1)
        onCommand(line, socket)
      }
    })
  })
  servers.push(server)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port))
  })
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000) {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('Condition did not become true before timeout.')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}
