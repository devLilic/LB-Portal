import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultMosProjects, type MosProjectsConfig } from '../../../src/shared/settings/mosProjects'
import type { OnAirGraphicMapping } from '../../../src/shared/onair/mappings'
import type { MosMappingConfig } from '../../../src/shared/settings/mosMappings'
import { onAirInvokeChannels } from '../../../src/shared/onair/contracts'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  settings: {} as Record<string, unknown>,
}))

vi.mock('electron', () => ({
  app: { getPath: () => 'unused', on: vi.fn() },
  ipcMain: { handle: (channel: string, handler: (...args: any[]) => any) => mocks.handlers.set(channel, handler) },
}))

vi.mock('../../../electron/main/modules/settings/settingsStore', () => ({
  createSettingsStore: () => ({ getSetting: (key: string) => mocks.settings[key], setSetting: vi.fn() }),
}))

vi.mock('../../../electron/main/modules/settings/settingsSave', () => ({ saveSettingFromIpc: vi.fn() }))

vi.mock('../../../electron/main/ingress/LBPortalReceiver', () => ({
  LBPortalReceiver: class {
    start() { return Promise.resolve() }
    close() { return Promise.resolve() }
    getInfo() { return {} }
    getRequests() { return [] }
    clearRequests() {}
    updateExecution() {}
  },
}))

import { registerLBPortalIngress } from '../../../electron/main/ingress/registerLBPortalIngress'

const sectionMappings: MosMappingConfig = {
  version: 1,
  sections: [{
    id: 'people-section', name: 'People', resumePlayDelayMs: 0, dataPropagationDelayMs: 0,
    targets: [{ id: 'target-a', template: 'PERSON-A' }, { id: 'target-b', template: 'PERSON-B' }],
    sources: [],
  }],
}

function makeProject(fields: OnAirGraphicMapping['fields']): MosProjectsConfig {
  const projects = defaultMosProjects()
  const active = {
    id: 'onair-test', name: 'OnAir test', kind: 'standalone' as const,
    mappings: sectionMappings,
    onAirMappings: [{ id: 'person-map', kind: 'persons' as const, sourceTemplate: 'PA_persons', sectionId: 'people-section', fields }],
  }
  return { ...projects, activeProjectId: active.id, projects: [...projects.projects, active] }
}

async function invoke(values: Record<string, string>, action: 'play' | 'resume' = 'play') {
  const handler = mocks.handlers.get(onAirInvokeChannels.playItem)
  if (!handler) throw new Error('OnAir PLAY IPC handler was not registered.')
  return handler({ senderFrame: { url: 'file:///app/index.html' } }, {
    projectId: 'onair-test', kind: 'persons', itemId: 'person-1', sourceTemplate: 'PA_persons', values, action,
  })
}

describe('registered OnAir PLAY/Resume mapping', () => {
  beforeEach(() => {
    mocks.handlers.clear()
  })

  it('preserves composed mappings through PLAY, buffer switching, and Resume', async () => {
    const fields: OnAirGraphicMapping['fields'] = [
      { id: 'name-role', sourceField: 'Nume', sourceField2: 'Functie', targetFields: { 'target-a': ['Nume', 'Nume_M'], 'target-b': ['Nume', 'Nume_M'] } },
      { id: 'custom', sourceField: 'Nume', sourceField2: 'Functie', separator: ' / ', targetFields: { 'target-a': ['Custom'] } },
      { id: 'empty-role', sourceField: 'Nume', sourceField2: 'Functie', targetFields: { 'target-a': ['EmptyRole'] } },
      { id: 'legacy', sourceField: 'Nume', targetFields: { 'target-b': ['Legacy'] } },
    ]
    mocks.settings = { liveBoardConnection: { mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 1000 }, mosMappings: makeProject(fields) }
    registerLBPortalIngress(() => null)

    const values = { Nume: 'ION POPESCU', Functie: 'Ministru' }
    const played = await invoke(values)
    expect(played.execution.status).toBe('completed')
    expect(played.execution.steps.filter((step: any) => step.kind === 'set-field').map((step: any) => [step.targetId, step.field, step.value])).toEqual([
      ['target-a', 'Nume', 'ION POPESCU, Ministru'],
      ['target-a', 'Nume_M', 'ION POPESCU, Ministru'],
      ['target-a', 'Custom', 'ION POPESCU / Ministru'],
      ['target-a', 'EmptyRole', 'ION POPESCU, Ministru'],
    ])

    const playedB = await invoke(values)
    expect(playedB.execution.status).toBe('completed')
    expect(playedB.execution.steps.filter((step: any) => step.kind === 'set-field').map((step: any) => [step.targetId, step.field, step.value])).toEqual([
      ['target-b', 'Nume', 'ION POPESCU, Ministru'],
      ['target-b', 'Nume_M', 'ION POPESCU, Ministru'],
      ['target-b', 'Legacy', 'ION POPESCU'],
    ])

    const resumed = await invoke(values, 'resume')
    expect(resumed.execution.status).toBe('completed')
    expect(resumed.execution.afterState).toBe('OFF')
    expect(resumed.execution.steps.filter((step: any) => step.kind === 'set-field')).toEqual([])

    const oneEmpty = await invoke({ Nume: '', Functie: 'Ministru' })
    expect(oneEmpty.execution.steps.filter((step: any) => step.kind === 'set-field').map((step: any) => [step.field, step.value])).toEqual([
      ['Nume', 'Ministru'], ['Nume_M', 'Ministru'], ['Custom', 'Ministru'], ['EmptyRole', 'Ministru'],
    ])
  })
})
