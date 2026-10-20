/* Headless layout QA for the compiled renderer. All data is fictional and every
 * app API is stubbed in this script; the probe has no Electron or device access. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { chromium } = require('playwright')
const localeSettings = Object.fromEntries(['ro', 'en', 'ru'].map(language => [language, require(`../src/i18n/locales/${language}/settings.json`)]))

for (const [language, settings] of Object.entries(localeSettings)) {
  assert.ok(settings.liveBoard.sectionState.SUSPENDED, `${language} is missing the suspended section label`)
  assert.ok(settings.liveBoard.step.suspend, `${language} is missing the suspend step label`)
  assert.ok(settings.liveBoard.provenance.interaction, `${language} is missing interaction provenance`)
}

const root = path.resolve(__dirname, '..')
const dist = process.env.LBPORTAL_DIST_DIR ? path.resolve(process.env.LBPORTAL_DIST_DIR) : path.join(root, 'dist')
const screenshotDir = process.env.LBPORTAL_SCREENSHOT_DIR
  ? path.resolve(process.env.LBPORTAL_SCREENSHOT_DIR)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'lbportal-renderer-layout-'))
if (process.env.LBPORTAL_SCREENSHOT_DIR) fs.mkdirSync(screenshotDir, { recursive: true })
const projectIds = { telejurnal: 'builtin-telejurnal', retrospectiva: 'builtin-retrospectiva' }
const projects = {
  version: 2,
  activeProjectId: projectIds.retrospectiva,
  projects: [
    {
      id: projectIds.telejurnal,
      name: 'Telejurnal',
      kind: 'telejurnal',
      mappings: { version: 1, sections: [{
        id: 'qa-telejurnal', name: 'Știri', targets: [{ id: 'qa-news-a', template: 'QA_NEWS_A' }],
        resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
        sources: [{ id: 'qa-news-source', template: 'QA_NEWS', exitMode: 'manual-resume', durationSeconds: 6, fields: [{ id: 'qa-news-field', param: 'Title', targetFields: { 'qa-news-a': 'TITLE' } }] }],
      }] },
    },
    {
      id: projectIds.retrospectiva,
      name: 'Retrospectiva săptămânii',
      kind: 'retrospectiva',
      mappings: { version: 1, sections: [
        {
          id: 'qa-titlu', name: 'Titluri', targets: [{ id: 'qa-titlu-a', template: 'QA_TITLE_A' }, { id: 'qa-titlu-b', template: 'QA_TITLE_B' }],
          resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
          sources: [{ id: 'qa-title-source', template: 'QA_TITLE', exitMode: 'manual-resume', durationSeconds: 6, fields: [{ id: 'qa-title-field', param: 'Title', targetFields: { 'qa-titlu-a': 'TITLE_A', 'qa-titlu-b': 'TITLE_B' } }] }],
        },
        {
          id: 'qa-nume', name: 'Nume', targets: [{ id: 'qa-nume-a', template: 'QA_NAME_A' }],
          resumePlayDelayMs: 100, dataPropagationDelayMs: 250,
          sources: [{ id: 'qa-name-source', template: 'QA_NAME', exitMode: 'template-duration', durationSeconds: 6, fields: [{ id: 'qa-name-field', param: 'Name', targetFields: { 'qa-nume-a': 'NAME' } }] }],
        },
      ] },
      interactions: [{
        id: 'qa-name-rule', name: 'Nume: suspendă Titlurile', enabled: true,
        triggerSectionId: 'qa-nume', event: 'before-play',
        actions: [{ id: 'qa-suspend-title', kind: 'suspend', sectionId: 'qa-titlu', delayMs: 0, restoreOn: 'auto-exit' }],
      }],
    },
  ],
}

const snapshot = {
  connection: { mode: 'simulation', status: 'simulation', host: '127.0.0.1', port: null, error: null },
  activeProject: { id: projectIds.retrospectiva, name: 'Retrospectiva săptămânii', kind: 'retrospectiva' },
  projects: [
    { id: projectIds.telejurnal, name: 'Telejurnal', kind: 'telejurnal' },
    { id: projectIds.retrospectiva, name: 'Retrospectiva săptămânii', kind: 'retrospectiva' },
  ],
  sections: [
    {
      sectionId: 'qa-titlu', name: 'Titluri', state: 'SUSPENDED', activeTargetId: 'qa-titlu-a', activeBuffer: 'A', busy: false,
      buffers: [{ id: 'qa-title-buffer-a', template: 'QA_TITLE_A', buffer: 'A', fields: { TITLE_A: 'Titlu demonstrativ' } }, { id: 'qa-title-buffer-b', template: 'QA_TITLE_B', buffer: 'B', fields: { TITLE_B: 'Titlu demonstrativ' } }],
      sourceTemplate: 'QA_TITLE', exitMode: 'manual-resume', error: null, confirmation: 'simulated',
      suspendedBy: { sectionId: 'qa-nume', sectionName: 'Nume', template: 'QA_NAME' }, pendingRestore: true, pendingTemplate: null,
    },
    {
      sectionId: 'qa-nume', name: 'Nume', state: 'ON_SINGLE', activeTargetId: 'qa-nume-a', activeBuffer: 'single', busy: false,
      buffers: [{ id: 'qa-name-buffer', template: 'QA_NAME_A', buffer: 'single', fields: { NAME: 'Persoană fictivă' } }],
      sourceTemplate: 'QA_NAME', exitMode: 'template-duration', error: null, confirmation: 'simulated',
      suspendedBy: null, pendingRestore: false, pendingTemplate: null,
    },
  ],
  operations: [{
    operationId: 'qa-operation-1', origin: 'interaction', projectId: projectIds.retrospectiva, projectName: 'Retrospectiva săptămânii', projectKind: 'retrospectiva',
    status: 'completed', mode: 'simulation', sectionId: 'qa-nume', sectionName: 'Nume', sourceTemplate: 'QA_NAME',
    beforeState: 'ON_A', afterState: 'ON_SINGLE', selectedTargetId: 'qa-nume-a', selectedBuffer: 'single', previousTargetId: null, nextBuffer: null,
    error: null, confirmation: 'simulated', interactionRuleName: 'Nume: suspendă Titlurile', interactionSourceSectionId: 'qa-nume', autoExitSourceTemplate: 'QA_NAME',
    steps: [{ kind: 'suspend', state: 'completed', interactionAction: 'suspend', interactionRuleName: 'Nume: suspendă Titlurile', provenance: 'interaction', sourceSectionName: 'Nume', affectedSectionName: 'Titluri', template: 'QA_TITLE_A', ms: 0 }],
  }],
}

const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' }
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname)
  const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
  if (!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) {
    response.writeHead(403).end('Forbidden'); return
  }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404).end('Not found'); return }
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' })
    response.end(data)
  })
})

function getConfig() {
  return {
    environment: 'production', appName: 'LB-Portal QA',
    features: { i18n: true, autoUpdate: false, appProtection: false, licensing: false, database: false, logging: false },
    update: { enabled: false, channel: 'latest', autoCheck: false, autoDownload: false, allowPrerelease: false, provider: { provider: 'github', owner: '', repo: '', visibility: 'public' } },
    i18n: { enabled: true, defaultLanguage: 'ro', supportedLanguages: ['ro', 'en', 'ru'], namespaces: ['common', 'settings'] },
    appProtection: { enabled: false, profile: 'standard', allowDevTools: false },
    licensing: { enabled: false, deviceBinding: false, enforceMachineMatch: false, allowGraceOnMismatch: false, publicKey: null, gracePeriodDays: 0, heartbeatIntervalMs: 60000, degradedMode: 'readonly', provider: 'noop', apiBaseUrl: null, timeoutMs: 1000, endpoints: { status: '', activate: '', validate: '', heartbeat: '', entitlements: '' } },
    database: { enabled: false, provider: 'sqlite', orm: 'drizzle', fileName: '', inMemoryForTests: true },
    logging: { enabled: false, level: 'silent' },
  }
}

async function main() {
  assert.ok(fs.existsSync(path.join(dist, 'index.html')), `Built renderer is missing at ${dist}`)
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const address = server.address()
  let browser
  try {
    browser = await chromium.launch({ headless: true, executablePath: process.env.LBPORTAL_BROWSER_EXE || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', args: ['--disable-background-networking', '--disable-extensions'] })
  } catch (error) {
    throw new Error(`Headless Chrome could not start (${error.message}). Set LBPORTAL_BROWSER_EXE to an installed Chrome/Edge executable; this probe will not download a browser.`)
  }

  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
    const runtimeErrors = []
    page.on('pageerror', error => runtimeErrors.push(error.message))
    // The sandbox may deny browser sockets even for loopback. Keep the browser
    // URL on 127.0.0.1 and fulfill each request from the built dist files locally.
    await page.route(`http://127.0.0.1:${address.port}/**`, async route => {
      const pathname = decodeURIComponent(new URL(route.request().url()).pathname)
      const file = path.resolve(dist, `.${pathname === '/' ? '/index.html' : pathname}`)
      if ((!file.startsWith(`${dist}${path.sep}`) && file !== path.join(dist, 'index.html')) || !fs.existsSync(file)) {
        await route.fulfill({ status: 404, body: 'Not found' }); return
      }
      await route.fulfill({ status: 200, contentType: mime[path.extname(file)] ?? 'application/octet-stream', body: fs.readFileSync(file) })
    })
    await page.addInitScript(({ fixtureProjects, fixtureSnapshot, appConfig }) => {
      const noop = () => () => {}
      const storageKey = 'lbportal-renderer-layout-qa-projects'
      const getProjects = () => {
        try { return JSON.parse(localStorage.getItem(storageKey)) ?? fixtureProjects } catch { return fixtureProjects }
      }
      window.appApi = { getConfig: () => appConfig, getAppInfo: async () => ({ name: 'LB-Portal QA', version: '0.0.0' }), onMainProcessMessage: noop, openWindow: async () => {} }
      window.i18nApi = { getCurrentLanguage: async () => ({ language: 'ro' }), getSupportedLanguages: async () => ({ languages: ['ro', 'en', 'ru'] }), getResources: async () => ({}), setLanguage: async value => value }
      window.settingsApi = {
        getMosProjects: async () => getProjects(),
        getMosMappings: async () => getProjects().projects.find(project => project.id === getProjects().activeProjectId)?.mappings ?? fixtureProjects.projects[1].mappings,
        getLiveBoardConnection: async () => ({ mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 5000 }),
        trySaveMosProjects: async value => { localStorage.setItem(storageKey, JSON.stringify(value)); return { ok: true, value } }, trySaveMosMappings: async value => ({ ok: true, value }),
        trySaveLiveBoardConnection: async value => ({ ok: true, value }), setLiveBoardConnection: async value => value,
        getLanguage: async () => 'ro', setLanguage: async value => value,
        getUpdatePreferences: async () => ({ autoCheck: false, downloadStrategy: 'manual' }), setUpdatePreferences: async value => value,
        getUiPreferences: async () => ({ theme: 'light', density: 'comfortable' }), setUiPreferences: async value => value,
      }
      window.lbPortalApi = { getInfo: async () => ({ status: 'online', port: 47835, accessKey: 'fictional-qa-only', urls: ['http://127.0.0.1:47835'], error: null }), getRequests: async () => [], clearRequests: async () => {}, onRequestReceived: noop, onRequestUpdated: noop }
      window.liveBoardApi = { getSnapshot: async () => fixtureSnapshot, onSnapshot: noop, connect: async () => fixtureSnapshot, disconnect: async () => fixtureSnapshot, takeOutSection: async () => fixtureSnapshot, stopSection: async () => fixtureSnapshot, resyncSection: async () => fixtureSnapshot, setActiveProject: async () => ({ ok: true, value: fixtureSnapshot }) }
      window.updateApi = { checkForUpdates: async () => ({}), downloadUpdate: async () => {}, quitAndInstall: async () => {}, onStateChange: noop, onAvailabilityChanged: noop, onError: noop, onDownloadProgress: noop, onDownloaded: noop }
    }, { fixtureProjects: projects, fixtureSnapshot: snapshot, appConfig: getConfig() })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Setări' }).click()
    await page.getByRole('heading', { name: 'Mapări MOS' }).waitFor()
    await page.locator('.mos-edit-lock').waitFor()

    const measurements = []
    for (const width of [1920, 1280, 640]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const view of ['sections', 'interactions']) {
        await page.locator(`.mos-editor-tabs button`).nth(view === 'sections' ? 0 : 1).click()
        if (view === 'interactions') await page.locator('.mos-interaction-rule').waitFor()
        else await page.locator('.mos-layout').waitFor()
        await page.waitForTimeout(120)
        const metric = await page.evaluate(({ width: viewportWidth, viewName }) => {
          const doc = document.documentElement
          const offenders = [...document.querySelectorAll('body *')].map(element => {
            const rect = element.getBoundingClientRect()
            const style = getComputedStyle(element)
            return { tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '', id: element.id, text: (element.innerText || '').trim().slice(0, 72), left: Math.round(rect.left * 10) / 10, right: Math.round(rect.right * 10) / 10, width: Math.round(rect.width * 10) / 10, boxSizing: style.boxSizing }
          }).filter(item => item.width > 0 && item.right > window.innerWidth + 1).sort((a, b) => b.right - a.right).slice(0, 8)
          const editor = document.querySelector(viewName === 'sections' ? '.mos-editor' : '.mos-interactions')
          const rect = editor?.getBoundingClientRect()
          const startX = window.scrollX
          window.scrollTo({ left: 100000, top: window.scrollY, behavior: 'instant' })
          const maxScrollX = window.scrollX
          window.scrollTo({ left: startX, top: window.scrollY, behavior: 'instant' })
          return { viewport: viewportWidth, innerWidth: window.innerWidth, clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, maxScrollX, overflow: maxScrollX > 1, view: viewName, editor: rect ? { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), shareOfViewport: Math.round(rect.width / viewportWidth * 100) } : null, offenders }
        }, { width, viewName: view })
        measurements.push(metric)
        const pngPath = path.resolve(screenshotDir, `settings-${view}-${width}.png`)
        await page.screenshot({ path: pngPath, fullPage: true })
        console.log(`SCREENSHOT ${pngPath}`)
      }
    }

    // Exercise section reordering and project duplication against the compiled
    // renderer. The stub persists only to this browser's localStorage so a page
    // reload can verify the same save path without touching operator settings.
    const projectPicker = page.getByLabel('Proiect editat')
    await projectPicker.selectOption(projectIds.retrospectiva)
    await page.locator('.mos-editor-tabs button').nth(0).click()
    await page.getByRole('button', { name: 'Mută Titluri în jos' }).click()
    const orderedSectionNames = async () => page.locator('.mos-section-item').evaluateAll(items => items.map(item => item.innerText.replace(/^\s*\d+\s*/, '').trim()))
    assert.deepEqual(await orderedSectionNames(), ['Nume', 'Titluri'], 'Reordering should move the selected section below Nume.')
    assert.match(await page.locator('.mos-section-item[aria-current="true"]').innerText(), /Titluri/, 'The selected section should stay selected after reordering.')
    await page.locator('.mos-editor-tabs button').nth(1).click()
    await page.locator('.mos-interaction-rule').waitFor()
    assert.match(await page.locator('.mos-rule-summary').first().innerText(), /Nume.*Titluri/, 'The interaction should still refer to the same named sections after reordering.')
    await page.getByRole('button', { name: 'Salvează setările' }).click()
    await page.getByText('Setările au fost salvate.', { exact: true }).waitFor()
    const reorderedSavedProjects = await page.evaluate(() => window.settingsApi.getMosProjects())
    const sourceBeforeDuplicate = structuredClone(reorderedSavedProjects.projects.find(item => item.id === 'builtin-retrospectiva'))
    assert.deepEqual(sourceBeforeDuplicate.mappings.sections.map(item => item.name), ['Nume', 'Titluri'], 'The reordered section order should persist through the stub save API.')
    assert.equal(sourceBeforeDuplicate.interactions[0].triggerSectionId, 'qa-nume', 'The saved rule trigger reference should be preserved.')
    assert.equal(sourceBeforeDuplicate.interactions[0].actions[0].sectionId, 'qa-titlu', 'The saved rule action reference should be preserved.')

    await page.locator('.mos-editor-tabs button').nth(0).click()
    await page.getByRole('button', { name: 'Duplică proiectul' }).click()
    const duplicateProjectId = await projectPicker.inputValue()
    assert.ok(duplicateProjectId && duplicateProjectId !== projectIds.retrospectiva, 'Duplicating should select a new project automatically.')
    assert.equal(await page.evaluate(() => window.settingsApi.getMosProjects().then(value => value.activeProjectId)), projectIds.retrospectiva, 'Duplicating should not change the active runtime project.')
    await page.getByLabel('Numele proiectului').fill('QA Copie independentă')
    await page.getByRole('button', { name: 'Salvează setările' }).click()
    await page.getByText('Setările au fost salvate.', { exact: true }).waitFor()
    let savedAfterDuplicate = await page.evaluate(() => window.settingsApi.getMosProjects())
    const duplicatedProject = savedAfterDuplicate.projects.find(item => item.id === duplicateProjectId)
    assert.ok(duplicatedProject, 'The duplicate should persist via the existing save API stub.')
    assert.equal(duplicatedProject.kind, 'standalone', 'A duplicate of a built-in project should be independent.')
    assert.equal(duplicatedProject.name, 'QA Copie independentă', 'The explicit name edit should persist.')
    assert.equal(savedAfterDuplicate.activeProjectId, projectIds.retrospectiva, 'The active runtime project should stay unchanged after duplication and rename.')
    assert.deepEqual(savedAfterDuplicate.projects.find(item => item.id === projectIds.retrospectiva), sourceBeforeDuplicate, 'Editing the duplicate should leave the original project intact.')

    const collectIds = value => {
      const ids = []
      const visit = item => {
        if (!item || typeof item !== 'object') return
        if (Array.isArray(item)) { item.forEach(visit); return }
        if (typeof item.id === 'string') ids.push(item.id)
        Object.values(item).forEach(visit)
      }
      visit(value)
      return ids
    }
    const sourceIds = collectIds(sourceBeforeDuplicate)
    const duplicateIds = collectIds(duplicatedProject)
    assert.equal(new Set(duplicateIds).size, duplicateIds.length, 'Every duplicated entity should have a unique ID.')
    assert.equal(sourceIds.filter(id => duplicateIds.includes(id)).length, 0, 'The duplicate should use independent IDs for every entity.')
    const remap = new Map()
    const pairIds = (original, copy) => {
      if (!original || !copy || typeof original !== 'object' || typeof copy !== 'object') return
      if (Array.isArray(original) && Array.isArray(copy)) { assert.equal(original.length, copy.length); original.forEach((item, index) => pairIds(item, copy[index])); return }
      if (Array.isArray(original) || Array.isArray(copy)) return
      if (typeof original.id === 'string' && typeof copy.id === 'string') remap.set(copy.id, original.id)
      for (const key of Object.keys(original)) if (key in copy) pairIds(original[key], copy[key])
    }
    pairIds(sourceBeforeDuplicate, duplicatedProject)
    const canonicalize = (value, keyMap = false) => {
      if (Array.isArray(value)) return value.map(item => canonicalize(item))
      if (!value || typeof value !== 'object') return typeof value === 'string' ? (remap.get(value) ?? value) : value
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [remap.get(key) ?? key, canonicalize(child)]))
    }
    assert.deepEqual(canonicalize({ mappings: duplicatedProject.mappings, interactions: duplicatedProject.interactions }), { mappings: sourceBeforeDuplicate.mappings, interactions: sourceBeforeDuplicate.interactions }, 'The duplicate should copy all section, target, source, field, and interaction content with remapped IDs and references.')
    const duplicateSectionIds = new Set(duplicatedProject.mappings.sections.map(item => item.id))
    const duplicateTargetIds = new Set(duplicatedProject.mappings.sections.flatMap(item => item.targets.map(target => target.id)))
    for (const rule of duplicatedProject.interactions ?? []) {
      assert.ok(duplicateSectionIds.has(rule.triggerSectionId), 'Duplicated interaction trigger should reference a duplicated section.')
      for (const action of rule.actions) {
        assert.ok(duplicateSectionIds.has(action.sectionId), 'Duplicated interaction action should reference a duplicated section.')
        if (action.targetId) assert.ok(duplicateTargetIds.has(action.targetId), 'Duplicated interaction target should reference a duplicated target.')
      }
    }
    for (const section of duplicatedProject.mappings.sections) for (const source of section.sources) for (const field of source.fields) {
      assert.ok(Object.keys(field.targetFields).every(id => section.targets.some(target => target.id === id)), 'Duplicated target field references should use duplicated target IDs.')
    }

    for (const width of [1920, 640]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator('.mos-editor').waitFor()
      await page.waitForTimeout(100)
      const metrics = await page.evaluate(() => ({ viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, bodyWidth: document.body.scrollWidth }))
      assert.ok(metrics.documentWidth <= metrics.viewport && metrics.bodyWidth <= metrics.viewport, `Project editing overflows horizontally at ${width}px: ${JSON.stringify(metrics)}`)
      const pngPath = path.resolve(screenshotDir, `project-duplicate-${width}.png`)
      await page.screenshot({ path: pngPath, fullPage: true })
      console.log(`SCREENSHOT ${pngPath}`)
    }
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Setări' }).click()
    await page.getByRole('heading', { name: 'Mapări MOS' }).waitFor()
    const reloadedProjects = await page.evaluate(() => window.settingsApi.getMosProjects())
    assert.equal(reloadedProjects.projects.find(item => item.id === duplicateProjectId)?.name, 'QA Copie independentă', 'The duplicate name should survive a renderer reload.')
    await page.getByLabel('Proiect editat').selectOption(duplicateProjectId)
    assert.equal(await page.getByLabel('Numele proiectului').inputValue(), 'QA Copie independentă', 'The saved duplicate name should appear in the editor after reload.')

    await page.locator('.portal-nav button').first().click()
    await page.getByLabel('Proiect activ').waitFor()
    await page.locator('.lb-manual-journal summary').click()
    await page.locator('.lb-state.state-suspended').waitFor({ timeout: 5000 })
    const consoleText = await page.locator('.lb-runtime').innerText()
    const rawTranslationKeys = [...new Set(consoleText.match(/liveBoard\.[\w.-]+/g) ?? [])]
    assert.deepEqual(rawTranslationKeys, [], `Console fixture contains untranslated LiveBoard keys: ${rawTranslationKeys.join(', ')}`)
    assert.ok(consoleText.includes('Secțiune sursă: Nume'), 'Journal should show the saved source section name.')
    assert.ok(!consoleText.includes('qa-nume'), 'Journal should not expose the fixture section ID when its saved name is available.')
    await page.setViewportSize({ width: 1280, height: 1000 })
    const consoleMetrics = await page.evaluate(() => {
      const doc = document.documentElement
      const offenders = [...document.querySelectorAll('body *')].map(element => {
        const rect = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { tag: element.tagName.toLowerCase(), className: typeof element.className === 'string' ? element.className : '', id: element.id, text: (element.innerText || '').trim().slice(0, 72), left: Math.round(rect.left * 10) / 10, right: Math.round(rect.right * 10) / 10, width: Math.round(rect.width * 10) / 10, boxSizing: style.boxSizing }
      }).filter(item => item.width > 0 && item.right > window.innerWidth + 1).sort((a, b) => b.right - a.right).slice(0, 8)
      const startX = window.scrollX
      window.scrollTo({ left: 100000, top: window.scrollY, behavior: 'instant' })
      const maxScrollX = window.scrollX
      window.scrollTo({ left: startX, top: window.scrollY, behavior: 'instant' })
      return { viewport: 1280, innerWidth: window.innerWidth, clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, maxScrollX, overflow: maxScrollX > 1, view: 'console', offenders }
    })
    console.log(`CONSOLE_METRICS ${JSON.stringify(consoleMetrics, null, 2)}`)
    const consolePath = path.resolve(screenshotDir, 'console-suspended-fixture-1280.png')
    await page.screenshot({ path: consolePath, fullPage: true })
    console.log(`SCREENSHOT ${consolePath}`)

    console.log('METRICS ' + JSON.stringify(measurements, null, 2))
    assert.deepEqual(runtimeErrors, [], `Renderer emitted errors: ${runtimeErrors.join(' | ')}`)
    const overflow = [...measurements.filter(item => item.overflow), ...(consoleMetrics.overflow ? [consoleMetrics] : [])]
    if (overflow.length) console.error(`LAYOUT_OVERFLOW ${JSON.stringify(overflow)}`)
    assert.equal(overflow.length, 0, 'A measured renderer viewport has horizontal document overflow.')
    for (const item of measurements.filter(item => item.viewport >= 1280)) {
      assert.ok(item.editor?.shareOfViewport >= 70, `${item.view} editor is too narrow at ${item.viewport}px: ${JSON.stringify(item.editor)}`)
    }
  } finally {
    await browser.close()
    await new Promise(resolve => server.close(resolve))
  }
  console.log(`Renderer layout QA passed. Screenshots: ${screenshotDir}`)
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1 })
