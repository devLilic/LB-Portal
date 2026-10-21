import { describe, expect, it, vi } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { LBPortalReceiver } from '../../../electron/main/ingress/LBPortalReceiver'
import type { ReceivedRequest } from '../../../src/shared/ingress/contracts'
import type { MosMappingResolution } from '../../../src/shared/ingress/mosMappingResolution'
import type { LiveBoardExecutionReport } from '../../../src/shared/liveboard/runtime'

const origin = 'http://plasma.test'

function harness(body: Record<string, unknown>, options: { authorization?: string; resolver?: (body: Record<string, unknown>) => MosMappingResolution; execute?: (entry: ReceivedRequest) => Promise<LiveBoardExecutionReport|null> } = {}) {
  const emitted: ReceivedRequest[] = []
  const resolver = options.resolver ?? vi.fn((value: Record<string, unknown>): MosMappingResolution => ({
    status: 'matched', template: String(value.template), project:{id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal'}, section: { id: 's', name: 'Section' },
    targets: [{ id: 't', template: 'LB-default', fields: [] }], exitMode: 'manual-resume', durationSeconds: 6,
    resumePlayDelayMs: 100, dataPropagationDelayMs:250, missingParams: [], unmappedParams: [],
  }))
  const receiver = new LBPortalReceiver('unused', entry => emitted.push(entry), resolver, undefined, options.execute)
  ;(receiver as unknown as { key: string }).key = 'test-key'
  const state = { statusCode: 0, headers: {} as Record<string, string>, responseBody: '' }
  const response = {
    setHeader(name: string, value: string) { state.headers[name] = value },
    end(value?: string) { state.responseBody = value ?? '' },
  } as unknown as ServerResponse
  Object.defineProperty(response, 'statusCode', { get: () => state.statusCode, set: (value: number) => { state.statusCode = value }, configurable: true })
  const handle = (receiver as unknown as { handle(request: IncomingMessage, response: ServerResponse): Promise<void> }).handle.bind(receiver)
  const run = (requestBody = body) => {
    const request = Readable.from([Buffer.from(JSON.stringify(requestBody))]) as IncomingMessage
    Object.assign(request, {
      headers: { host: 'localhost:47835', origin, authorization: options.authorization ?? 'Bearer test-key', 'content-type': 'application/json' },
      socket: { remoteAddress: '127.0.0.1' }, method: 'POST', url: '/v1/requests',
    })
    return handle(request, response)
  }
  return { receiver, emitted, resolver, state, run }
}

describe('receiver mapping snapshot', () => {
  it('invokes saved mapping resolution for accepted PLAY and preserves each emitted/history snapshot', async () => {
    let destination = 'LB-old'
    const h = harness({ requestId: 'id-1', source: 'plasma.test', type: 'mos-play', template: 'Plasma' }, {
      resolver: body => ({ status: 'matched', template: String(body.template), project:{id:'builtin-telejurnal',name:'Telejurnal',kind:'telejurnal'}, section: { id: 's', name: 'Section' }, targets: [{ id: 't', template: destination, fields: [] }], exitMode: 'manual-resume', durationSeconds: 6, resumePlayDelayMs: 100, dataPropagationDelayMs:250, missingParams: [], unmappedParams: [] }),
    })
    await h.run()
    const first = h.receiver.getRequests()[0]!
    expect(h.state.statusCode).toBe(200)
    expect(JSON.parse(h.state.responseBody)).toMatchObject({ ok: true, requestId: 'id-1' })
    expect(h.emitted[0]).toBe(first)
    expect(first.mapping?.status).toBe('matched')
    if (first.mapping?.status === 'matched') expect(first.mapping.targets[0]?.template).toBe('LB-old')

    destination = 'LB-new'
    await h.run({ requestId: 'id-2', source: 'plasma.test', type: 'mos-play', template: 'Plasma' })
    const latestMapping = h.receiver.getRequests()[0]?.mapping
    if (latestMapping?.status === 'matched') expect(latestMapping.targets[0]?.template).toBe('LB-new')
    if (first.mapping?.status === 'matched') expect(first.mapping.targets[0]?.template).toBe('LB-old')
  })

  it('keeps the accepted HTTP acknowledgement when settings resolution throws', async () => {
    const h = harness({ requestId: 'id-error', source: 'plasma.test', type: 'mos-play', template: 'Plasma' }, { resolver: () => { throw new Error('settings unavailable') } })
    await h.run()
    expect(h.state.statusCode).toBe(200)
    expect(JSON.parse(h.state.responseBody)).toMatchObject({ ok: true, requestId: 'id-error' })
    expect(h.receiver.getRequests()[0]?.mapping).toEqual({ status: 'settings-error', template: 'Plasma' })
  })

  it('does not invoke mapping resolution for rejected auth or accepted non-PLAY requests', async () => {
    const badAuth = harness({ requestId: 'bad', source: 'plasma.test', type: 'mos-play', template: 'Plasma' }, { authorization: 'Bearer wrong' })
    await badAuth.run()
    expect(badAuth.state.statusCode).toBe(401)
    expect(badAuth.resolver).not.toHaveBeenCalled()
    expect(badAuth.receiver.getRequests()[0]?.mapping).toBeUndefined()

    const other = harness({ requestId: 'other', source: 'plasma.test', type: 'healthcheck', template: 'Plasma' })
    await other.run()
    expect(other.state.statusCode).toBe(200)
    expect(other.resolver).not.toHaveBeenCalled()
    expect(other.receiver.getRequests()[0]?.mapping).toBeUndefined()
  })

  it('returns the confirmed LiveBoard state for PLAY and Resume requests', async () => {
    const h = harness({ requestId: 'resume-1', source: 'plasma.test', type: 'mos-resume', template: '02_Nume' }, {
      execute: async entry => entry.body?.type === 'mos-resume'
        ? ({status:'completed',mode:'tcp',projectId:'builtin-telejurnal',projectName:'Telejurnal',projectKind:'telejurnal',sectionId:'s',sectionName:'Section',sourceTemplate:'02_Nume',beforeState:'ON_SINGLE',afterState:'OFF',selectedTargetId:'t',selectedBuffer:'single',previousTargetId:null,nextBuffer:null,steps:[{kind:'resume',state:'completed',response:'Ok'}],error:null,confirmation:'protocol-acknowledged'})
        : ({status:'completed',mode:'tcp',projectId:'builtin-telejurnal',projectName:'Telejurnal',projectKind:'telejurnal',sectionId:'s',sectionName:'Section',sourceTemplate:'02_Nume',beforeState:'OFF',afterState:'ON_SINGLE',selectedTargetId:'t',selectedBuffer:'single',previousTargetId:null,nextBuffer:null,steps:[{kind:'play',state:'completed',response:'Ok'}],error:null,confirmation:'protocol-acknowledged'}),
    })
    await h.run()
    expect(JSON.parse(h.state.responseBody)).toMatchObject({requestId:'resume-1',execution:{status:'completed',sectionId:'s',playbackState:'OFF',onAir:false,confirmation:'protocol-acknowledged'}})
    expect(h.receiver.getRequests()[0]?.execution?.status).toBe('completed')
    await h.run({requestId:'play-1',source:'plasma.test',type:'mos-play',template:'02_Nume'})
    expect(JSON.parse(h.state.responseBody)).toMatchObject({requestId:'play-1',execution:{status:'completed',playbackState:'ON_SINGLE',onAir:true}})
  })
})
