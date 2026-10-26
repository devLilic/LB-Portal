const assert = require('node:assert/strict')
const { chromium } = require('@playwright/test')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')

const outputDir = process.env.LB_PORTAL_QA_OUTPUT || path.resolve('node_modules/.cache/onair-qa')
const staticRoot = path.resolve('dist')
let qaServer = null
let qaBrowser = null
const projectOne = { id: 'qa-one', name: 'Telejurnal', kind: 'telejurnal', folderPath: 'C:\\exports\\telejurnal' }
const projectTwo = { id: 'qa-two', name: 'Retrospectiva săptămânii', kind: 'retrospectiva', folderPath: 'C:\\exports\\retrospectiva' }
const snapshot = (project, groupName, loadedAt) => ({
  projectId: project.id,
  folderPath: project.folderPath,
  loadedAt,
  groups: [{
    id: `${project.id}-group`,
    name: groupName,
    kind: 'invited',
    titles: [{
      id: `${project.id}-title`,
      source: { file: 'Titles.csv', record: 3, line: 4 },
      nr: '05',
      title: 'Un titlu de test suficient de lung pentru a verifica împachetarea cuvintelor la lățimi diferite\nLinie secundară păstrată',
      supratitle: 'ULTIMA ORĂ',
      template: '05_Titlu_Ultima_Ora',
    }, {
      id: `${project.id}-title-2`,
      source: { file: 'Titles.csv', record: 4, line: 5 },
      nr: '06',
      title: 'Al doilea titlu',
      supratitle: '',
      template: '05_Titlu_Ultima_Ora',
      }, ...Array.from({ length: 18 }, (_, index) => ({
        id: `${project.id}-long-title-${index + 1}`,
        source: { file: 'Titles.csv', record: index + 5, line: index + 6 },
        nr: String(index + 7),
        title: `Titlu lung QA ${index + 1} pentru verificarea capătului listei`,
        supratitle: '',
        template: '05_Titlu_Ultima_Ora',
      }))],
    persons: [{
      id: `${project.id}-person`,
      source: { file: 'Persons.csv', record: 2, line: 3 },
      name: 'Nume invitat cu text lung pentru verificarea împachetării',
      role: 'Analist invitat',
      template: '05_Titlu_Ultima_Ora',
    }],
    locations: [
      { id: `${project.id}-location`, source: { file: 'Locations.csv', record: 2, line: 3 }, template: '', location: 'Chișinău\nRepublica Moldova' },
      { id: `${project.id}-location-csv-template`, source: { file: 'Locations.csv', record: 3, line: 4 }, template: '05_Titlu_Ultima_Ora', location: 'Bălți' },
    ],
    phones: [{ id: `${project.id}-phone`, source: { file: 'Phones.csv', record: 2, line: 3 }, template: '   ', name: 'Intervenție telefonică', role: 'Reporter', imagePath: 'C:\\assets\\phone\\reporter image.png' }],
    waitTitleLocations: [],
  }, {
    id: `${project.id}-beta`, name: 'Beta 7 - Subiecte ale zilei', kind: 'beta',
    titles: [{ id: `${project.id}-beta-title`, source: { file: 'Titles.csv', record: 5, line: 6 }, nr: '07', title: 'Titlu din grupul Beta', supratitle: '', template: '' }],
    persons: [], locations: [], phones: [], waitTitleLocations: [],
  }],
})

const mosProject = (projectId, targetTemplate) => ({
  id: projectId, name: projectId, kind: 'standalone',
  mappings: { version: 1, sections: [{ id: 'qa-section', name: 'QA OnAir section', targets: [{ id: 'qa-target', template: targetTemplate }], resumePlayDelayMs: 0, sources: [] }] },
  onAirDefaultTemplates: { locations: 'QA_Location_Default', phones: 'QA_Phone_Default' },
  onAirMappings: [
    { id: 'qa-map-title', kind: 'titles', sourceTemplate: '05_Titlu_Ultima_Ora', sectionId: 'qa-section', fields: [
      { id: 'qa-field-title', sourceField: 'Titlu', targetFields: { 'qa-target': ['F_TEXT'] } },
      { id: 'qa-field-super', sourceField: 'Supratitlu', targetFields: { 'qa-target': ['F_SUPRA'] } },
    ] },
    { id: 'qa-map-person', kind: 'persons', sourceTemplate: '05_Titlu_Ultima_Ora', sectionId: 'qa-section', fields: [
      { id: 'qa-field-name', sourceField: 'Nume', targetFields: { 'qa-target': ['F_NAME'] } },
      { id: 'qa-field-role', sourceField: 'Functie', targetFields: { 'qa-target': ['F_ROLE'] } },
    ] },
    { id: 'qa-map-location-default', kind: 'locations', sourceTemplate: 'QA_Location_Default', sectionId: 'qa-section', fields: [
      { id: 'qa-field-location-default', sourceField: 'Locatie', targetFields: { 'qa-target': ['F_LOCATION'] } },
    ] },
    { id: 'qa-map-location-csv', kind: 'locations', sourceTemplate: '05_Titlu_Ultima_Ora', sectionId: 'qa-section', fields: [
      { id: 'qa-field-location', sourceField: 'Locatie', targetFields: { 'qa-target': ['F_LOCATION'] } },
    ] },
    { id: 'qa-map-phone', kind: 'phones', sourceTemplate: 'QA_Phone_Default', sectionId: 'qa-section', fields: [
      { id: 'qa-field-phone-name', sourceField: 'Nume', targetFields: { 'qa-target': ['F_NAME'] } },
      { id: 'qa-field-phone-role', sourceField: 'Functie', targetFields: { 'qa-target': ['F_ROLE'] } },
      { id: 'qa-field-phone-image', sourceField: 'Image', targetFields: { 'qa-target': ['F_IMAGE'] } },
    ] },
  ],
})

async function main() {
  fs.mkdirSync(outputDir, { recursive: true })
  const tempDir = path.join(outputDir, 'tmp')
  fs.mkdirSync(tempDir, { recursive: true })
  process.env.TMP = tempDir
  process.env.TEMP = tempDir
  qaServer = http.createServer((request, response) => {
    let requestPath
    try { requestPath = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname) }
    catch { response.writeHead(400).end(); return }
    let target = path.resolve(staticRoot, `.${requestPath}`)
    if (target !== staticRoot && !target.startsWith(`${staticRoot}${path.sep}`)) { response.writeHead(403).end(); return }
    if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) target = path.join(staticRoot, 'index.html')
    if (!fs.existsSync(target)) { response.writeHead(404).end('Renderer build not found. Run the production renderer build first.'); return }
    const contentType = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff': 'font/woff', '.woff2': 'font/woff2' })[path.extname(target)] || 'application/octet-stream'
    response.writeHead(200, { 'content-type': contentType })
    fs.createReadStream(target).pipe(response)
  })
  await new Promise((resolve, reject) => {
    qaServer.once('error', reject)
    qaServer.listen(Number(process.env.LB_PORTAL_QA_PORT || 7788), '127.0.0.1', resolve)
  })
  const address = qaServer.address()
  const baseUrl = process.env.LB_PORTAL_QA_URL || `http://127.0.0.1:${address.port}`
  qaBrowser = await chromium.launch({ headless: true, channel: process.env.LB_PORTAL_QA_BROWSER_CHANNEL || 'msedge' })
  const page = await qaBrowser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.addInitScript(({ first, second, firstSnapshot, secondSnapshot, firstSettings, secondSettings }) => {
    const config = {
      environment: 'development', appName: 'LB-Portal',
      features: { i18n: true, autoUpdate: false, appProtection: false, licensing: false, database: false, logging: true },
      i18n: { enabled: true, defaultLanguage: 'en', supportedLanguages: ['en', 'ro', 'ru'], namespaces: ['common', 'settings', 'updater', 'errors', 'onair'] },
    }
    window.appApi = { getConfig: () => config }
    window.i18nApi = { getCurrentLanguage: async () => ({ language: 'en' }) }
    window.settingsApi = { getMosProjects: async () => ({ version: 2, activeProjectId: first.id, projects: [firstSettings, secondSettings] }) }
    window.lbPortalApi = {
      getInfo: async () => ({ status: 'online', urls: [], accessKey: 'qa-key' }),
      getRequests: async () => [],
      onRequestReceived: () => () => {},
      onRequestUpdated: () => () => {},
      clearRequests: async () => undefined,
    }
    window.__activeRuntimeProject = first
    const runtimeSnapshot = () => ({
      activeProject: { id: window.__activeRuntimeProject.id, name: window.__activeRuntimeProject.name, kind: window.__activeRuntimeProject.kind },
      projects: [first, second], connection: { mode: 'simulation', status: 'simulated' },
      sections: [], operations: [],
    })
    window.liveBoardApi = {
      onSnapshot: () => () => {},
      getSnapshot: async () => runtimeSnapshot(),
      setActiveProject: async id => {
        window.__onAirCalls.activeProjectChanges++
        const project = [first, second].find(item => item.id === id)
        if (!project) return { ok: false, error: { code: 'LIVEBOARD_PROJECT_NOT_FOUND', sectionNames: [] } }
        window.__activeRuntimeProject = project
        return { ok: true, value: runtimeSnapshot() }
      },
    }
    window.__onAirCalls = { listProjects: 0, snapshots: [], refresh: 0, activeProjectChanges: 0 }
    window.__releaseFirstSnapshot = null
    window.__busyResponseOnce = false
    window.__busyResponsesRemaining = 0
    window.onAirApi = {
      listProjects: async () => { window.__onAirCalls.listProjects++; return [first, second] },
      chooseFolder: async () => null,
      getSnapshot: async (id) => {
        window.__onAirCalls.snapshots.push(id)
        if (id === first.id) return new Promise(resolve => { window.__releaseFirstSnapshot = () => resolve({ projectId: id, folderPath: first.folderPath, snapshot: window.__firstSnapshot, error: null, busy: false }) })
        if (id === second.id && window.__busyResponsesRemaining > 0) {
          window.__busyResponsesRemaining--
          return { projectId: id, folderPath: second.folderPath, snapshot: window.__secondSnapshot, error: null, busy: true }
        }
        return { projectId: id, folderPath: second.folderPath, snapshot: window.__secondSnapshot, error: null, busy: false }
      },
      refresh: async (id) => {
        window.__onAirCalls.refresh++
        return window.__onAirCalls.refresh === 1
          ? { projectId: id, folderPath: second.folderPath, snapshot: { ...window.__secondSnapshot, loadedAt: '2026-10-21T12:05:00.000Z' }, error: null, busy: false }
          : window.__onAirCalls.refresh === 2
          ? { projectId: id, folderPath: second.folderPath, snapshot: null, error: { code: 'SOURCE_CHANGED' }, busy: false }
          : { projectId: id, folderPath: second.folderPath, snapshot: null, error: { code: 'INVALID_CSV', file: 'Titles.csv', record: 3, detail: 'Quoted header is missing' }, busy: false }
      },
    }
    window.__firstSnapshot = firstSnapshot
    window.__secondSnapshot = secondSnapshot
  }, {
    first: projectOne,
    second: projectTwo,
    firstSettings: mosProject(projectOne.id, 'QA_Project_One_Template'),
    secondSettings: mosProject(projectTwo.id, 'QA_Project_Two_Template'),
    firstSnapshot: snapshot(projectOne, 'Telejurnal only data', '2026-10-21T11:00:00.000Z'),
    secondSnapshot: snapshot(projectTwo, 'Invitați și subiecte de actualitate', '2026-10-21T12:00:00.000Z'),
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'OnAir', exact: true }).click()
  const selector = page.getByRole('combobox', { name: 'Active project for incoming Plasma requests' })
  await selector.waitFor({ state: 'visible' })
  await selector.selectOption(projectTwo.id)
  await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).waitFor()
  await page.evaluate(() => window.__releaseFirstSnapshot?.())
  await page.waitForTimeout(150)
  assert.equal(await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).count(), 1)
  assert.equal(await page.getByText('Telejurnal only data', { exact: true }).count(), 0)
  await page.getByText('3 titles', { exact: true }).waitFor()
  const tabs = page.getByRole('tab')
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true', 'the invited tab should be selected by default')
  assert.equal(await tabs.nth(0).innerText(), 'Guests (Studio)')
  await tabs.nth(1).click()
  await page.getByText('Beta 7 - Subiecte ale zilei', { exact: true }).waitFor()
  assert.equal(await page.getByRole('tab').nth(1).innerText(), 'Beta 7', 'Beta tab labels should retain the source marker number')
  assert.equal(await page.locator('.onair-template-missing').count(), 1, 'missing source templates should be called out')
  await page.locator('.onair-mapping-preview summary').click()
  await page.getByText('This CSV item has no source template value.', { exact: true }).waitFor()
  await tabs.nth(1).press('ArrowLeft')
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true', 'ArrowLeft should select the previous tab')
  await tabs.nth(0).press('ArrowRight')
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true', 'ArrowRight should select the next tab')
  await tabs.nth(1).press('Home')
  assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true', 'Home should select the first tab')
  await tabs.nth(0).press('End')
  assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true', 'End should select the last tab')
  await tabs.nth(0).click()
  const titleItem = page.locator('.onair-item').filter({ hasText: 'Un titlu de test suficient' }).first()
  assert.equal(await page.locator('.onair-template').count(), 24, 'each item type should display its source template')
  const titleOrder = await titleItem.evaluate(element => ({ supertitle: element.querySelector('.onair-supertitle')?.compareDocumentPosition(element.querySelector('.onair-title-copy strong')) }))
  assert.ok((titleOrder.supertitle & 4) !== 0, 'supratitlu should precede the title in the DOM')
  await titleItem.locator('.onair-mapping-preview summary').click()
  assert.equal(await titleItem.locator('.onair-resolved-target > strong').first().innerText(), 'QA_Project_Two_Template', 'mapping previews should use the selected project configuration')
  await titleItem.getByText('F_TEXT', { exact: true }).waitFor()
  assert.match(await titleItem.locator('.onair-resolved-target dd').first().innerText(), /Un titlu de test suficient de lung/)
  const titleList = page.locator('.onair-titles-block')
  await titleList.evaluate(element => { element.scrollTop = element.scrollHeight })
  const finalTitle = page.locator('.onair-titles-block .onair-item').filter({ hasText: 'Titlu lung QA 18' })
  const finalTitleBounds = await finalTitle.boundingBox()
  const titleListBounds = await titleList.boundingBox()
  assert.ok(finalTitleBounds && titleListBounds && finalTitleBounds.y >= titleListBounds.y && finalTitleBounds.y + finalTitleBounds.height <= titleListBounds.y + titleListBounds.height, 'the final long-list title must be fully visible at the bottom of the scroll area')
  const emptyTitleItem = page.locator('.onair-item').filter({ hasText: 'Al doilea titlu' })
  await emptyTitleItem.locator('.onair-mapping-preview summary').click()
  await emptyTitleItem.getByText('F_SUPRA', { exact: true }).waitFor()
  await emptyTitleItem.getByText('(empty)', { exact: true }).waitFor()
  const personItem = page.locator('.onair-item').filter({ hasText: 'Nume invitat cu text lung' }).first()
  await personItem.locator('.onair-mapping-preview summary').click()
  assert.equal(await personItem.locator('.onair-resolved-target dd').nth(1).innerText(), 'Analist invitat')
  const locationItem = page.locator('.onair-item').filter({ hasText: 'Republica Moldova' }).first()
  assert.match(await locationItem.locator('.onair-template').innerText(), /CSV template missing.*QA_Location_Default/)
  await locationItem.locator('.onair-mapping-preview summary').click()
  await locationItem.getByText('Project default template: QA_Location_Default', { exact: true }).waitFor()
  assert.equal(await locationItem.locator('.onair-resolved-target dd').first().innerText(), 'Chișinău\nRepublica Moldova')
  const locationOverride = page.locator('.onair-item').filter({ hasText: 'Bălți' }).first()
  assert.equal(await locationOverride.locator('.onair-template').innerText(), '05_Titlu_Ultima_Ora', 'a CSV template should override the configured location default')
  await locationOverride.locator('.onair-mapping-preview summary').click()
  assert.equal(await locationOverride.locator('.onair-resolved-target dd').first().innerText(), 'Bălți')
  const phoneItem = page.locator('.onair-item').filter({ hasText: 'Intervenție telefonică' }).first()
  assert.match(await phoneItem.locator('.onair-template').innerText(), /CSV template missing.*QA_Phone_Default/)
  await phoneItem.locator('.onair-mapping-preview summary').click()
  await phoneItem.getByText('Project default template: QA_Phone_Default', { exact: true }).waitFor()
  assert.equal(await phoneItem.locator('.onair-resolved-target dd').nth(1).innerText(), 'Reporter')
  assert.equal(await phoneItem.locator('.onair-resolved-target dd').nth(2).innerText(), 'C:\\assets\\phone\\reporter image.png')
  const counts = await page.evaluate(() => ({ ...window.__onAirCalls }))
  assert.ok(counts.listProjects >= 1, 'OnAir should request the saved project list when it opens')
  assert.equal(counts.refresh, 0, 'opening OnAir must not refresh the CSV export')
  assert.ok(counts.snapshots.includes(projectOne.id) && counts.snapshots.includes(projectTwo.id), 'switching projects should load each memory snapshot')
  assert.equal(counts.activeProjectChanges, 0, 'changing the OnAir project selection alone must not activate a LiveBoard project')
  await page.getByRole('button', { name: 'Activate project', exact: true }).click()
  await page.getByText('Active in runtime: Retrospectiva săptămânii', { exact: true }).waitFor()
  assert.equal((await page.evaluate(() => window.__onAirCalls.activeProjectChanges)), 1, 'explicit OnAir activation should switch the selected runtime project')

  for (const width of [640, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({ path: path.join(outputDir, `onair-${width}.png`), fullPage: true })
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
    assert.ok(dimensions.document <= dimensions.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`)
  }
  await page.getByRole('tab', { name: 'Beta 7' }).click()
  await page.locator('.onair-mapping-preview summary').click()
  await page.screenshot({ path: path.join(outputDir, 'onair-beta-1280.png'), fullPage: true })
  await page.getByRole('tab', { name: 'Guests (Studio)' }).click()
  await page.evaluate(() => { window.__busyResponsesRemaining = 3 })
  await page.getByRole('button', { name: 'Console', exact: true }).click()
  await page.getByRole('button', { name: 'OnAir', exact: true }).click()
  await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.onair-refresh')?.disabled)
  assert.ok((await page.evaluate(() => window.__onAirCalls.snapshots.filter(id => id === 'qa-two').length)) >= 5, 'busy snapshots must be polled until the read becomes idle')
  assert.equal((await page.evaluate(() => window.__onAirCalls.refresh)), 0, 'polling a busy snapshot must not trigger a CSV refresh')
  await page.getByRole('tab', { name: 'Beta 7' }).click()
  await page.getByRole('button', { name: 'Refresh CSV' }).click()
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent === 'Beta 7')
  await page.getByRole('tab', { name: 'Guests (Studio)' }).click()
  await page.getByRole('button', { name: 'Refresh CSV' }).click()
  await page.getByRole('alert').getByText('Export source changed', { exact: true }).waitFor()
  assert.equal(await page.getByText('Un titlu de test suficient de lung', { exact: false }).count(), 0, 'a source change must clear the previous snapshot')
  await page.getByRole('button', { name: 'Refresh CSV' }).click()
  await page.getByRole('alert').getByText('Invalid CSV export').waitFor()
  assert.match(await page.locator('.onair-error-file').textContent(), /Titles\.csv.*record 3/, 'source diagnostics should remain visible')
  await page.getByText('Quoted header is missing', { exact: false }).waitFor()
  await qaBrowser.close()
  qaBrowser = null
  await new Promise(resolve => qaServer.close(resolve))
  qaServer = null
  process.stdout.write(`OnAir renderer QA passed. Screenshots: ${outputDir}\n`)
}

main().catch(async error => {
  if (qaBrowser) await qaBrowser.close().catch(() => undefined)
  if (qaServer) await new Promise(resolve => qaServer.close(resolve))
  console.error(error)
  process.exitCode = 1
})
