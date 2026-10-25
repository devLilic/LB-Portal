import { afterEach, describe, expect, it, vi } from 'vitest'
import { LiveBoardController } from '../../../electron/main/liveboard/controller'
import { guardLiveBoardSetting } from '../../../electron/main/liveboard/settingsGuard'
import { defaultMosProjects } from '../../../src/shared/settings/mosProjects'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import type { LiveBoardTransport } from '../../../electron/main/liveboard/transport'
import type { OnAirGraphicMapping } from '../../../src/shared/onair/mappings'

const mapping: MosMappingConfig = {
  version: 1,
  sections: [{
    id: 'onair-source-section', name: 'OnAir titles', resumePlayDelayMs: 0, dataPropagationDelayMs: 0,
    targets: [{ id: 'A', template: 'OnAir-A' }, { id: 'B', template: 'OnAir-B' }],
    sources: [{ id: 'source', template: 'OnAir-MOS', exitMode: 'template-duration', durationSeconds: 30, fields: [
      { id: 'title', param: 'Title', targetFields: { A: 'TITLE_A', B: 'TITLE_B' } },
    ] }],
  }],
}

afterEach(() => vi.useRealTimers())

describe('OnAir source-only project settings', () => {
  it('preserves active playback and its timer without creating transport commands', async () => {
    vi.useFakeTimers()
    const initial = defaultMosProjects(mapping)
    const controller = new LiveBoardController({ mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 500 }, initial)
    try {
      controller.installSettingsGuard()
      const pending = controller.execute({ requestId: 'onair-source-active', template: 'OnAir-MOS', params: { Title: 'Current title' } })
      await vi.advanceTimersByTimeAsync(0)
      const report = await pending
      expect(report.status).toBe('completed')
      expect(controller.snapshot.sections[0]?.state).toBe('ON_A')
      const runtime = controller as unknown as { runtimes: Map<string, { timerExpiresAt: number | null }> }
      const timerExpiresAt = runtime.runtimes.get('onair-source-section')?.timerExpiresAt
      const operationsBeforeSave = structuredClone(controller.snapshot.operations)
      const transport = (controller as unknown as { transport: LiveBoardTransport }).transport
      const commandSpies = [
        vi.spyOn(transport, 'setField'), vi.spyOn(transport, 'play'), vi.spyOn(transport, 'resume'), vi.spyOn(transport, 'stop'),
      ]
      commandSpies.forEach(spy => spy.mockClear())

      await vi.advanceTimersByTimeAsync(1000)
      const projectsWithSource = {
        ...initial,
        projects: initial.projects.map(project => project.id === initial.activeProjectId
          ? { ...project, onAirCsv: { format: 'pa-csv' as const, folderPath: 'C:\\PA\\Export' } }
          : project),
      }

      expect(() => guardLiveBoardSetting('mosMappings', projectsWithSource)).not.toThrow()
      controller.setProjects(projectsWithSource)

      expect(controller.snapshot.sections[0]?.state).toBe('ON_A')
      expect(runtime.runtimes.get('onair-source-section')?.timerExpiresAt).toBe(timerExpiresAt)
      expect(timerExpiresAt! - Date.now()).toBe(29000)
      expect(controller.snapshot.operations).toEqual(operationsBeforeSave)
      expect(controller.snapshot.sections[0]?.buffers[0]?.fields).toEqual({ TITLE_A: 'Current title' })
      expect(commandSpies.every(spy => spy.mock.calls.length === 0)).toBe(true)
    } finally {
      controller.dispose()
    }
  })

  it('preserves active playback and its timer when only OnAir graphics settings change', async () => {
    vi.useFakeTimers()
    const initial = defaultMosProjects(mapping)
    const controller = new LiveBoardController({ mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 500 }, initial)
    try {
      controller.installSettingsGuard()
      const pending = controller.execute({ requestId: 'onair-map-active', template: 'OnAir-MOS', params: { Title: 'Current title' } })
      await vi.advanceTimersByTimeAsync(0)
      expect((await pending).status).toBe('completed')
      expect(controller.snapshot.sections[0]?.state).toBe('ON_A')
      const runtime = controller as unknown as { runtimes: Map<string, { timerExpiresAt: number | null }> }
      const timerExpiresAt = runtime.runtimes.get('onair-source-section')?.timerExpiresAt
      const operationsBeforeSave = structuredClone(controller.snapshot.operations)
      const transport = (controller as unknown as { transport: LiveBoardTransport }).transport
      const commandSpies = [
        vi.spyOn(transport, 'setField'), vi.spyOn(transport, 'play'), vi.spyOn(transport, 'resume'), vi.spyOn(transport, 'stop'),
      ]
      commandSpies.forEach(spy => spy.mockClear())
      await vi.advanceTimersByTimeAsync(1000)

      const onAirMappings: OnAirGraphicMapping[] = [{
        id: 'csv-title-map', kind: 'titles', sourceTemplate: '05_Titlu', sectionId: 'onair-source-section', fields: [
          { id: 'csv-title-field', sourceField: 'Titlu', targetFields: { A: ['TITLE_A'], B: ['TITLE_B'] } },
        ],
      }]
      const projectsWithOnAirMapping = {
        ...initial,
        projects: initial.projects.map(project => project.id === initial.activeProjectId
          ? { ...project, onAirMappings, onAirDefaultTemplates: { locations: 'PA_Location' } }
          : project),
      }

      expect(() => guardLiveBoardSetting('mosMappings', projectsWithOnAirMapping)).not.toThrow()
      controller.setProjects(projectsWithOnAirMapping)

      expect(controller.snapshot.sections[0]?.state).toBe('ON_A')
      expect(runtime.runtimes.get('onair-source-section')?.timerExpiresAt).toBe(timerExpiresAt)
      expect(timerExpiresAt! - Date.now()).toBe(29000)
      expect(controller.snapshot.operations).toEqual(operationsBeforeSave)
      expect(controller.snapshot.sections[0]?.buffers[0]?.fields).toEqual({ TITLE_A: 'Current title' })
      expect(commandSpies.every(spy => spy.mock.calls.length === 0)).toBe(true)
    } finally {
      controller.dispose()
    }
  })
})
