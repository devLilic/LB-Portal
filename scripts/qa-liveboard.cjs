/* Isolated Electron QA for simulation-first LiveBoard control.
 * Uses a temporary Electron userData directory and the bundled mock TCP server;
 * it never reads or writes the operator's normal app data or connects to hardware.
 */
const { _electron } = require('playwright')
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const http = require('node:http')
const net = require('node:net')
const { spawn } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'lbportal-liveboard-qa-'))
let application = null
let mock = null
let mockOutput = ''
let appStderr = ''
let checks = 0
const layoutFailures = []
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

const mappings = {
  version: 1,
  sections: [
    {
      id: 'qa-main-section', name: 'QA headline pair',
      targets: [{ id: 'qa-target-a', template: '01_QA_A' }, { id: 'qa-target-b', template: '01_QA_B' }],
      resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
      sources: [
        { id: 'qa-source-headline', template: 'QA_HEADLINE', exitMode: 'manual-resume', durationSeconds: 6, fields: [
          { id: 'qa-field-title', param: 'Title', targetFields: { 'qa-target-a': 'TITLE_A', 'qa-target-b': 'TITLE_B' } },
          { id: 'qa-field-subtitle', param: 'Subtitle', targetFields: { 'qa-target-a': 'SUBTITLE_A', 'qa-target-b': 'SUBTITLE_B' } },
        ] },
        { id: 'qa-source-graphic', template: 'QA_GRAPHIC_ONLY', exitMode: 'manual-resume', durationSeconds: 6, fields: [] },
      ],
    },
    {
      id: 'qa-single-section', name: 'QA timed single',
      targets: [{ id: 'qa-target-single', template: '02_QA_SINGLE' }],
      resumePlayDelayMs: 100, dataPropagationDelayMs: 0,
      sources: [{ id: 'qa-source-timed', template: 'QA_TIMED', exitMode: 'template-duration', durationSeconds: 6, fields: [
        { id: 'qa-field-timed-title', param: 'Title', targetFields: { 'qa-target-single': 'TITLE' } },
      ] }],
    },
    {
      id: 'qa-nume-section', name: 'QA Nume timed',
      targets: [{ id: 'qa-target-nume', template: 'QA_NUME' }],
      resumePlayDelayMs: 0, dataPropagationDelayMs: 0,
      sources: [{ id: 'qa-source-nume', template: 'QA_NUME', exitMode: 'template-duration', durationSeconds: 6, fields: [] }],
    },
  ],
}

const retrospectiveMappings = {
  version: 1,
  sections: [{
    id: 'qa-retro-section', name: 'QA Retrospectiva pair',
    targets: [{ id: 'qa-retro-target-a', template: '03_QA_RETRO_A' }, { id: 'qa-retro-target-b', template: '03_QA_RETRO_B' }],
    resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
    sources: [{ id: 'qa-retro-source-headline', template: 'QA_HEADLINE', exitMode: 'manual-resume', durationSeconds: 6, fields: [
      { id: 'qa-retro-field-title', param: 'Title', targetFields: { 'qa-retro-target-a': 'RETRO_TITLE_A', 'qa-retro-target-b': 'RETRO_TITLE_B' } },
      { id: 'qa-retro-field-subtitle', param: 'Subtitle', targetFields: { 'qa-retro-target-a': 'RETRO_SUBTITLE_A', 'qa-retro-target-b': 'RETRO_SUBTITLE_B' } },
    ] }],
  }],
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function launchIsolated(userDataPath, receiverPort) {
  const wrapper = path.join(tempDir, 'launch.cjs')
  const compiledMain = pathToFileURL(path.join(root, 'dist-electron', 'main', 'index.js')).href
  const intercept = `
    const { app } = require('electron');
    app.setPath('userData', ${JSON.stringify(userDataPath)});
    app.on('browser-window-created', (_event, window) => { window.on('show', () => window.hide()); window.hide(); window.webContents.setBackgroundThrottling(false); });
    const http = require('node:http');
    const originalListen = http.Server.prototype.listen;
    http.Server.prototype.listen = function(...args) {
      if (args[0] === 47835) args[0] = ${receiverPort};
      return originalListen.apply(this, args);
    };
    import(${JSON.stringify(compiledMain)});
  `
  writeFileSync(wrapper, intercept, 'utf8')
  const env = { ...process.env, NODE_ENV: 'development' }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.VITE_DEV_SERVER_URL
  const app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [wrapper], cwd: root, env, timeout: 45000 })
  app.process().stderr.setEncoding('utf8')
  app.process().stderr.on('data', chunk => { appStderr += chunk })
  return app
}

async function firstPage(app) {
  const page = await app.firstWindow()
  page.setDefaultTimeout(15000)
  await page.waitForFunction(async () => (await window.lbPortalApi.getInfo()).status === 'online')
  return page
}

async function openRequestDetail(card) {
  const detail = card.locator('details.request-detail')
  await detail.waitFor()
  if (!(await detail.evaluate(element => element.open))) await detail.locator(':scope > summary').click()
  await detail.evaluate(element => element.open)
}

async function waitForExecution(page, requestId) {
  const until = Date.now() + 30000
  while (Date.now() < until) {
    const entries = await page.evaluate(() => window.lbPortalApi.getRequests())
    const entry = entries.find(item => item.body?.requestId === requestId)
    if (entry?.execution && !['queued', 'running'].includes(entry.execution.status)) return entry
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw new Error(`Execution report did not finish for ${requestId}.`)
}

async function waitForSectionState(page, sectionId, state, timeoutMs = 9000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const snapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
    if (snapshot.sections.find(section => section.sectionId === sectionId)?.state === state) return
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw new Error(`LiveBoard section ${sectionId} did not reach ${state} within ${timeoutMs} ms.`)
}

async function waitForActiveProject(page, projectId, timeoutMs = 9000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const snapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
    if (snapshot.activeProject.id === projectId) return snapshot
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw new Error(`LiveBoard snapshot did not activate project ${projectId}.`)
}

async function readCodeContrast(page, selector) {
  const colors = await page.evaluate(query => {
    const element = document.querySelector(query)
    if (!element) return null
    const style = getComputedStyle(element)
    return { background: style.backgroundColor, color: style.color }
  }, selector)
  if (!colors) return 0
  const luminance = value => {
    const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number)
    if (!channels || channels.length !== 3) return 0
    const linear = channels.map(channel => {
      const normalized = channel / 255
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const background = luminance(colors.background)
  const foreground = luminance(colors.color)
  return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
}

async function captureViewport(page, outputPath, label) {
  if (process.argv.includes('--skip-captures')) return
  const viewport = page.viewportSize()
  try {
    if (!viewport) throw new Error('Viewport is unavailable.')
    const rect = { x: 0, y: 0, width: viewport.width, height: viewport.height }
    const capture = application.evaluate(async ({ BrowserWindow }, clip) => {
      const window = BrowserWindow.getAllWindows()[0]
      const [contentWidth, contentHeight] = window.getContentSize()
      const region = { x: 0, y: 0, width: Math.min(clip.width, contentWidth), height: Math.min(clip.height, contentHeight) }
      const image = await window.webContents.capturePage(region, { stayHidden: true, stayAwake: true })
      return { png: image.toPNG().toString('base64'), contentWidth, contentHeight, region }
    }, rect)
    let timeoutId
    const result = await Promise.race([capture, new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error('Native hidden-window capture timed out after 5 seconds.')), 5000) })])
    clearTimeout(timeoutId)
    writeFileSync(outputPath, Buffer.from(result.png, 'base64'))
  } catch (error) {
    console.error(`QA screenshot failed at ${label}; viewport=${JSON.stringify(viewport)}.`)
    console.error(error instanceof Error ? error.message : String(error))
  }
}

async function captureElement(page, locator, outputPath, label) {
  if (process.argv.includes('--skip-captures')) return
  const box = await locator.evaluate(element => {
    element.scrollIntoView({ block: 'start', behavior: 'instant' })
    const rect = element.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
  })
  const viewport = page.viewportSize()
  const y = Math.max(0, box.y)
  const visibleHeight = Math.min(box.height - y, (viewport?.height ?? 0) - y)
  if (!viewport || box.width <= 0 || visibleHeight <= 0) {
    console.error(`QA screenshot failed at ${label}; viewport=${JSON.stringify(viewport)} bounds=${JSON.stringify(box)}.`)
    return
  }
  await captureViewport(page, outputPath, label)
}

async function postPlay(page, receiverPort, key, template, params, fixedRequestId) {
  const requestId = fixedRequestId ?? randomUUID()
  const body = { requestId, source: 'plasma.test', type: 'mos-play', template, ...(params === undefined ? {} : { params }) }
  const result = await new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: receiverPort, path: '/v1/requests', method: 'POST',
      headers: { Host: '127.0.0.1:47835', Origin: 'http://plasma.test', Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    }, response => {
      let data = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { data += chunk })
      response.on('end', () => resolve({ status: response.statusCode, json: JSON.parse(data) }))
    })
    request.once('error', reject)
    request.end(JSON.stringify(body))
  })
  assert.equal(result.status, 200)
  assert.equal(result.json.requestId, requestId)
  // Inspect the receiver's immediate receipt before the controller's async work completes.
  const receipt = await page.evaluate(async id => (await window.lbPortalApi.getRequests()).find(item => item.body?.requestId === id), requestId)
  const entry = await waitForExecution(page, requestId)
  return { body, response: result, receipt, entry }
}

async function waitForRendererStatus(page, requestId, status, timeoutMs = 5000) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    const updates = await page.evaluate(id => window.__qaExecutionUpdates.filter(item => item.requestId === id), requestId)
    if (updates.some(item => item.status === status)) return updates
    await new Promise(resolve => setTimeout(resolve, 30))
  }
  throw new Error(`Renderer did not observe ${status} progress for ${requestId}.`)
}

async function measureHorizontalScroll(page) {
  return page.evaluate(() => {
    const left = window.scrollX
    const top = window.scrollY
    window.scrollTo(1000000, top)
    const maxScrollX = window.scrollX
    window.scrollTo(left, top)
    return { maxScrollX, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, innerWidth: window.innerWidth }
  })
}

async function settings(page, connection, config = mappings) {
  await page.evaluate(async ({ connection, config }) => {
    await window.settingsApi.setMosMappings(config)
    await window.settingsApi.setLiveBoardConnection(connection)
  }, { connection, config })
}

async function run() {
  const userData = path.join(tempDir, 'disposable-user-data')
  const initialConnection = { mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 }
  mkdirSync(userData, { recursive: true })
  writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({ mosMappings: mappings, liveBoardConnection: initialConnection }, null, 2), 'utf8')
  let receiverPort = await freePort()
  let key
  let customProjectId

  application = await launchIsolated(userData, receiverPort)
  let page = await firstPage(application)
  const initialWindowState = await application.evaluate(async ({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0]
    let devToolsOpenedEvent = false
    const onDevToolsOpened = () => {
      devToolsOpenedEvent = true
      window.webContents.closeDevTools()
    }
    window.webContents.once('devtools-opened', onDevToolsOpened)
    window.webContents.openDevTools({ mode: 'detach', activate: false })
    await new Promise(resolve => setTimeout(resolve, 200))
    const devToolsIsOpen = window.webContents.isDevToolsOpened()
    if (devToolsIsOpen) window.webContents.closeDevTools()
    window.webContents.removeListener('devtools-opened', onDevToolsOpened)
    return { maximized: window.isMaximized(), fullScreen: window.isFullScreen(), kiosk: window.isKiosk(), devToolsEnabled: window.webContents.getLastWebPreferences().devTools, devToolsOpened: devToolsIsOpen, devToolsOpenedEvent }
  })
  check(initialWindowState.maximized, 'main Electron window should start maximized while remaining a regular OS window')
  check(!initialWindowState.fullScreen && !initialWindowState.kiosk, 'main Electron window should retain normal windowed OS controls instead of kiosk or fullscreen mode')
  // Electron 33 omits the false devTools preference from getLastWebPreferences().
  // A true value is the only enabled result; also verify the window never opened it.
  check(initialWindowState.devToolsEnabled !== true && initialWindowState.devToolsOpened === false && !initialWindowState.devToolsOpenedEvent, `main Electron window must disable and never open DevTools: ${JSON.stringify(initialWindowState)}`)
  await page.evaluate(() => {
    window.__qaExecutionUpdates = []
    window.lbPortalApi.onRequestUpdated(entry => {
      if (entry.body?.requestId && entry.execution) window.__qaExecutionUpdates.push({ requestId: entry.body.requestId, status: entry.execution.status })
    })
  })
  const info = await page.evaluate(() => window.lbPortalApi.getInfo())
  key = info.accessKey
  check(info.status === 'online' && info.port === 47835 && !!key, 'isolated receiver must start with valid info')

  const migratedProjects = await page.evaluate(() => window.settingsApi.getMosProjects())
  const migratedTelejurnal = migratedProjects.projects.find(project => project.id === 'builtin-telejurnal')
  const migratedRetrospectiva = migratedProjects.projects.find(project => project.id === 'builtin-retrospectiva')
  check(migratedProjects.version === 2 && migratedProjects.activeProjectId === 'builtin-telejurnal', 'legacy flat mappings should migrate to canonical projects with Telejurnal active')
  check(JSON.stringify(migratedTelejurnal?.mappings) === JSON.stringify(mappings), 'legacy migration should preserve Telejurnal section/source/field IDs and mapping values exactly')
  check(migratedRetrospectiva?.name === 'Retrospectiva săptămânii' && migratedRetrospectiva.mappings.sections.length === 0, 'built-in Retrospectiva should start empty')

  await settings(page, initialConnection)
  const initialSnapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(initialSnapshot.connection.mode === 'simulation' && initialSnapshot.connection.status === 'simulation', 'simulation must be the ready default')
  check(initialSnapshot.activeProject.id === 'builtin-telejurnal' && initialSnapshot.sections.some(section => section.sectionId === 'qa-main-section'), 'runtime should start on the migrated Telejurnal project')
  const configuredProjects = await page.evaluate(() => window.settingsApi.getMosProjects())
  configuredProjects.projects.find(project => project.id === 'builtin-retrospectiva').mappings = retrospectiveMappings
  const retrospectiveSave = await page.evaluate(value => window.settingsApi.trySaveMosProjects(value), configuredProjects)
  check(retrospectiveSave.ok === true, 'inactive built-in project mappings should save independently')

  const crossProjectRequestId = 'qa-cross-project-request-id'
  const a = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'A main', Subtitle: 'A sub' }, crossProjectRequestId)
  check(a.receipt?.accepted === true && a.receipt.body?.requestId === a.body.requestId, 'HTTP 200 must immediately record an accepted receipt with the same request ID')
  const aProgress = await waitForRendererStatus(page, a.body.requestId, 'completed')
  check(aProgress.some(item => item.status === 'running') && aProgress.some(item => item.status === 'completed'), 'renderer should observe running and completed execution progress')
  check(a.entry.execution.status === 'completed' && a.entry.execution.selectedBuffer === 'A', `first PLAY should complete on A: ${JSON.stringify(a.entry.execution)}`)
  check(a.entry.execution.confirmation === 'simulated', 'simulation report must be explicit')
  check(a.entry.execution.steps.map(step => step.kind).join(',') === 'set-field,set-field,wait-data,play', 'A report must preserve field/write/wait/play order')
  check(a.entry.execution.steps[2].ms === 250, 'A report must show 250 ms data propagation delay')

  const b = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'B main', Subtitle: 'B sub' })
  check(b.entry.execution.selectedBuffer === 'B', 'second PLAY should select B')
  check(b.entry.execution.steps.map(step => step.kind).join(',') === 'set-field,set-field,wait-data,resume,wait-transition,play', 'B report must show resume, 100 ms wait, then play')
  check(b.entry.execution.steps.find(step => step.kind === 'wait-transition').ms === 100, 'A/B transition delay should be 100 ms')

  const aAgain = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'A updated', Subtitle: 'A updated sub' })
  check(aAgain.entry.execution.selectedBuffer === 'A', 'third PLAY should return to A')
  const runtimeAfterTriple = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  const mainRuntime = runtimeAfterTriple.sections.find(section => section.sectionId === 'qa-main-section')
  check(mainRuntime.buffers[0].fields.TITLE_A === 'A updated' && mainRuntime.buffers[0].fields.SUBTITLE_A === 'A updated sub', 'A field values should be retained')
  check(mainRuntime.buffers[1].fields.TITLE_B === 'B main' && mainRuntime.buffers[1].fields.SUBTITLE_B === 'B sub', 'B field values should be retained')

  const noop = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'A updated', Subtitle: 'A updated sub' })
  check(noop.entry.execution.status === 'noop' && noop.entry.execution.steps.length === 0, 'identical active content should be a no-op')
  const missing = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'missing subtitle' })
  check(missing.entry.execution.status === 'blocked' && /Subtitle/.test(missing.entry.execution.error), 'missing fields must block execution')

  const blockedProjectSwitch = await page.evaluate(() => window.liveBoardApi.setActiveProject('builtin-retrospectiva'))
  check(blockedProjectSwitch.ok === false && blockedProjectSwitch.error.code === 'LIVEBOARD_PROJECT_SWITCH_ACTIVE' && blockedProjectSwitch.error.sectionNames.includes('QA headline pair'), 'typed project activation should be blocked while the current section is active')
  await page.evaluate(() => window.liveBoardApi.stopSection('qa-main-section'))
  const activatedRetrospectiva = await page.evaluate(() => window.liveBoardApi.setActiveProject('builtin-retrospectiva'))
  check(activatedRetrospectiva.ok === true && activatedRetrospectiva.value.activeProject.id === 'builtin-retrospectiva', 'built-in Retrospectiva should activate after the Telejurnal section is stopped')
  const retroPlay = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Retro title', Subtitle: 'Retro sub' }, crossProjectRequestId)
  check(retroPlay.entry.execution.projectId === 'builtin-retrospectiva' && retroPlay.entry.execution.projectName === 'Retrospectiva săptămânii', 'same MOS source should resolve under the active Retrospectiva project')
  check(retroPlay.entry.mapping.project?.id === 'builtin-retrospectiva' && retroPlay.entry.execution.steps.some(step => step.template === '03_QA_RETRO_A' && step.field === 'RETRO_TITLE_A'), 'Retrospectiva should use its own LiveBoard targets and fields')
  check(retroPlay.entry.execution.selectedBuffer === 'A' && retroPlay.entry.execution.status === 'completed', 'same request ID in a different project should execute as a fresh project-scoped request')
  const retroUnknown = await postPlay(page, receiverPort, key, 'QA_TEMPLATE_ONLY_IN_TELEJURNAL', { Title: 'must not fall back' })
  check(retroUnknown.entry.mapping.status === 'unmapped' && retroUnknown.entry.mapping.project?.id === 'builtin-retrospectiva', 'unmapped diagnostics should remain scoped to the active Retrospectiva project')
  check(retroUnknown.entry.execution.status === 'blocked' && retroUnknown.entry.execution.steps.length === 0, 'an unmapped Retrospectiva request must not fall back to Telejurnal mappings')
  const retroUnknownCard = page.locator('article.entry').filter({ hasText: 'QA_TEMPLATE_ONLY_IN_TELEJURNAL' }).first()
  await openRequestDetail(retroUnknownCard)
  const retroUnknownText = await retroUnknownCard.innerText()
  check(/Blocat|Blocked/.test(retroUnknownText) && /Retrospectiva/.test(retroUnknownText), 'unmapped report should visibly identify its captured project and blocked status')
  await page.evaluate(() => window.liveBoardApi.stopSection('qa-retro-section'))
  const restoredTelejurnal = await page.evaluate(() => window.liveBoardApi.setActiveProject('builtin-telejurnal'))
  check(restoredTelejurnal.ok === true && restoredTelejurnal.value.sections.find(section => section.sectionId === 'qa-main-section')?.state === 'OFF', 'switching back should restore Telejurnal with a fresh OFF runtime')
  const projectHistory = await page.evaluate(() => window.lbPortalApi.getRequests())
  const teleHistory = projectHistory.find(entry => entry.body?.requestId === 'qa-cross-project-request-id' && entry.mapping?.project?.id === 'builtin-telejurnal')
  const retroHistory = projectHistory.find(entry => entry.body?.requestId === 'qa-cross-project-request-id' && entry.mapping?.project?.id === 'builtin-retrospectiva')
  check(teleHistory?.mapping?.project?.name === 'Telejurnal' && retroHistory?.mapping?.project?.name === 'Retrospectiva săptămânii', 'request history should preserve each project name across a switch')

  const reportCard = page.locator('article.entry').filter({ hasText: 'A updated', has: page.locator('.lb-step-list li').nth(3) }).first()
  await reportCard.waitFor()
  await openRequestDetail(reportCard)
  const reportText = await reportCard.innerText()
  check(/Buffer selectat|Selected target buffer/.test(reportText), 'localized execution report should show the selected buffer')
  check(await reportCard.locator('.lb-step-list li').count() >= 4, 'completed A-again report should visibly contain ordered execution steps')
  check(!/liveBoard\.(chosenBuffer|executionStatus|step\.)/.test(reportText), 'execution report should not show untranslated keys')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await captureElement(page, reportCard, path.join(os.tmpdir(), 'lbportal-liveboard-report-desktop.png'), 'execution report desktop')
  const desktopOverflow = await measureHorizontalScroll(page)
  if (desktopOverflow.maxScrollX <= 1) checks += 1
  else {
    layoutFailures.push(`console desktop viewport horizontal overflow ${JSON.stringify(desktopOverflow)}`)
    console.error(`QA layout assertion failed: ${layoutFailures.at(-1)}`)
  }
  await page.setViewportSize({ width: 640, height: 900 })
  await captureElement(page, reportCard, path.join(os.tmpdir(), 'lbportal-liveboard-report-narrow.png'), 'execution report narrow')
  const narrowConsoleOverflow = await measureHorizontalScroll(page)
  if (narrowConsoleOverflow.maxScrollX <= 1) checks += 1
  else { layoutFailures.push(`console narrow viewport horizontal overflow ${JSON.stringify(narrowConsoleOverflow)}`); console.error(`QA layout assertion failed: ${layoutFailures.at(-1)}`) }

  const graphic = await postPlay(page, receiverPort, key, 'QA_GRAPHIC_ONLY')
  check(graphic.entry.execution.status === 'completed' && graphic.entry.execution.steps.every(step => step.kind !== 'set-field'), 'graphic-only source must play without field writes')
  check(graphic.entry.mapping.targets.every(target => target.fields.length === 0), 'graphic-only source must retain empty mapping rows')
  const beforeInvalidGraphic = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  const invalidGraphic = await postPlay(page, receiverPort, key, 'QA_GRAPHIC_ONLY', { Unexpected: 42 })
  const afterInvalidGraphic = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(invalidGraphic.entry.mapping.status === 'invalid-request' && invalidGraphic.entry.execution.status === 'blocked' && invalidGraphic.entry.execution.steps.length === 0, 'invalid graphic-only params must be received but blocked before execution')
  check(JSON.stringify(afterInvalidGraphic.sections) === JSON.stringify(beforeInvalidGraphic.sections), 'invalid graphic-only params must not alter the runtime snapshot')
  const invalidGraphicCard = page.locator('article.entry').filter({ hasText: 'QA_GRAPHIC_ONLY' }).first()
  await openRequestDetail(invalidGraphicCard)
  const invalidGraphicText = await invalidGraphicCard.innerText()
  check(/Blocat|Blocked/.test(invalidGraphicText) && /Receipt mapping is invalid-request/.test(invalidGraphicText), 'invalid graphic-only report should visibly show blocked status and execution error')

  const unknownTemplate = await postPlay(page, receiverPort, key, 'QA_UNKNOWN_TEMPLATE', { Title: 'must not play' })
  check(unknownTemplate.entry.mapping.status === 'unmapped' && unknownTemplate.entry.execution.status === 'blocked', 'unknown templates should be recorded but blocked')
  const unknownCard = page.locator('article.entry').filter({ hasText: 'QA_UNKNOWN_TEMPLATE' }).first()
  await openRequestDetail(unknownCard)
  const unknownText = await unknownCard.innerText()
  check(/Blocat|Blocked/.test(unknownText) && /Receipt mapping is unmapped/.test(unknownText) && /Nicio mapare salvată|No saved mapping/.test(unknownText), `unknown template report should visibly explain the blocked execution: ${unknownText}`)
  check(await unknownCard.locator('.mos-report-target').count() === 0, 'unknown template report must not invent a LiveBoard destination')

  const timed = await postPlay(page, receiverPort, key, 'QA_TIMED', { Title: 'six seconds' })
  check(timed.entry.execution.status === 'completed' && !timed.entry.execution.steps.some(step => step.kind === 'resume'), 'timed source must not send automatic RESUME')
  await waitForSectionState(page, 'qa-single-section', 'OFF')
  checks += 1

  const beforeClear = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  await page.evaluate(() => window.lbPortalApi.clearRequests())
  const afterClear = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check((await page.evaluate(() => window.lbPortalApi.getRequests())).length === 0, 'clear should empty volatile request history')
  check(afterClear.sections.find(section => section.sectionId === 'qa-main-section').state === beforeClear.sections.find(section => section.sectionId === 'qa-main-section').state, 'clear history must retain LiveBoard runtime')

  const attemptedConnection = { mode: 'tcp', host: '127.0.0.1', port: 9010, timeoutMs: 1000 }
  const guard = await page.evaluate(value => window.settingsApi.trySaveLiveBoardConnection(value), attemptedConnection)
  check(guard.ok === false && guard.error.code === 'LIVEBOARD_CONNECTION_ACTIVE' && guard.error.sectionNames.includes('QA headline pair'), 'typed connection save should identify the active section without throwing')
  check((await page.evaluate(() => window.settingsApi.getLiveBoardConnection())).mode === 'simulation', 'blocked connection edit must not persist')

  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  const editorProjectSelect = page.locator('.mos-project-selector select')
  const telejurnalRuntimeBeforeInactiveEdit = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  await editorProjectSelect.selectOption('builtin-retrospectiva')
  const runtimeAfterEditorSelection = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(runtimeAfterEditorSelection.activeProject.id === 'builtin-telejurnal' && runtimeAfterEditorSelection.sections[0].state === telejurnalRuntimeBeforeInactiveEdit.sections[0].state, 'choosing another project in Settings should not activate it or reset the live runtime')
  const retroDelaySelect = page.getByLabel(/Pauză propagare date|Data propagation delay/)
  await retroDelaySelect.selectOption('500')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  const telejurnalRuntimeAfterInactiveEdit = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  const retroPersisted = await page.evaluate(() => window.settingsApi.getMosProjects().then(config => config.projects.find(project => project.id === 'builtin-retrospectiva')))
  check(JSON.stringify(telejurnalRuntimeAfterInactiveEdit.sections) === JSON.stringify(telejurnalRuntimeBeforeInactiveEdit.sections), 'saving inactive project edits must not reset the active Telejurnal graph')
  check(retroPersisted.mappings.sections[0].dataPropagationDelayMs === 500, 'inactive Retrospectiva edits should persist while Telejurnal is active')
  await editorProjectSelect.selectOption('builtin-telejurnal')
  const activeDelaySelect = page.getByLabel(/Pauză propagare date|Data propagation delay/)
  await activeDelaySelect.selectOption('500')
  const activeMappingAttempt = await page.evaluate(async () => {
    const value = await window.settingsApi.getMosProjects()
    value.projects.find(project => project.id === 'builtin-telejurnal').mappings.sections[0].dataPropagationDelayMs = 500
    return window.settingsApi.trySaveMosProjects(value)
  })
  check(activeMappingAttempt.ok === false && activeMappingAttempt.error.code === 'MOS_MAPPINGS_ACTIVE' && activeMappingAttempt.error.sectionNames.includes('QA headline pair'), 'typed mapping save should identify the active section without throwing')
  check((await page.evaluate(() => window.settingsApi.getMosMappings())).sections[0].dataPropagationDelayMs === 250, 'typed active mapping guard must leave persisted settings unchanged')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  const telejurnalRuntimeAfterActiveSave = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(telejurnalRuntimeAfterActiveSave.sections.find(section => section.sectionId === 'qa-main-section')?.state === 'OFF', 'saving active mappings through the editor should STOP the affected section before retrying')
  check(await activeDelaySelect.inputValue() === '500', 'successful auto-stop save should retain the saved draft value')
  check(!(await page.getByRole('button', { name: /Salvează setările|Save settings/ }).isEnabled()), 'successful auto-stop save should clear the settings draft')
  check((await page.evaluate(() => window.settingsApi.getMosMappings())).sections[0].dataPropagationDelayMs === 500, 'active mapping save should persist after the section is stopped')
  await activeDelaySelect.selectOption('250')
  check(await page.getByRole('button', { name: /Salvează setările|Save settings/ }).isEnabled(), 'a subsequent unsaved mapping edit should remain saveable')
  check(!/Error occurred in handler for ['"]?settings:set/i.test(appStderr), 'active guard must not log an Electron settings:set handler exception')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await captureElement(page, page.locator('.mos-footer'), path.join(os.tmpdir(), 'lbportal-settings-save-auto-stop.png'), 'settings save auto-stop')

  await page.locator('.portal-nav').getByRole('button', { name: /Consolă|Console/ }).click()
  await page.getByRole('alertdialog').waitFor()
  await page.getByRole('button', { name: /Renunță la modificări|Discard changes/ }).click()
  await page.locator('.lb-runtime').waitFor()
  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Project switch guard', Subtitle: 'QA active section' })
  await page.locator('.lb-project-switch select').selectOption('builtin-retrospectiva')
  await page.getByRole('button', { name: /Activează proiectul|Activate project/ }).click()
  const projectSwitchNotice = page.locator('.lb-project-notice')
  await projectSwitchNotice.waitFor()
  check(/Oprește|Stop/.test(await projectSwitchNotice.innerText()) && /QA headline pair/.test(await projectSwitchNotice.innerText()), 'runtime project switch should show a localized active-section warning')
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).activeProject.id === 'builtin-telejurnal', 'failed UI project switch must leave the active project unchanged')
  const pendingProjectLabels = await page.locator('.lb-project-switch').evaluate(element => ({
    selected: element.querySelector('select option:checked')?.textContent?.trim(),
    selectedProject: element.querySelector('.lb-selected-project strong')?.textContent?.trim(),
    activeProject: element.querySelector('.lb-active-project strong')?.textContent?.trim(),
  }))
  check(pendingProjectLabels.selected === 'Retrospectiva săptămânii' && pendingProjectLabels.selectedProject === pendingProjectLabels.selected && pendingProjectLabels.activeProject === 'Telejurnal', 'pending project selection should distinguish the selected project from the still active runtime project')

  for (const sectionId of ['qa-main-section', 'qa-single-section']) await page.evaluate(id => window.liveBoardApi.stopSection(id), sectionId)
  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  const inactiveDelaySelect = page.getByLabel(/Pauză propagare date|Data propagation delay/)
  await inactiveDelaySelect.selectOption('1000')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => document.querySelector('.mos-footer p[role="status"]')?.textContent?.includes('Setările au fost salvate') || document.querySelector('.mos-footer p[role="status"]')?.textContent?.includes('Settings saved'))
  check((await page.evaluate(() => window.settingsApi.getMosMappings())).sections[0].dataPropagationDelayMs === 1000, 'mapping save should succeed after all sections are STOPped')
  await page.getByRole('button', { name: /Adaugă proiect independent|Add standalone project/ }).click()
  await page.getByLabel(/Numele proiectului|Project name/).fill('QA standalone')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  const customProject = await page.evaluate(async () => (await window.settingsApi.getMosProjects()).projects.find(project => project.name === 'QA standalone'))
  check(customProject?.kind === 'standalone', 'UI should create and persist a named standalone project')
  customProjectId = customProject.id
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).activeProject.id === 'builtin-telejurnal', 'creating a standalone project in Settings should leave the active Telejurnal project unchanged')
  await page.setViewportSize({ width: 640, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-project-settings-narrow.png'), 'project settings narrow')
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'project settings narrow viewport should not overflow horizontally')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.locator('.portal-nav').getByRole('button', { name: /Consolă|Console/ }).click()

  let mosGuard
  const alteredMappings = structuredClone(mappings)
  alteredMappings.sections[0].sources[0].fields[0].targetFields['qa-target-a'] = 'TITLE_CHANGED'
  try { await page.evaluate(value => window.settingsApi.setMosMappings(value), alteredMappings) } catch (error) { mosGuard = error }
  check(!mosGuard, 'functional mapping change should be accepted when all sections are OFF')

  let tcpPort = await freePort()
  mock = spawn(process.execPath, [path.join(root, 'scripts', 'mock-liveboard.mjs'), '--port', String(tcpPort), '--fail-match', 'LBC_RESUMECONTENT', '--fail-after', '2'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  mock.stdout.setEncoding('utf8'); mock.stderr.setEncoding('utf8')
  mock.stdout.on('data', data => { mockOutput += data })
  mock.stderr.on('data', data => { mockOutput += data })
  await waitForText(() => mockOutput, /mock listening on/)

  const tcpConnection = { mode: 'tcp', host: '127.0.0.1', port: tcpPort, timeoutMs: 1200 }
  await page.evaluate(value => window.settingsApi.setLiveBoardConnection(value), tcpConnection)
  let tcpSnapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(tcpSnapshot.connection.status === 'disconnected', 'saving TCP configuration must not auto-connect')
  tcpSnapshot = await page.evaluate(() => window.liveBoardApi.connect())
  check(tcpSnapshot.connection.status === 'connected', 'manual TCP connect should receive the mock welcome')

  const tcpA = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'TCP A', Subtitle: 'TCP A sub' })
  check(tcpA.entry.execution.status === 'completed' && tcpA.entry.execution.confirmation === 'protocol-acknowledged', 'TCP PLAY should complete only after protocol acknowledgements')
  check(tcpA.entry.execution.steps.some(step => step.command?.startsWith('LBC_PLAYCONTENT') && step.response === 'OK'), 'execution report should include the acknowledged LBC PLAY command')

  const tcpB = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'TCP B', Subtitle: 'TCP B sub' })
  check(tcpB.entry.execution.status === 'completed' && tcpB.entry.execution.selectedBuffer === 'B', 'TCP A-to-B transition should complete')
  check(tcpB.entry.execution.steps.map(step => step.kind).join(',') === 'set-field,set-field,wait-data,resume,wait-transition,play', 'TCP B transition should acknowledge RESUME, delay, and PLAY in order')
  const tcpAAgain = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'TCP A again', Subtitle: 'TCP A again sub' })
  check(tcpAAgain.entry.execution.status === 'completed' && tcpAAgain.entry.execution.selectedBuffer === 'A', 'TCP B-to-A transition should complete before error injection')
  const tcpError = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'TCP B error', Subtitle: 'TCP B error sub' })
  check(tcpError.entry.execution.status === 'failed' && tcpError.entry.execution.afterState === 'NEEDS_RESYNC', 'sent RESUME error should require resync')
  const blocked = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'later', Subtitle: 'blocked' })
  check(blocked.entry.execution.status === 'blocked' && /resync/i.test(blocked.entry.execution.error), 'NEEDS_RESYNC must block further PLAY requests')
  check(/LBC_SETTEMPLATEOBJECTVALUE/.test(mockOutput) && /LBC_PLAYCONTENT/.test(mockOutput) && /LBC_RESUMECONTENT/.test(mockOutput), 'mock log should show the four-command LBC execution path')

  await page.getByRole('button', { name: /Consolă|Console/ }).click()
  await page.locator('.lb-runtime').waitFor()
  const runtimeCard = page.locator('.lb-runtime')
  await captureElement(page, runtimeCard, path.join(os.tmpdir(), 'lbportal-liveboard-runtime.png'), 'LiveBoard runtime')
  check(await readCodeContrast(page, '.lb-runtime code') >= 4.5, 'runtime source code should have readable computed foreground/background contrast')
  const runtimeText = await runtimeCard.innerText()
  check(await runtimeCard.locator('.state-needs_resync').count() > 0, 'runtime panel should visibly show NEEDS RESYNC after the failed RESUME')

  for (const sectionId of ['qa-main-section', 'qa-single-section']) await page.evaluate(id => window.liveBoardApi.stopSection(id), sectionId)
  const stopped = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(stopped.sections.every(section => section.state === 'OFF'), 'STOP all should return every section to OFF')
  const journal = page.locator('details.lb-manual-journal')
  if (!(await journal.evaluate(element => element.open))) await journal.locator(':scope > summary').click()
  await page.waitForFunction(() => document.querySelector('details.lb-manual-journal')?.open === true)
  await captureElement(page, journal, path.join(os.tmpdir(), 'lbportal-liveboard-manualjournal.png'), 'manual journal')
  check(await readCodeContrast(page, '.lb-manual-journal code') >= 4.5, 'manual journal commands should have readable computed foreground/background contrast')
  check(/STOP/.test(await journal.innerText()), 'expanded manual journal should show STOP attempts')
  tcpSnapshot = await page.evaluate(() => window.liveBoardApi.disconnect())
  check(tcpSnapshot.connection.mode === 'tcp' && tcpSnapshot.connection.status === 'disconnected', 'manual disconnect should retain TCP mode')
  const mockBeforeOfflineResync = mockOutput
  await page.evaluate(() => window.liveBoardApi.resyncSection('qa-main-section', 'A'))
  await waitForSectionState(page, 'qa-main-section', 'ON_A')
  const mainSectionCard = page.locator('.lb-section').filter({ hasText: 'QA headline pair' })
  const mainSectionDetails = mainSectionCard.locator('details.lb-section-details')
  if (!(await mainSectionDetails.evaluate(element => element.open))) await mainSectionDetails.locator(':scope > summary').click()
  const localResyncSelect = mainSectionCard.locator('.lb-resync select')
  await localResyncSelect.selectOption('OFF')
  const localResyncButton = mainSectionCard.locator('.lb-resync button')
  check(await localResyncButton.isEnabled(), 'local resync control should remain enabled while TCP is disconnected')
  await localResyncButton.click()
  await waitForSectionState(page, 'qa-main-section', 'OFF')
  check(mockOutput === mockBeforeOfflineResync, 'offline local resync must not send TCP commands')

  const failedMock = mock
  if (failedMock && failedMock.exitCode === null) {
    const failedMockExited = new Promise(resolve => failedMock.once('exit', resolve))
    failedMock.kill('SIGTERM')
    await failedMockExited
  }
  mock = null
  mockOutput = ''

  const projectsBeforeStandalone = await page.evaluate(() => window.settingsApi.getMosProjects())
  const standaloneProject = projectsBeforeStandalone.projects.find(project => project.id === customProjectId)
  standaloneProject.mappings = projectsBeforeStandalone.projects.find(project => project.id === 'builtin-telejurnal').mappings
  const standaloneConfigSave = await page.evaluate(value => window.settingsApi.trySaveMosProjects(value), projectsBeforeStandalone)
  check(standaloneConfigSave.ok === true, 'standalone project should be allowed to retain a same-template mapping for disabled-ingress verification')
  const standaloneActivation = await page.evaluate(id => window.liveBoardApi.setActiveProject(id), customProjectId)
  check(standaloneActivation.ok === true && standaloneActivation.value.activeProject.kind === 'standalone', 'custom standalone project should activate while all sections are OFF')
  check(await page.locator('.lb-project-warning').isVisible(), 'active standalone project should visibly explain Plasma is disabled')
  const mockBeforeStandaloneRequest = mockOutput
  const standaloneRequest = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'must be blocked', Subtitle: 'standalone' }, 'qa-standalone-disabled-request')
  check(standaloneRequest.response.status === 200 && standaloneRequest.receipt.accepted === true, 'standalone Plasma request should still receive an HTTP receipt')
  check(standaloneRequest.entry.mapping.status === 'project-disabled' && standaloneRequest.entry.mapping.project.id === customProjectId, 'standalone source should be explicitly project-disabled instead of falling back to Telejurnal')
  check(standaloneRequest.entry.execution.status === 'blocked' && standaloneRequest.entry.execution.steps.length === 0, 'standalone Plasma request should be blocked before any LiveBoard steps')
  check(mockOutput === mockBeforeStandaloneRequest, 'standalone Plasma request should send no TCP commands')
  await captureElement(page, page.locator('.lb-runtime'), path.join(os.tmpdir(), 'lbportal-project-standalone-runtime.png'), 'standalone project runtime')
  const standaloneReportCard = page.locator('article.entry').filter({ hasText: 'qa-standalone-disabled-request' }).first()
  await standaloneReportCard.waitFor()
  await openRequestDetail(standaloneReportCard)
  await captureElement(page, standaloneReportCard, path.join(os.tmpdir(), 'lbportal-project-standalone-report.png'), 'standalone execution report')

  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  await page.getByLabel(/Numele proiectului|Project name/).fill('QA standalone renamed')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  const standaloneAfterRename = await page.evaluate(async () => ({
    project: (await window.settingsApi.getMosProjects()).projects.find(project => project.kind === 'standalone'),
    entry: (await window.lbPortalApi.getRequests()).find(item => item.body?.requestId === 'qa-standalone-disabled-request'),
  }))
  check(standaloneAfterRename.project.name === 'QA standalone renamed', 'standalone rename should persist through the settings UI')
  check(standaloneAfterRename.entry.mapping.project.name === 'QA standalone' && standaloneAfterRename.entry.execution.projectName === 'QA standalone', 'captured request history should retain the standalone project name from receipt')
  await page.locator('.portal-nav').getByRole('button', { name: /Consolă|Console/ }).click()
  await page.locator('.lb-project-switch select').selectOption('builtin-telejurnal')
  await page.getByRole('button', { name: /Activează proiectul|Activate project/ }).click()
  await waitForActiveProject(page, 'builtin-telejurnal')

  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  await page.locator('.mos-project-selector select').selectOption(customProjectId)
  await page.getByRole('button', { name: /Șterge proiectul|Delete project/ }).click()
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  check(!(await page.evaluate(() => window.settingsApi.getMosProjects())).projects.some(project => project.id === customProjectId), 'inactive standalone project should be deletable through the settings UI')
  const historyAfterDelete = await page.evaluate(() => window.lbPortalApi.getRequests())
  check(historyAfterDelete.find(item => item.body?.requestId === 'qa-standalone-disabled-request')?.mapping?.project?.name === 'QA standalone', 'request history should retain project identity after project deletion')
  await page.locator('.portal-nav').getByRole('button', { name: /Consolă|Console/ }).click()

  // Configure interaction rules through the real editor, then verify its draft validation and responsive layout.
  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  await page.locator('.mos-editor-tabs').getByRole('button', { name: /Interacțiuni|Interactions/ }).click()
  const interactionEditor = page.locator('.mos-interactions')
  const addRuleButton = interactionEditor.getByRole('button', { name: /Adaugă regulă|Add rule/ })
  await addRuleButton.click()
  let interactionRule = interactionEditor.locator('.mos-interaction-rule').first()
  await interactionRule.getByLabel(/Numele regulii|Rule name/).fill('QA restore title')
  await interactionRule.getByLabel(/Secțiunea declanșatoare|Trigger section/).selectOption('qa-nume-section')
  await interactionRule.getByLabel(/Când|When/).selectOption('before-play')
  const addActionButton = interactionRule.getByRole('button', { name: /Adaugă acțiune|Add action/ })
  await addActionButton.click()
  let actionRows = interactionRule.locator('.mos-action-row')
  await actionRows.nth(0).locator('select').nth(0).selectOption('suspend')
  await actionRows.nth(0).locator('select').nth(1).selectOption('qa-main-section')
  await actionRows.nth(0).getByLabel(/Restaurează secțiunea suspendată la|Restore suspended section on/).selectOption('auto-exit')
  await addActionButton.click()
  actionRows = interactionRule.locator('.mos-action-row')
  await actionRows.nth(1).locator('select').nth(0).selectOption('resume')
  await actionRows.nth(1).locator('select').nth(1).selectOption('qa-single-section')
  await actionRows.nth(1).getByRole('button', { name: /Mută acțiunea în sus|Move action up/ }).click()
  check(await interactionRule.locator('.mos-action-order').allTextContents().then(values => values.join(',')) === '1,2', 'interaction editor should keep ordered action positions after move')
  await interactionRule.locator('.mos-action-row').nth(0).getByRole('button', { name: /Mută acțiunea în jos|Move action down/ }).click()
  await interactionRule.locator('.mos-action-row').nth(1).getByRole('button', { name: /Șterge acțiunea|Delete action/ }).click()
  const enabled = interactionRule.getByLabel(/Activată|Enabled/)
  check(await enabled.isChecked(), 'new interaction rules should start enabled')
  await enabled.uncheck()
  check(!(await enabled.isChecked()), 'interaction rule toggle should disable a rule in the draft')
  await enabled.check()
  await interactionRule.locator('.mos-action-row').first().locator('input[type="number"]').fill('60001')
  check(await page.locator('.mos-validation').count() > 0, 'invalid interaction delays should appear in local settings validation')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  check(/Corectează erorile|Fix the validation/.test(await page.locator('.mos-footer p[role="status"]').innerText()), 'invalid interaction draft should stay in the editor with a localized correction notice')
  check((await page.evaluate(() => window.settingsApi.getMosProjects())).projects.find(project => project.id === 'builtin-telejurnal')?.interactions?.length !== 1, 'invalid interaction draft must not be persisted')
  await interactionRule.locator('.mos-action-row').first().locator('input[type="number"]').fill('0')
  await interactionEditor.getByRole('button', { name: /Adaugă regulă|Add rule/ }).click()
  check(await interactionEditor.locator('.mos-interaction-rule').count() === 2, 'interaction editor should create multiple rules')
  const disposableRule = interactionEditor.locator('.mos-interaction-rule').nth(1)
  await disposableRule.getByRole('button', { name: /Mută regula în sus|Move rule up/ }).click()
  check(await interactionEditor.locator('.mos-interaction-rule').first().getByLabel(/Numele regulii|Rule name/).inputValue() === '', 'interaction editor should move rules in the requested order')
  await interactionEditor.locator('.mos-interaction-rule').first().getByRole('button', { name: /Mută regula în jos|Move rule down/ }).click()
  check(await interactionEditor.locator('.mos-interaction-rule').first().getByLabel(/Numele regulii|Rule name/).inputValue() === 'QA restore title', 'moving the second rule down should restore the original rule order')
  await interactionEditor.locator('.mos-interaction-rule').nth(1).getByRole('button', { name: /Șterge regula|Delete rule/ }).click()
  check(await interactionEditor.locator('.mos-interaction-rule').count() === 1, 'interaction editor should delete a rule')
  await page.setViewportSize({ width: 640, height: 900 })
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'interaction settings should not overflow at 640 pixels')
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-interactions-narrow.png'), 'interactions editor narrow')
  await page.setViewportSize({ width: 1280, height: 1000 })
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'interaction settings should not overflow at 1280 pixels')
  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.locator('.mos-editor-tabs').getByRole('button', { name: /Secțiuni|Sections/ }).click()
  const sectionEditorMetrics = await page.evaluate(() => {
    const layout = document.querySelector('.mos-layout')
    const editor = document.querySelector('.mos-editor')
    return { layoutWidth: layout?.getBoundingClientRect().width ?? 0, editorWidth: editor?.getBoundingClientRect().width ?? 0 }
  })
  check(sectionEditorMetrics.layoutWidth > 1500 && sectionEditorMetrics.editorWidth > 1200, 'section editor should use the wider desktop viewport')
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-section-editor-wide.png'), 'section editor wide')
  await page.locator('.mos-editor-tabs').getByRole('button', { name: /Interacțiuni|Interactions/ }).click()
  const widePortalWidth = await page.locator('.portal').evaluate(element => element.getBoundingClientRect().width)
  check(widePortalWidth >= 1900, 'portal content should use the wider 1920-pixel viewport')
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-interactions-wide.png'), 'interactions editor wide')
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'interaction settings should not overflow at 1920 pixels')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.waitForFunction(() => /Setările au fost salvate|Settings saved/.test(document.querySelector('.mos-footer p[role="status"]')?.textContent ?? ''))
  const savedInteractions = await page.evaluate(() => window.settingsApi.getMosProjects().then(config => config.projects.find(project => project.id === 'builtin-telejurnal')?.interactions ?? []))
  check(savedInteractions.length === 1 && savedInteractions[0].name === 'QA restore title' && savedInteractions[0].enabled, 'valid interaction rule should persist through the settings editor')
  await page.evaluate(value => window.settingsApi.setLiveBoardConnection(value), initialConnection)
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).connection.mode === 'simulation', 'interaction editor scenarios should run in simulation mode before the TCP disconnect case')
  await page.locator('.portal-nav').getByRole('button', { name: /Consolă|Console/ }).click()
  await page.locator('.lb-runtime').waitFor()
  const activeProjectLabels = await page.locator('.lb-project-switch').evaluate(element => ({
    selected: element.querySelector('select option:checked')?.textContent?.trim(),
    selectedProject: element.querySelector('.lb-selected-project strong')?.textContent?.trim(),
    activeProject: element.querySelector('.lb-active-project strong')?.textContent?.trim(),
    selectorLeft: element.querySelector('select')?.getBoundingClientRect().left,
    statusLeft: element.querySelector('.lb-project-status')?.getBoundingClientRect().left,
  }))
  check(activeProjectLabels.selected === 'Telejurnal' && activeProjectLabels.activeProject === 'Telejurnal' && activeProjectLabels.selectedProject === undefined, 'active project selector should hide the redundant selected-project line when it matches runtime')
  check(Math.abs(activeProjectLabels.selectorLeft - activeProjectLabels.statusLeft) < 2, 'active project selector labels should align on the same left edge')

  const titleA = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Title A', Subtitle: 'Retained A' })
  const titleB = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Title B', Subtitle: 'Retained B' })
  check(titleA.entry.execution.selectedBuffer === 'A' && titleB.entry.execution.selectedBuffer === 'B', 'interaction scenario should establish the title section on buffer B')
  const titleBufferBeforeSuspend = await page.evaluate(async () => (await window.liveBoardApi.getSnapshot()).sections.find(section => section.sectionId === 'qa-main-section'))
  const numeStartedAt = Date.now()
  const nume = await postPlay(page, receiverPort, key, 'QA_NUME')
  check(nume.entry.execution.status === 'completed' && nume.entry.execution.steps.some(step => step.kind === 'suspend' && step.affectedSectionId === 'qa-main-section'), 'before-play interaction should suspend the title section before Nume PLAY')
  await waitForSectionState(page, 'qa-main-section', 'SUSPENDED')
  const suspendedTitle = await page.evaluate(async () => (await window.liveBoardApi.getSnapshot()).sections.find(section => section.sectionId === 'qa-main-section'))
  check(suspendedTitle.activeBuffer === 'B' && suspendedTitle.pendingRestore && suspendedTitle.suspendedBy?.sectionId === 'qa-nume-section', 'suspended title should report its exact B buffer and source section')
  const interactionJournal = page.locator('details.lb-manual-journal')
  if (!(await interactionJournal.evaluate(element => element.open))) await interactionJournal.locator(':scope > summary').click()
  await page.waitForFunction(() => document.querySelector('details.lb-manual-journal')?.open === true)
  const interactionJournalText = await interactionJournal.innerText()
  check(/QA restore title/.test(interactionJournalText) && /QA headline pair/.test(interactionJournalText) && /suspend/i.test(interactionJournalText), 'interaction journal should name the rule, source, affected section, and suspend action')
  check(!/liveBoard\.[A-Za-z][\w.-]*/.test(interactionJournalText), 'interaction journal should not show untranslated labels')
  await waitForSectionState(page, 'qa-nume-section', 'OFF', 9000)
  checks += 1
  const numeElapsedMs = Date.now() - numeStartedAt
  check(numeElapsedMs >= 5500 && numeElapsedMs < 9000, `QA Nume should use its existing six-second template duration once (elapsed ${numeElapsedMs} ms)`)
  const restoredTitle = await page.evaluate(async () => (await window.liveBoardApi.getSnapshot()).sections.find(section => section.sectionId === 'qa-main-section'))
  check(restoredTitle.state === 'ON_B' && restoredTitle.activeBuffer === 'B' && restoredTitle.activeTargetId === titleBufferBeforeSuspend.activeTargetId, 'six-second Nume auto-exit should restore the exact title buffer without flipping A/B state')
  check(JSON.stringify(restoredTitle.buffers.find(buffer => buffer.buffer === 'B').fields) === JSON.stringify(titleBufferBeforeSuspend.buffers.find(buffer => buffer.buffer === 'B').fields), 'suspend and restore should preserve existing title fields')
  check(!restoredTitle.sourceTemplate || restoredTitle.sourceTemplate === 'QA_HEADLINE', 'restored title should retain its source metadata')
  const restoredReportCard = page.locator('article.entry').filter({ hasText: nume.body.requestId }).first()
  await openRequestDetail(restoredReportCard)
  const restoredReportText = await restoredReportCard.innerText()
  check(/Suspend|Suspendat/i.test(restoredReportText) && /QA_NUME/.test(restoredReportText), 'interaction report should display a readable suspend step and source template')
  check(!/liveBoard\.step\./.test(restoredReportText), 'interaction report must not expose untranslated step keys')
  const followupTitle = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Following title', Subtitle: 'Following subtitle' })
  check(followupTitle.entry.execution.selectedBuffer === 'A', 'restoring B must leave the next title PLAY on the opposite buffer A')

  await page.evaluate(() => window.liveBoardApi.stopSection('qa-main-section'))
  const noTargetNume = await postPlay(page, receiverPort, key, 'QA_NUME')
  await waitForSectionState(page, 'qa-nume-section', 'OFF', 9000)
  checks += 1
  const offTitle = await page.evaluate(async () => (await window.liveBoardApi.getSnapshot()).sections.find(section => section.sectionId === 'qa-main-section'))
  check(offTitle.state === 'OFF' && offTitle.activeBuffer === null, 'suspending an OFF title target should not create a synthetic restored PLAY')
  check(noTargetNume.entry.execution.steps.some(step => step.kind === 'suspend' && /NOOP/.test(step.response ?? '')), 'OFF target interaction should record an explicit no-op')

  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Cancel A', Subtitle: 'Cancel A sub' })
  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Cancel B', Subtitle: 'Cancel B sub' })
  await postPlay(page, receiverPort, key, 'QA_NUME')
  await waitForSectionState(page, 'qa-main-section', 'SUSPENDED')
  await page.evaluate(() => window.liveBoardApi.stopSection('qa-main-section'))
  await waitForSectionState(page, 'qa-main-section', 'OFF')
  await waitForSectionState(page, 'qa-nume-section', 'OFF', 9000)
  checks += 1
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).sections.find(section => section.sectionId === 'qa-main-section').state === 'OFF', 'manual STOP of the suspended target should cancel its pending restore')
  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Cancel from console', Subtitle: 'Local cancel' })
  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Cancel from console B', Subtitle: 'Local cancel B' })
  await postPlay(page, receiverPort, key, 'QA_NUME')
  await waitForSectionState(page, 'qa-main-section', 'SUSPENDED')
  const suspendedSectionCard = page.locator('article.lb-section').filter({ hasText: 'QA headline pair' })
  await suspendedSectionCard.getByRole('button', { name: /Anulează revenirea|Cancel return/ }).click()
  await waitForSectionState(page, 'qa-main-section', 'OFF')
  await waitForSectionState(page, 'qa-nume-section', 'OFF', 9000)
  checks += 1
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).sections.find(section => section.sectionId === 'qa-main-section').state === 'OFF', 'console Cancel return should cancel the pending restore without issuing a return PLAY')
  const interactionRuntimeCard = page.locator('.lb-runtime')
  await captureElement(page, interactionRuntimeCard, path.join(os.tmpdir(), 'lbportal-interactions-runtime.png'), 'interaction runtime')
  const interactionJournalAfterCancel = page.locator('details.lb-manual-journal')
  if (!(await interactionJournalAfterCancel.evaluate(element => element.open))) await interactionJournalAfterCancel.locator('summary').click()
  const interactionJournalAfterCancelText = await interactionJournalAfterCancel.innerText()
  check(/NOOP: already suspended; pending restoration cancelled\./i.test(interactionJournalAfterCancelText), 'console Cancel return should record an explicit cancellation result')
  check(!/liveBoard\.[A-Za-z][\w.-]*/.test(await interactionRuntimeCard.innerText()), 'runtime and interaction journal should not show untranslated labels')

  tcpPort = await freePort()
  mock = spawn(process.execPath, [path.join(root, 'scripts', 'mock-liveboard.mjs'), '--port', String(tcpPort)], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  mock.stdout.setEncoding('utf8'); mock.stderr.setEncoding('utf8')
  mock.stdout.on('data', data => { mockOutput += data })
  mock.stderr.on('data', data => { mockOutput += data })
  await waitForText(() => mockOutput, /mock listening on/)
  const disconnectConnection = { mode: 'tcp', host: '127.0.0.1', port: tcpPort, timeoutMs: 1200 }
  await page.evaluate(value => window.settingsApi.setLiveBoardConnection(value), disconnectConnection)
  await page.evaluate(() => window.liveBoardApi.connect())
  await page.waitForFunction(() => window.liveBoardApi.getSnapshot().then(snapshot => snapshot.connection.status === 'connected'))
  await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Disconnect A', Subtitle: 'Disconnect A sub' })
  const disconnectTitleB = await postPlay(page, receiverPort, key, 'QA_HEADLINE', { Title: 'Disconnect B', Subtitle: 'Disconnect B sub' })
  check(disconnectTitleB.entry.execution.selectedBuffer === 'B', 'disconnect scenario should establish the active B title before suspension')
  const disconnectNumeStartedAt = Date.now()
  await postPlay(page, receiverPort, key, 'QA_NUME')
  await waitForSectionState(page, 'qa-main-section', 'SUSPENDED')
  const titleBPlaysBeforeDisconnect = (mockOutput.match(/LBC_PLAYCONTENT.*01_QA_B/g) ?? []).length
  const dropMock = mock
  const dropMockExited = new Promise(resolve => dropMock.once('exit', resolve))
  dropMock.kill('SIGTERM')
  await dropMockExited
  mock = null
  await waitForSectionState(page, 'qa-main-section', 'NEEDS_RESYNC')
  await waitForSectionState(page, 'qa-nume-section', 'NEEDS_RESYNC')
  const remainingAutoExitMs = Math.max(0, 6500 - (Date.now() - disconnectNumeStartedAt))
  if (remainingAutoExitMs) await new Promise(resolve => setTimeout(resolve, remainingAutoExitMs))
  const disconnectedSnapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(disconnectedSnapshot.sections.find(section => section.sectionId === 'qa-main-section').state === 'NEEDS_RESYNC', 'disconnect should leave the suspended title uncertain instead of restoring it')
  check((mockOutput.match(/LBC_PLAYCONTENT.*01_QA_B/g) ?? []).length === titleBPlaysBeforeDisconnect, 'disconnect during Nume must not send a delayed title restore PLAY')
  await page.evaluate(() => window.liveBoardApi.resyncSection('qa-main-section', 'OFF'))
  await page.evaluate(() => window.liveBoardApi.resyncSection('qa-nume-section', 'OFF'))
  await waitForSectionState(page, 'qa-main-section', 'OFF')
  await waitForSectionState(page, 'qa-nume-section', 'OFF')

  await page.getByRole('button', { name: /Setări|Settings/ }).click()
  await page.getByRole('heading', { name: /Conexiune LiveBoard|LiveBoard connection/ }).waitFor()
  const settingValues = await page.evaluate(() => ({
    mode: document.querySelector('.lb-connection-settings select')?.value,
    host: document.querySelector('.lb-connection-settings input')?.value,
    port: document.querySelectorAll('.lb-connection-settings input')[1]?.value,
  }))
  check(settingValues.mode === 'tcp' && settingValues.host === '127.0.0.1' && Number(settingValues.port) === tcpPort, 'settings UI should show the saved manual TCP configuration')
  await page.setViewportSize({ width: 1280, height: 1000 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-liveboard-settings-desktop.png'), 'LiveBoard settings desktop')
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'settings desktop viewport should not overflow horizontally')
  await page.setViewportSize({ width: 640, height: 900 })
  await page.evaluate(() => window.scrollTo(0, 0))
  await captureViewport(page, path.join(os.tmpdir(), 'lbportal-liveboard-settings-narrow.png'), 'LiveBoard settings narrow')
  check((await measureHorizontalScroll(page)).maxScrollX <= 1, 'settings narrow viewport should not overflow horizontally')
  await page.getByRole('button', { name: /Consolă|Console/ }).click()

  const wireBeforeRestart = mockOutput
  await page.locator('.lb-project-switch select').selectOption('builtin-retrospectiva')
  await page.getByRole('button', { name: /Activează proiectul|Activate project/ }).click()
  await waitForActiveProject(page, 'builtin-retrospectiva')
  const preRestartSnapshot = await page.evaluate(() => window.liveBoardApi.getSnapshot())
  check(preRestartSnapshot.sections.every(section => section.state === 'OFF'), 'final project selection should be saved only after every runtime section is OFF')
  check(mockOutput === wireBeforeRestart, 'activating a project while disconnected should not replay commands')

  await application.evaluate(({ app }) => app.exit(0))
  await application.close()
  application = null
  receiverPort = await freePort()
  application = await launchIsolated(userData, receiverPort)
  page = await firstPage(application)
  const restarted = await page.evaluate(async () => ({
    connection: await window.liveBoardApi.getSnapshot(),
    requests: await window.lbPortalApi.getRequests(),
    saved: await window.settingsApi.getLiveBoardConnection(),
    projects: await window.settingsApi.getMosProjects(),
  }))
  check(restarted.saved.mode === 'tcp' && restarted.saved.port === tcpPort, 'TCP settings must persist across restart')
  check(restarted.projects.version === 2 && restarted.projects.activeProjectId === 'builtin-retrospectiva', 'canonical project configuration and active Retrospectiva selection must persist across restart')
  const restartedRetrospectiva = restarted.projects.projects.find(project => project.id === 'builtin-retrospectiva')
  const restartedTelejurnal = restarted.projects.projects.find(project => project.id === 'builtin-telejurnal')
  check(restartedTelejurnal?.interactions?.length === 1 && restartedTelejurnal.interactions[0].name === 'QA restore title' && restartedTelejurnal.interactions[0].actions[0].restoreOn === 'auto-exit', 'interaction rule order, values, and suspend restore policy must persist across restart')
  const restartedRetroSection = restartedRetrospectiva?.mappings.sections[0]
  check(restartedRetroSection?.sources[0]?.template === 'QA_HEADLINE' && restartedRetroSection.targets.map(target => target.template).join(',') === '03_QA_RETRO_A,03_QA_RETRO_B', 'Retrospectiva source and distinct target mappings must persist across restart')
  check(restartedRetroSection.resumePlayDelayMs === 100 && restartedRetroSection.dataPropagationDelayMs === 500, 'Retrospectiva transition and edited data propagation timings must persist across restart')
  check(restartedRetroSection.sources[0].fields.map(field => field.targetFields[restartedRetroSection.targets[0].id]).join(',') === 'RETRO_TITLE_A,RETRO_SUBTITLE_A', 'Retrospectiva field destinations must persist across restart')
  check(!restarted.projects.projects.some(project => project.id === customProjectId), 'deleted standalone projects must remain deleted after restart')
  check(restarted.connection.activeProject.id === 'builtin-retrospectiva', 'runtime should restart with the persisted active project')
  check(restarted.connection.connection.status === 'disconnected', 'restart must not automatically connect')
  check(restarted.connection.sections.every(section => section.state === 'OFF'), 'runtime assumptions must restart OFF')
  check(restarted.requests.length === 0, 'request history must not replay after restart')
  check(!/Error occurred in handler for ['"]?settings:set/i.test(appStderr), 'settings denials should never escape as Electron settings:set handler exceptions')

  const captureSummary = process.argv.includes('--skip-captures')
    ? 'captures skipped by --skip-captures; no screenshots written'
    : `screenshots in ${os.tmpdir()}`
  console.log(`QA PASS: ${checks} isolated checks; maximized DevTools-disabled window, simulation workflow, interactions editor/runtime/suspend/restore/disconnect, project migration/scoping/CRUD, settings guard, TCP mock acknowledgements/error/resync, restart persistence, and responsive settings. ${captureSummary}. No credentials printed; no operator userData or LiveBoard hardware used.`)
  if (layoutFailures.length) throw new Error(`${layoutFailures.length} responsive layout assertion(s) failed; see metrics above.`)
}

function waitForText(read, pattern, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const timer = setInterval(() => {
      const value = read()
      if (pattern.test(value)) { clearInterval(timer); resolve() }
      else if (Date.now() - start > timeoutMs) { clearInterval(timer); reject(new Error('Local mock server did not become ready.')) }
    }, 25)
  })
}

run().catch(error => {
  console.error(`QA FAIL: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}).finally(async () => {
  if (application) {
    await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await application.close().catch(() => undefined)
  }
  if (mock && mock.exitCode === null) { mock.kill('SIGTERM'); await new Promise(resolve => mock.once('exit', resolve)) }
  rmSync(tempDir, { recursive: true, force: true })
})
