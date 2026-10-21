import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import { emptyMosMappingConfig, type MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import { defaultMosProjects, validateMosProjects } from '../../../src/shared/settings/mosProjects'

const connection = { mode: 'simulation' as const, host: '127.0.0.1', port: null, timeoutMs: 1000 }

function projects(interactions: NonNullable<ReturnType<typeof defaultMosProjects>['projects'][number]['interactions']>, sections: MosMappingConfig['sections']) {
  const mappings: MosMappingConfig = { ...emptyMosMappingConfig, sections }
  const defaults = defaultMosProjects(mappings)
  return validateMosProjects({ ...defaults, projects: defaults.projects.map(project => project.id === defaults.activeProjectId ? { ...project, interactions } : project) })
}

const source = (template: string, exitMode: 'manual-resume' | 'template-duration' = 'manual-resume', durationSeconds = 6, fields: MosMappingConfig['sections'][number]['sources'][number]['fields'] = []) => ({ id: `src-${template}`, template, exitMode, durationSeconds, fields })
const target = (id: string, template: string) => ({ id, template })
const graphicSection = (id: string, template: string) => ({ id, name: id, targets: [target(`${id}-target`, template)], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source(`${id}-source`)] })

async function execute(controller: LiveBoardController, request: Parameters<LiveBoardController['execute']>[0]) {
  const pending = controller.execute(request)
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(0)
  return pending
}

afterEach(() => vi.useRealTimers())

describe('LiveBoard interactions', () => {
  it('suspends and restores the exact active buffer at the configured six-second auto-exit', async () => {
    vi.useFakeTimers()
    const titleSection = { id: 'title', name: 'Title', targets: [target('title-a', 'Title-A'), target('title-b', 'Title-B')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('title-mos', 'manual-resume', 6, [{ id: 'title-field', param: 'Title', targetFields: { 'title-a': 'Headline', 'title-b': 'Headline' } }])] }
    const sourceSection = { id: 'source', name: 'Source', targets: [target('source-one', 'Source-1')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('source-mos', 'template-duration', 6)] }
    const config = projects([{ id: 'suspend-title', name: 'Pause title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'pause-title', kind: 'suspend', sectionId: 'title', delayMs: 0, restoreOn: 'auto-exit' }] }], [titleSection, sourceSection])
    const controller = new LiveBoardController(connection, config)
    try {
      await execute(controller, { requestId: 'title-1', template: 'title-mos', params: { Title: 'Original' } })
      expect(controller.snapshot.sections.find(section => section.sectionId === 'title')?.state).toBe('ON_A')
      await execute(controller, { requestId: 'source-1', template: 'source-mos' })
      const suspended = controller.snapshot.sections.find(section => section.sectionId === 'title')!
      expect(suspended.state).toBe('SUSPENDED')
      expect(suspended.suspendedBy?.sectionId).toBe('source')
      expect(suspended.activeBuffer).toBe('A')
      await vi.advanceTimersByTimeAsync(5999)
      expect(controller.snapshot.sections.find(section => section.sectionId === 'source')?.state).toBe('ON_SINGLE')
      await vi.advanceTimersByTimeAsync(1)
      await vi.advanceTimersByTimeAsync(0)
      const restored = controller.snapshot.sections.find(section => section.sectionId === 'title')!
      expect(restored.state).toBe('ON_A')
      expect(restored.activeBuffer).toBe('A')
      expect(restored.buffers.find(buffer => buffer.id === 'title-a')?.fields).toEqual({ Headline: 'Original' })
      const restore = controller.snapshot.operations.flatMap(operation => operation.steps).find(step => step.interactionRuleName === 'Pause title' && step.kind === 'play')
      expect(restore?.command).toContain('LBC_PLAYCONTENT "Title-A"')
      expect(controller.snapshot.operations.some(operation => operation.origin === 'auto-exit' && operation.autoExitSourceTemplate === 'source-mos')).toBe(true)
    } finally { controller.dispose() }
  })

  it('keeps only the latest valid title pending and makes superseded reports terminal', async () => {
    vi.useFakeTimers()
    const titleSection = { id: 'title', name: 'Title', targets: [target('title-a', 'Title-A')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('title-mos', 'manual-resume', 6, [{ id: 'title-field', param: 'Title', targetFields: { 'title-a': 'Headline' } }])] }
    const sourceSection = { id: 'source', name: 'Source', targets: [target('source-one', 'Source-1')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('source-mos', 'template-duration', 6)] }
    const config = projects([{ id: 'suspend-title', name: 'Pause title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'pause-title', kind: 'suspend', sectionId: 'title', delayMs: 0 }] }], [titleSection, sourceSection])
    const controller = new LiveBoardController(connection, config)
    try {
      await execute(controller, { requestId: 'title-1', template: 'title-mos', params: { Title: 'Original' } })
      await execute(controller, { requestId: 'source-1', template: 'source-mos' })
      expect((await execute(controller, { requestId: 'title-2', template: 'title-mos', params: { Title: 'Older pending' } })).status).toBe('queued')
      expect((await execute(controller, { requestId: 'title-3', template: 'title-mos', params: { Title: 'Latest pending' } })).status).toBe('queued')
      expect(controller.snapshot.operations.find(operation => operation.operationId === 'builtin-telejurnal:title-2')?.status).toBe('blocked')
      expect(controller.snapshot.sections.find(section => section.sectionId === 'title')?.pendingTemplate).toBe('title-mos')
      await vi.advanceTimersByTimeAsync(6000)
      await vi.runOnlyPendingTimersAsync()
      const restored = controller.snapshot.sections.find(section => section.sectionId === 'title')!
      expect(restored.state).toBe('ON_SINGLE')
      expect(restored.buffers[0]?.fields).toEqual({ Headline: 'Latest pending' })
      expect(controller.snapshot.operations.find(operation => operation.operationId === 'builtin-telejurnal:title-3')?.status).toBe('completed')
    } finally { controller.dispose() }
  })

  it('does not invent a restore for an OFF suspend target and interaction actions do not retrigger rules', async () => {
    const sourceSection = graphicSection('source', 'Source-1')
    const targetSection = graphicSection('target', 'Target-1')
    const downstreamSection = graphicSection('downstream', 'Downstream-1')
    const config = projects([
      { id: 'pause-off', name: 'Pause off target', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'suspend-off', kind: 'suspend', sectionId: 'target', delayMs: 0 }] },
      { id: 'resume-target', name: 'Resume target', enabled: true, triggerSectionId: 'source', event: 'after-stop', actions: [{ id: 'resume-active', kind: 'resume', sectionId: 'target', delayMs: 0 }] },
      { id: 'would-retrigger', name: 'Would retrigger', enabled: true, triggerSectionId: 'target', event: 'after-resume', actions: [{ id: 'play-downstream', kind: 'play', sectionId: 'downstream', targetId: 'downstream-target', delayMs: 0 }] },
    ], [sourceSection, targetSection, downstreamSection])
    const controller = new LiveBoardController(connection, config)
    try {
      const sourcePlay = await controller.execute({ requestId: 'source', template: 'source-source' })
      expect(sourcePlay.status).toBe('completed')
      expect(controller.snapshot.sections.find(section => section.sectionId === 'target')?.state).toBe('OFF')
      expect(controller.snapshot.sections.find(section => section.sectionId === 'target')?.pendingRestore).toBe(false)
      await controller.execute({ requestId: 'target', template: 'target-source' })
      await controller.stop('source')
      expect(controller.snapshot.sections.find(section => section.sectionId === 'target')?.state).toBe('OFF')
      expect(controller.snapshot.sections.find(section => section.sectionId === 'downstream')?.state).toBe('OFF')
      const steps = controller.snapshot.operations.filter(operation => operation.origin === 'interaction').flatMap(operation => operation.steps)
      expect(steps.some(step => step.interactionRuleName === 'Resume target' && step.command?.includes('LBC_RESUMECONTENT'))).toBe(true)
    } finally { controller.dispose() }
  })

  it('cancels a suspended restore with a local RESUME and stops every destination on auto-exit', async () => {
    vi.useFakeTimers()
    const sourceSection = { id: 'source', name: 'Source', targets: [target('source-one', 'Source-1')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('source-mos', 'template-duration', 6)] }
    const titleSection = { id: 'title', name: 'Title', targets: [target('title-a', 'Title-A'), target('title-b', 'Title-B')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('title-mos')] }
    const stopSection = { id: 'stop-targets', name: 'Stop targets', targets: [target('stop-a', 'Stop-A'), target('stop-b', 'Stop-B')], resumePlayDelayMs: 0, dataPropagationDelayMs: 0, sources: [source('stop-source')] }
    const config = projects([
      { id: 'pause-title', name: 'Pause title', enabled: true, triggerSectionId: 'source', event: 'before-play', actions: [{ id: 'pause-title-action', kind: 'suspend', sectionId: 'title', delayMs: 0 }] },
      { id: 'stop-after-exit', name: 'Stop after exit', enabled: true, triggerSectionId: 'source', event: 'after-auto-exit', actions: [{ id: 'stop-all', kind: 'stop', sectionId: 'stop-targets', delayMs: 0 }] },
    ], [sourceSection, titleSection, stopSection])
    const controller = new LiveBoardController(connection, config)
    try {
      await execute(controller, { requestId: 'title', template: 'title-mos' })
      await execute(controller, { requestId: 'source', template: 'source-mos' })
      expect(controller.snapshot.sections.find(section => section.sectionId === 'title')?.state).toBe('SUSPENDED')
      await controller.takeOut('title')
      const cancel = controller.snapshot.operations.find(operation => operation.origin === 'manual' && operation.beforeState === 'SUSPENDED')
      expect(cancel?.steps[0]?.command).toBeUndefined()
      expect(cancel?.steps[0]?.response).toContain('already suspended')
      await vi.advanceTimersByTimeAsync(6000)
      await vi.runOnlyPendingTimersAsync()
      expect(controller.snapshot.sections.find(section => section.sectionId === 'title')?.state).toBe('OFF')
      const stopSteps = controller.snapshot.operations.flatMap(operation => operation.steps).filter(step => step.interactionRuleName === 'Stop after exit' && step.kind === 'stop')
      expect(stopSteps.map(step => step.template).sort()).toEqual(['Stop-A', 'Stop-B'])
      expect(stopSteps.every(step => step.command?.includes('LBC_STOPCONTENT'))).toBe(true)
    } finally { controller.dispose() }
  })
})
