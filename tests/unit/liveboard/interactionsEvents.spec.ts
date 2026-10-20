import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import { guardLiveBoardSetting, LiveBoardSettingsGuardError } from '../../../electron/main/liveboard/settingsGuard'
import { emptyMosMappingConfig, type MosMappingConfig, type MosMappingSection } from '../../../src/shared/settings/mosMappings'
import { defaultMosProjects, validateMosProjects } from '../../../src/shared/settings/mosProjects'
import type { MosInteractionRule } from '../../../src/shared/settings/mosInteractions'

const connection = { mode: 'simulation' as const, host: '127.0.0.1', port: null, timeoutMs: 1000 }
const target = (id: string, template: string) => ({ id, template })
const source = (id: string, template: string, exitMode: 'manual-resume' | 'template-duration' = 'manual-resume', durationSeconds = 6, fields: MosMappingSection['sources'][number]['fields'] = []) => ({ id, template, exitMode, durationSeconds, fields })
const section = (id: string, name = id, template = `${id}-template`, sources = [source(`${id}-source`, `${id}-mos`)], targets = [target(`${id}-target`, template)]): MosMappingSection => ({ id, name, targets, resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources })
function projects(sections: MosMappingSection[], interactions: MosInteractionRule[] = []) {
  const mappings: MosMappingConfig = { ...emptyMosMappingConfig, sections }
  const defaults = defaultMosProjects(mappings)
  return validateMosProjects({ ...defaults, projects: defaults.projects.map(project => project.id === defaults.activeProjectId ? { ...project, interactions } : project) })
}
function controllerWithTwoTargetStopRule() {
  const trigger = section('trigger', 'Trigger', 'Trigger-1')
  const targets = section('stop-targets', 'Stop targets', 'unused', [source('stop-source', 'stop-mos')], [target('stop-a', 'Stop-A'), target('stop-b', 'Stop-B')])
  const rule: MosInteractionRule = { id: 'stop-both', name: 'Stop both targets', enabled: true, triggerSectionId: 'trigger', event: 'before-play', actions: [{ id: 'stop-targets-action', kind: 'stop', sectionId: 'stop-targets', delayMs: 0 }] }
  return new LiveBoardController(connection, projects([trigger, targets], [rule]))
}
async function execute(controller: LiveBoardController, request: Parameters<LiveBoardController['execute']>[0]) {
  const pending = controller.execute(request)
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
  return pending
}
afterEach(() => vi.useRealTimers())

describe('LiveBoard interaction events and preflight', () => {
  it('runs an after-resume interaction PLAY against its configured static destination', async () => {
    const origin = section('origin', 'Origin', 'Origin-1', [source('origin-source', 'origin-mos')])
    const destination = section('destination', 'Destination', 'Static-Destination', [source('destination-source', 'destination-mos')])
    const rule: MosInteractionRule = { id: 'after-resume-play', name: 'Play static destination', enabled: true, triggerSectionId: 'origin', event: 'after-resume', actions: [{ id: 'play-destination', kind: 'play', sectionId: 'destination', targetId: 'destination-target', delayMs: 0 }] }
    const controller = new LiveBoardController(connection, projects([origin, destination], [rule]))
    try {
      expect((await execute(controller, { requestId: 'origin-play', template: 'origin-mos' })).status).toBe('completed')
      const operationsBefore = controller.snapshot.operations.length
      await controller.takeOut('origin')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'destination')?.state).toBe('ON_SINGLE')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'destination')?.activeBuffer).toBe('single')
      const report = controller.snapshot.operations.slice(operationsBefore).flatMap(operation => operation.steps).find(step => step.interactionRuleName === rule.name)
      expect(report?.interactionAction).toBe('play')
      expect(report?.template).toBe('Static-Destination')
      expect(report?.command).toContain('LBC_PLAYCONTENT "Static-Destination"')
    } finally { controller.dispose() }
  })

  it('returns typed settings denials while sections are active or suspended', async () => {
    vi.useFakeTimers()
    const title = section('title', 'Title', 'Title-1', [source('title-source', 'title-mos')])
    const sourceSection = section('source', 'Source', 'Source-1', [source('source-source', 'source-mos', 'template-duration', 6)])
    const rule: MosInteractionRule = { id: 'suspend-title', name: 'Suspend title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'suspend-title-action', kind: 'suspend', sectionId: 'title', delayMs: 0, restoreOn: 'auto-exit' }] }
    const config = projects([title, sourceSection], [rule])
    const controller = new LiveBoardController(connection, config)
    controller.installSettingsGuard()
    const changed = validateMosProjects({ ...config, projects: config.projects.map(project => project.id === config.activeProjectId ? { ...project, interactions: [{ ...rule, enabled: false }] } : project) })
    try {
      await execute(controller, { requestId: 'title-active', template: 'title-mos' })
      expect(() => guardLiveBoardSetting('mosMappings', changed)).toThrowError(expect.objectContaining<Partial<LiveBoardSettingsGuardError>>({ code: 'MOS_MAPPINGS_ACTIVE', sectionNames: ['Title'] }))
      await execute(controller, { requestId: 'source-play', template: 'source-mos' })
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.state).toBe('SUSPENDED')
      expect(() => guardLiveBoardSetting('mosMappings', changed)).toThrowError(expect.objectContaining<Partial<LiveBoardSettingsGuardError>>({ code: 'MOS_MAPPINGS_ACTIVE', sectionNames: ['Title', 'Source'] }))
    } finally { controller.dispose() }
  })

  it('does not leave a pending restoration when source PLAY fails after suspension', async () => {
    const title = section('title', 'Title', 'Title-1', [source('title-source', 'title-mos')])
    const sourceSection = section('source', 'Source', 'Source-1', [source('source-source', 'source-mos')])
    const rule: MosInteractionRule = { id: 'suspend-title', name: 'Suspend title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'suspend-title-action', kind: 'suspend', sectionId: 'title', delayMs: 0, restoreOn: 'auto-exit' }] }
    const controller = new LiveBoardController(connection, projects([title, sourceSection], [rule]))
    try {
      await execute(controller, { requestId: 'title-active', template: 'title-mos' })
      const play = vi.spyOn((controller as any).transport, 'play').mockRejectedValueOnce(new Error('source PLAY failed'))
      const report = await execute(controller, { requestId: 'source-fails', template: 'source-mos' })
      expect(report.status).toBe('failed')
      expect(play).toHaveBeenCalledOnce()
      expect(report.steps.find(step => step.kind === 'suspend')?.state).toBe('completed')
      const suspendedTarget = controller.snapshot.sections.find(item => item.sectionId === 'title')!
      expect(suspendedTarget.state).toBe('NEEDS_RESYNC')
      expect(suspendedTarget.pendingRestore).toBe(false)
      expect(suspendedTarget.suspendedBy).toBeNull()
    } finally { controller.dispose() }
  })

  it.each(['stop', 'resync'] as const)('%s on the timed source cancels its suspended target return', async exit => {
    vi.useFakeTimers()
    const title = section('title', 'Title', 'Title-1', [source('title-source', 'title-mos')])
    const sourceSection = section('source', 'Source', 'Source-1', [source('source-source', 'source-mos', 'template-duration', 6)])
    const rule: MosInteractionRule = { id: 'suspend-title', name: 'Suspend title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'suspend-title-action', kind: 'suspend', sectionId: 'title', delayMs: 0, restoreOn: 'auto-exit' }] }
    const controller = new LiveBoardController(connection, projects([title, sourceSection], [rule]))
    try {
      await execute(controller, { requestId: 'title-active', template: 'title-mos' })
      await execute(controller, { requestId: 'source-play', template: 'source-mos' })
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.pendingRestore).toBe(true)
      if (exit === 'stop') await controller.stop('source')
      else await controller.resync('source', 'OFF')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.state).toBe('OFF')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.pendingRestore).toBe(false)
      await vi.advanceTimersByTimeAsync(6000)
      await vi.runOnlyPendingTimersAsync()
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.state).toBe('OFF')
      expect(controller.snapshot.operations.flatMap(operation => operation.steps).some(step => step.interactionRuleName === rule.name && step.interactionAction === 'play')).toBe(false)
    } finally { controller.dispose() }
  })

  it('preflights cached field requirements before running earlier interaction actions', async () => {
    const control = section('control', 'Control', 'Control-1', [source('control-source', 'control-mos')])
    const prepared = section('prepared', 'Prepared', 'Prepared-1', [source('prepared-source', 'prepared-mos', 'manual-resume', 6, [{ id: 'required-field', param: 'Value', targetFields: { 'prepared-target': 'Headline' } }])])
    const trigger = section('trigger', 'Trigger', 'Trigger-1', [source('trigger-source', 'trigger-mos')])
    const rule: MosInteractionRule = { id: 'preflight', name: 'Preflight all actions', enabled: true, triggerSectionId: 'trigger', event: 'before-play', actions: [{ id: 'stop-control', kind: 'stop', sectionId: 'control', delayMs: 0 }, { id: 'play-prepared', kind: 'play', sectionId: 'prepared', targetId: 'prepared-target', delayMs: 0 }] }
    const controller = new LiveBoardController(connection, projects([control, prepared, trigger], [rule]))
    try {
      await execute(controller, { requestId: 'control-active', template: 'control-mos' })
      const stop = vi.spyOn((controller as any).transport, 'stop')
      const report = await execute(controller, { requestId: 'trigger-play', template: 'trigger-mos' })
      expect(report.status).toBe('failed')
      expect(report.error).toContain('requires prepared fields')
      expect(stop).not.toHaveBeenCalled()
      expect(controller.snapshot.sections.find(item => item.sectionId === 'control')?.state).toBe('ON_SINGLE')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'trigger')?.state).toBe('OFF')
    } finally { controller.dispose() }
  })

  it('keeps each STOP target result when the second target fails', async () => {
    const controller = controllerWithTwoTargetStopRule()
    const stop = vi.spyOn((controller as any).transport, 'stop')
      .mockResolvedValueOnce({ command: 'STOP A', response: 'ACK A', acknowledged: true })
      .mockRejectedValueOnce(new Error('Stop-B rejected'))
    try {
      const report = await execute(controller, { requestId: 'stop-second-fails', template: 'trigger-mos' })
      const stopSteps = report.steps.filter(step => step.interactionAction === 'stop')
      expect(report.status).toBe('failed')
      expect(stop).toHaveBeenNthCalledWith(1, 'Stop-A')
      expect(stop).toHaveBeenNthCalledWith(2, 'Stop-B')
      expect(stopSteps).toHaveLength(2)
      expect(stopSteps[0]).toMatchObject({ template: 'Stop-A', state: 'completed', response: 'ACK A' })
      expect(stopSteps[0].error).toBeUndefined()
      expect(stopSteps[1]).toMatchObject({ template: 'Stop-B', state: 'failed', error: 'Stop-B rejected' })
      expect(stopSteps[1].response).toBeUndefined()
    } finally { controller.dispose() }
  })

  it('keeps each STOP target result when the first target fails', async () => {
    const controller = controllerWithTwoTargetStopRule()
    const stop = vi.spyOn((controller as any).transport, 'stop')
      .mockRejectedValueOnce(new Error('Stop-A rejected'))
      .mockResolvedValueOnce({ command: 'STOP B', response: 'ACK B', acknowledged: true })
    try {
      const report = await execute(controller, { requestId: 'stop-first-fails', template: 'trigger-mos' })
      const stopSteps = report.steps.filter(step => step.interactionAction === 'stop')
      expect(report.status).toBe('failed')
      expect(stop).toHaveBeenNthCalledWith(1, 'Stop-A')
      expect(stop).toHaveBeenNthCalledWith(2, 'Stop-B')
      expect(stopSteps).toHaveLength(2)
      expect(stopSteps[0]).toMatchObject({ template: 'Stop-A', state: 'failed', error: 'Stop-A rejected' })
      expect(stopSteps[0].response).toBeUndefined()
      expect(stopSteps[1]).toMatchObject({ template: 'Stop-B', state: 'completed', response: 'ACK B' })
      expect(stopSteps[1].error).toBeUndefined()
    } finally { controller.dispose() }
  })

  it('rejects missing fields while suspended without replacing a valid pending request', async () => {
    vi.useFakeTimers()
    const title = section('title', 'Title', 'Title-1', [source('title-source', 'title-mos', 'manual-resume', 6, [{ id: 'title-value', param: 'Title', targetFields: { 'title-target': 'Headline' } }])])
    const sourceSection = section('source', 'Source', 'Source-1', [source('source-source', 'source-mos', 'template-duration', 6)])
    const rule: MosInteractionRule = { id: 'suspend-title', name: 'Suspend title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'suspend-title-action', kind: 'suspend', sectionId: 'title', delayMs: 0, restoreOn: 'auto-exit' }] }
    const controller = new LiveBoardController(connection, projects([title, sourceSection], [rule]))
    try {
      await execute(controller, { requestId: 'title-original', template: 'title-mos', params: { Title: 'Original' } })
      await execute(controller, { requestId: 'source-play', template: 'source-mos' })
      const pending = await execute(controller, { requestId: 'title-pending', template: 'title-mos', params: { Title: 'Valid pending' } })
      expect(pending.status).toBe('queued')
      const missing = await execute(controller, { requestId: 'title-missing', template: 'title-mos', params: {} })
      expect(missing.status).toBe('blocked')
      expect(missing.error).toContain('Missing mapped parameter')
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.pendingTemplate).toBe('title-mos')
      await vi.advanceTimersByTimeAsync(6000)
      await vi.runOnlyPendingTimersAsync()
      expect(controller.snapshot.sections.find(item => item.sectionId === 'title')?.buffers[0]?.fields).toEqual({ Headline: 'Valid pending' })
      expect(controller.snapshot.operations.find(operation => operation.operationId?.endsWith(':title-missing'))?.status).toBe('blocked')
    } finally { controller.dispose() }
  })
})
