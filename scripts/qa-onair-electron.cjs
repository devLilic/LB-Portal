/* Isolated Electron QA for the OnAir CSV IPC and renderer flow.
 * Uses fictional PA CSV fixtures and a disposable userData directory. It never
 * reads or writes operator settings and never connects to LiveBoard hardware.
 */
const { _electron } = require('playwright')
const { chromium } = require('@playwright/test')
const { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync } = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const net = require('node:net')
const { pathToFileURL } = require('node:url')
const assert = require('node:assert/strict')

const root = path.resolve(__dirname, '..')
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'lbportal-onair-qa-'))
let application = null
let appStderr = ''
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

function makeFixtures(folder) {
  mkdirSync(folder, { recursive: true })
  const titles = [
    'Nr;Titlu;Supratitlu;Template',
    '--- BETA 1 ---;;;',
    '1;"He said ""hello""";Primul titlu;05_Titlu',
    '2;Titlu doi;Supratitlu doi;05_Titlu',
    '3;Titlu trei;Supratitlu trei;05_Titlu',
    '4;Titlu patru;Supratitlu patru;05_Titlu',
    '5;Titlu cinci;Supratitlu cinci;05_Titlu',
    '6;Titlu șase;Supratitlu șase;05_Titlu',
    '7;Titlu șapte;Supratitlu șapte;05_Titlu',
    '8;Titlu opt;Supratitlu opt;05_Titlu',
    '9;Titlu nouă;Supratitlu nouă;05_Titlu',
  ].join('\r\n') + '\r\n'
  const persons = [
    'Sectiune;Nume;Functie;Template',
    '--- BETA 1 ---;;;',
    ';Ana Ionescu;Prezentatoare;06_Persoana',
    ';Mihai Popa;Reporter;06_Persoana',
    ';Elena Rusu;Invitat;06_Persoana',
    ';Victor Luca;Reporter;06_Persoana',
    ';Ioana Matei;Invitat;06_Persoana',
    ';Radu Pavel;Reporter;06_Persoana',
    ';Daria Munteanu;Invitat;06_Persoana',
    ';Sorin Dima;Reporter;06_Persoana',
  ].join('\r\n') + '\r\n'
  const locations = 'Locatie;Template\r\nStudioul principal;PA_Location\r\n'
  const phones = 'Nume;Functie;Image;Template\r\nAna Ionescu;Prezentatoare;images/ana.png;PA_Phone\r\n'
  for (const [name, contents] of Object.entries({
    'PA_titles.csv': titles,
    'PA_persons.csv': persons,
    'PA_locations.csv': locations,
    'PA_phones.csv': phones,
  })) writeFileSync(path.join(folder, name), contents, 'utf8')
}

async function freePort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

async function launchIsolated(userDataPath, receiverPort, csvFolder) {
  const wrapper = path.join(tempDir, 'launch.cjs')
  const compiledMain = pathToFileURL(path.join(root, 'dist-electron', 'main', 'index.js')).href
  const intercept = `
    const { app } = require('electron');
    app.setPath('userData', ${JSON.stringify(userDataPath)});
    app.on('browser-window-created', (_event, window) => { window.on('show', () => window.hide()); window.hide(); window.webContents.setBackgroundThrottling(false); });
    const fsPromises = require('node:fs/promises');
    const originalReadFile = fsPromises.readFile;
    const csvFolder = ${JSON.stringify(path.resolve(csvFolder).toLowerCase())};
    global.__qaCsvReadCount = 0;
    fsPromises.readFile = function(file, ...args) {
      if (typeof file === 'string' && path.resolve(file).toLowerCase().startsWith(csvFolder + path.sep.toLowerCase())) global.__qaCsvReadCount += 1;
      return originalReadFile.call(this, file, ...args);
    };
    const path = require('node:path');
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

function countItems(snapshot, field) {
  return snapshot.groups.reduce((count, group) => count + group[field].length, 0)
}

function makeProjects(csvFolder) {
  const csvSource = (kind, fileName, columns) => ({ kind, fileName, columns })
  return {
    version: 2,
    activeProjectId: 'builtin-telejurnal',
    projects: [
      { id: 'builtin-telejurnal', name: 'Telejurnal', kind: 'telejurnal', mappings: { version: 1, sections: [] } },
      { id: 'builtin-retrospectiva', name: 'Retrospectiva săptămânii', kind: 'retrospectiva', mappings: { version: 1, sections: [] } },
      { id: 'qa-punctul-pe-azi', name: 'Punctul pe Azi', kind: 'standalone', mappings: { version: 1, sections: [
        { id: 'qa-csv-section', name: 'CSV graphics', resumePlayDelayMs: 100, dataPropagationDelayMs: 250, targets: [{ id: 'qa-csv-a', template: 'PA_Title_A' }, { id: 'qa-csv-b', template: 'PA_Title_B' }], sources: [], csvSource: csvSource('titles', 'PA_titles.csv', { Nr:'Nr', Titlu:'Titlu', Supratitlu:'Supratitlu', Template:'Template' }) },
        { id: 'qa-location-section', name: 'CSV location', resumePlayDelayMs: 100, dataPropagationDelayMs: 250, targets: [{ id: 'qa-location-target', template: 'PA_Location' }], sources: [], csvSource: csvSource('locations', 'PA_locations.csv', { Locatie:'Locatie', Template:'Template' }) },
        { id: 'qa-person-section', name: 'CSV persons', resumePlayDelayMs: 100, dataPropagationDelayMs: 250, targets: [{ id: 'qa-person-target', template: 'PA_Person' }], sources: [], csvSource: csvSource('persons', 'PA_persons.csv', { Sectiune:'Sectiune', Nume:'Nume', Functie:'Functie', Template:'Template' }) },
        { id: 'qa-phone-section', name: 'CSV phones', resumePlayDelayMs: 100, dataPropagationDelayMs: 250, targets: [{ id: 'qa-phone-target', template: 'PA_Phone' }], sources: [], csvSource: csvSource('phones', 'PA_phones.csv', { Nume:'Nume', Functie:'Functie', Image:'Image', Template:'Template' }) },
      ] }, onAirCsv: { format: 'pa-csv', folderPath: csvFolder } },
    ],
  }
}

async function verifyGoodSnapshot(page, projectId) {
  const state = await page.evaluate(id => window.onAirApi.getSnapshot(id), projectId)
  check(state.snapshot !== null, 'OnAir refresh should return a snapshot')
  check(countItems(state.snapshot, 'titles') === 9, 'snapshot should contain nine titles')
  check(countItems(state.snapshot, 'persons') === 8, 'snapshot should contain eight persons')
  check(countItems(state.snapshot, 'locations') === 1, 'snapshot should contain one location')
  check(countItems(state.snapshot, 'phones') === 1, 'snapshot should contain one phone')
  check(state.busy === false, 'OnAir state should be idle after refresh')
  const quotedTitle = state.snapshot.groups.flatMap(group => group.titles).find(item => item.title === 'He said "hello"')
  check(!!quotedTitle, 'CSV escaped quotes should decode into a quote in the title text')
  return state.snapshot
}

async function captureExistingSettingsPreview() {
  const screenshotDir = path.join(root, 'node_modules', '.cache', 'onair-qa')
  const serializedPath = path.join(screenshotDir, 'settings-mappings-static.html')
  let html = readFileSync(serializedPath, 'utf8')
  const cssDir = path.join(root, 'dist', 'assets')
  const cssText = require('node:fs').readdirSync(cssDir).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(cssDir, file), 'utf8')).join('\n')
  html = html.replace(/<style>[\s\S]*?<\/style>/i, `<style>${cssText}</style>`)
  let cardIndex = 0
  html = html.replace(/<article class="onair-mapping-card"[\s\S]*?<\/article>/g, card => {
    const targetClass = cardIndex++ === 0 ? 'paired-targets' : 'single-target'
    return card.replace(/class="onair-field-row(?:\s+[^\"]*)?"/g, `class="onair-field-row ${targetClass}"`)
  })
  writeFileSync(serializedPath, html, 'utf8')
  const browser = await chromium.launch({ headless: true, channel: 'msedge' })
  try {
    const previewPage = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    await previewPage.setContent(html, { waitUntil: 'domcontentloaded' })
    for (const width of [1280, 640]) {
      await previewPage.setViewportSize({ width, height: 900 })
      const layout = await previewPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
      assert.ok(layout.scrollWidth <= layout.innerWidth, `Serialized settings preview should fit at ${width}px: ${JSON.stringify(layout)}`)
      await previewPage.screenshot({ path: path.join(screenshotDir, `settings-mappings-${width}.png`), fullPage: true, timeout: 10000 })
    }
    console.log('QA CAPTURE PASS: refreshed styled OnAir mapping editor previews at 1280px and 640px from the saved native DOM.')
  } finally {
    await browser.close()
  }
}

async function run() {
  const userData = path.join(tempDir, 'disposable-user-data')
  const csvFolder = path.join(tempDir, 'fixture-pa-csv')
  const changedFolder = path.join(tempDir, 'changed-pa-source')
  mkdirSync(userData, { recursive: true })
  makeFixtures(csvFolder)
  writeFileSync(path.join(userData, 'settings.json'), JSON.stringify({
    language: 'en',
    mosMappings: makeProjects(csvFolder),
    liveBoardConnection: { mode: 'simulation', host: '127.0.0.1', port: null, timeoutMs: 1000 },
  }, null, 2), 'utf8')

  let receiverPort = await freePort()
  application = await launchIsolated(userData, receiverPort, csvFolder)
  let page = await firstPage(application)
  const projectId = 'qa-punctul-pe-azi'

  const initial = await page.evaluate(async id => ({
    state: await window.onAirApi.getSnapshot(id),
    runtime: await window.liveBoardApi.getSnapshot(),
  }), projectId)
  check(initial.state.snapshot === null && initial.state.busy === false, 'startup getSnapshot should be empty and idle')
  check(await application.evaluate(() => globalThis.__qaCsvReadCount) === 0, 'startup and initial getSnapshot must not read CSV files')
  check(initial.runtime.activeProject.id === 'builtin-telejurnal', 'OnAir standalone configuration must not change the active console project')

  const listed = await page.evaluate(() => window.onAirApi.listProjects())
  const listedProject = listed.find(project => project.id === projectId)
  check(listedProject?.folderPath === csvFolder, 'listProjects should report the configured PA CSV folder')
  check(await application.evaluate(() => globalThis.__qaCsvReadCount) === 0, 'listing projects must not read CSV files')

  const loaded = await page.evaluate(id => window.onAirApi.refresh(id), projectId)
  check(loaded.busy === false, 'refresh response should be idle after completion')
  const goodSnapshot = await verifyGoodSnapshot(page, projectId)
  const loadedReadCount = await application.evaluate(() => globalThis.__qaCsvReadCount)
  check(loadedReadCount === 4, 'first refresh should read each of the four configured CSV files exactly once')

  await page.locator('.portal-nav button').nth(1).click()
  await page.getByRole('heading', { name: /OnAir/ }).waitFor()
  const displayedCounts = await page.locator('.onair-counts').innerText()
  check(/^\s*9\b/m.test(displayedCounts) && /^\s*8\b/m.test(displayedCounts), `OnAir page should display the loaded title and person counts: ${displayedCounts}`)
  await page.locator('.portal-nav button').nth(0).click()
  await page.locator('.portal-nav button').nth(1).click()
  await page.locator('.onair-counts').waitFor()
  const afterRemount = await page.evaluate(id => window.onAirApi.getSnapshot(id), projectId)
  check(afterRemount.snapshot?.loadedAt === goodSnapshot.loadedAt, 'remounting the OnAir tab should reuse the in-memory snapshot')
  check(await application.evaluate(() => globalThis.__qaCsvReadCount) === 4, 'tab remount should not reread CSV files')

  await page.locator('.portal-nav button').nth(2).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  await page.locator('.mos-project-selector select').selectOption('qa-punctul-pe-azi')
  await page.getByRole('button', { name: /Mapări CSV OnAir|OnAir CSV mappings/ }).click()
  await page.getByLabel(/Grafic CSV detectat|Detected CSV graphic/).selectOption(JSON.stringify(['titles', '05_Titlu']))
  await page.getByRole('button', { name: /Adaugă maparea|Add mapping/ }).click()
  const graphicCard = page.locator('.onair-mapping-card').filter({ hasText: '05_Titlu' })
  await graphicCard.getByLabel(/Secțiune LiveBoard|LiveBoard section/).selectOption({ label: 'CSV graphics' })
  await graphicCard.getByRole('button', { name: /Adaugă mapare de câmp|Add field mapping/ }).click()
  await graphicCard.getByLabel(/Câmp CSV|CSV field/).selectOption('Titlu')
  await graphicCard.locator('textarea').nth(0).fill('TITLE_A')
  await graphicCard.locator('textarea').nth(0).press('End')
  await graphicCard.locator('textarea').nth(0).press('Enter')
  await graphicCard.locator('textarea').nth(0).type('TITLE_A_SECOND')
  await graphicCard.locator('textarea').nth(1).fill('TITLE_B')
  await page.getByLabel(/Grafic CSV detectat|Detected CSV graphic/).selectOption(JSON.stringify(['locations', 'PA_Location']))
  await page.getByRole('button', { name: /Adaugă maparea|Add mapping/ }).click()
  const locationCard = page.locator('.onair-mapping-card').filter({ hasText: 'PA_Location' })
  await locationCard.getByLabel(/Secțiune LiveBoard|LiveBoard section/).selectOption({ label: 'CSV location' })
  await locationCard.getByRole('button', { name: /Adaugă mapare de câmp|Add field mapping/ }).click()
  await locationCard.getByLabel(/Câmp CSV|CSV field/).selectOption('Locatie')
  await locationCard.locator('textarea').fill('LOCATION')
  await page.getByRole('button', { name: /Salvează setările|Save settings/ }).click()
  await page.locator('.mos-footer [role="status"]').waitFor()
  const saveStatus = await page.locator('.mos-footer [role="status"]').innerText()
  check(/Setările au fost salvate|Settings saved/.test(saveStatus), `OnAir mapping settings should save successfully: ${saveStatus}`)
  const persistedMapping = await page.evaluate(async () => {
    const config = await window.settingsApi.getMosProjects()
    return {
      pa: config.projects.find(project => project.id === 'qa-punctul-pe-azi')?.onAirMappings,
      console: config.projects.find(project => project.id === 'builtin-telejurnal')?.onAirMappings ?? [],
    }
  })
  check(persistedMapping.pa?.length === 2 && persistedMapping.pa.some(mapping => mapping.sourceTemplate === '05_Titlu') && persistedMapping.pa.some(mapping => mapping.kind === 'locations' && mapping.sourceTemplate === 'PA_Location'), 'saving OnAir graphic mappings should persist detected CSV templates to the selected project')
  check(persistedMapping.pa?.[0].fields[0].sourceField === 'Titlu' && persistedMapping.pa[0].fields[0].targetFields['qa-csv-a']?.[0] === 'TITLE_A' && persistedMapping.pa[0].fields[0].targetFields['qa-csv-a']?.[1] === 'TITLE_A_SECOND' && persistedMapping.pa[0].fields[0].targetFields['qa-csv-b']?.[0] === 'TITLE_B', 'OnAir field mappings should retain a multi-field destination and both LiveBoard targets')
  const persistedLocation = persistedMapping.pa?.find(mapping => mapping.kind === 'locations')
  check(persistedLocation?.fields[0].sourceField === 'Locatie' && persistedLocation.fields[0].targetFields['qa-location-target']?.[0] === 'LOCATION', 'prepared Locatie field should persist per project')
  check(persistedMapping.console.length === 0, 'saving the OnAir mapping must not change another project')
  await page.locator('.portal-nav button').nth(0).click()
  await page.locator('.portal-nav button').nth(2).click()
  await page.locator('.mos-project-selector select').selectOption('qa-punctul-pe-azi')
  await page.getByRole('button', { name: /Mapări CSV OnAir|OnAir CSV mappings/ }).click()
  const reopenedCard = page.locator('.onair-mapping-card').filter({ hasText: '05_Titlu' })
  check(await reopenedCard.count() === 1, 'reopening settings should display the saved CSV graphic mapping')
  check(await reopenedCard.locator('textarea').nth(0).inputValue() === 'TITLE_A\nTITLE_A_SECOND' && await reopenedCard.locator('textarea').nth(1).inputValue() === 'TITLE_B', 'reopened editor should restore destination field lists')
  const reopenedLocation = page.locator('.onair-mapping-card').filter({ hasText: 'PA_Location' })
  check(await reopenedLocation.count() === 1, 'reopening settings should restore the location mapping')
  const screenshotDir = path.join(root, 'node_modules', '.cache', 'onair-qa')
  mkdirSync(screenshotDir, { recursive: true })
  const serializedDom = await page.locator('.onair-mappings').evaluate(element => {
    element.querySelectorAll('input,textarea,select').forEach(control => {
      if (control instanceof HTMLInputElement) control.setAttribute('value', control.value)
      else if (control instanceof HTMLTextAreaElement) control.textContent = control.value
      else if (control instanceof HTMLSelectElement) control.querySelectorAll('option').forEach(option => {
        if (option.value === control.value) option.setAttribute('selected', '')
        else option.removeAttribute('selected')
      })
    })
    return element.outerHTML
  })
  const cssDir = path.join(root, 'dist', 'assets')
  const cssText = require('node:fs').readdirSync(cssDir).filter(file => file.endsWith('.css')).map(file => readFileSync(path.join(cssDir, file), 'utf8')).join('\n')
  const staticDom = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${cssText}</style><style>html,body{margin:0;padding:0;width:100%;background:#091321;color:#eaf0fa;font-family:Arial,sans-serif}body{overflow-x:hidden}.mos-settings,.onair-mappings{height:auto!important;max-height:none!important;overflow:visible!important}</style></head><body><section class="mos-settings">${serializedDom}</section></body></html>`
  const serializedPath = path.join(screenshotDir, 'settings-mappings-static.html')
  writeFileSync(serializedPath, staticDom, 'utf8')
  let previewBrowser = null
  try {
    previewBrowser = await chromium.launch({ headless: true, channel: 'msedge' })
    const previewPage = await previewBrowser.newPage({ viewport: { width: 1280, height: 900 } })
    await previewPage.goto(pathToFileURL(serializedPath).href, { waitUntil: 'domcontentloaded' })
    for (const width of [1280, 640]) {
      await previewPage.setViewportSize({ width, height: 900 })
      const layout = await previewPage.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
      check(layout.scrollWidth <= layout.innerWidth, `Serialized OnAir mapping settings should fit at ${width}px: ${JSON.stringify(layout)}`)
      await previewPage.screenshot({ path: path.join(screenshotDir, `settings-mappings-${width}.png`), fullPage: true, timeout: 10000 })
    }
  } catch (error) {
    console.warn(`QA NOTE: static Edge screenshots unavailable: ${error.message}`)
  } finally {
    await previewBrowser?.close().catch(() => undefined)
  }
  for (const width of [1280, 640]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }))
    check(layout.scrollWidth <= layout.innerWidth, `OnAir mapping settings should not overflow horizontally at ${width}px: ${JSON.stringify(layout)}`)
  }
  await page.locator('.portal-nav button').nth(1).click()
  await page.getByRole('heading', { name: /OnAir/ }).waitFor()
  const locationItem = page.locator('.onair-item').filter({ hasText: 'Studioul principal' })
  await locationItem.locator('.onair-mapping-preview summary').click()
  const locationPreview = await locationItem.locator('.onair-mapping-preview').innerText()
  check(locationPreview.includes('PA_Location') && locationPreview.includes('CSV location') && locationPreview.includes('LOCATION') && locationPreview.includes('Studioul principal'), 'OnAir preview should apply the fallback template and prepare the location field value')
  await page.locator('.portal-nav button').nth(2).click()
  await page.locator('.mos-project-selector select').selectOption('qa-punctul-pe-azi')
  await page.locator('.mos-project-selector select').selectOption('builtin-telejurnal')

  const sourceInput = page.getByLabel(/Folder CSV|CSV folder/)
  await sourceInput.fill('C:\\QA\\unsaved-onair-folder')
  await page.locator('.portal-nav button').nth(1).click()
  await page.getByRole('alertdialog').waitFor()
  await page.locator('.mos-dialog button').nth(0).click()
  check(await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).count() === 1, 'canceling an OnAir navigation prompt should keep Settings open')
  await page.locator('.mos-heading button').click()
  await page.getByRole('alertdialog').waitFor()
  await page.locator('.mos-dialog button').nth(1).click()
  check(await page.locator('.portal-nav button').nth(0).getAttribute('aria-current') === 'page', 'canceling the OnAir target then discarding via Settings Close should go to Console')
  const afterDiscard = await page.evaluate(() => window.settingsApi.getMosProjects())
  check(!afterDiscard.projects.find(project => project.id === 'builtin-telejurnal')?.onAirCsv, 'discarding the settings draft should not persist the typed CSV folder')
  await page.locator('.portal-nav button').nth(2).click()
  await page.getByRole('heading', { name: /Mapări MOS|MOS mappings/ }).waitFor()
  await page.getByLabel(/Folder CSV|CSV folder/).fill('C:\\QA\\discard-to-onair')
  await page.locator('.portal-nav button').nth(1).click()
  await page.getByRole('alertdialog').waitFor()
  await page.locator('.mos-dialog button').nth(1).click()
  await page.getByRole('heading', { name: /Date OnAir|OnAir data/ }).waitFor()
  check(await page.locator('.portal-nav button').nth(1).getAttribute('aria-current') === 'page', 'discarding an OnAir navigation prompt should navigate to OnAir')

  const titlesFile = path.join(csvFolder, 'PA_titles.csv')
  const goodTitles = readFileSync(titlesFile)
  writeFileSync(titlesFile, 'Wrong;Header\r\nvalue;value\r\n', 'utf8')
  const malformed = await page.evaluate(id => window.onAirApi.refresh(id), projectId)
  check(malformed.error?.code === 'INVALID_CSV' && malformed.error.file === 'PA_titles.csv', 'malformed CSV should identify the invalid file')
  check(malformed.busy === false && malformed.snapshot?.loadedAt === goodSnapshot.loadedAt, 'invalid refresh should retain the good snapshot and finish idle')
  writeFileSync(titlesFile, goodTitles)

  const phoneFile = path.join(csvFolder, 'PA_phones.csv')
  unlinkSync(phoneFile)
  const missing = await page.evaluate(id => window.onAirApi.refresh(id), projectId)
  check(missing.error?.code === 'READ_FAILED' && missing.error.file === 'PA_phones.csv', 'missing CSV should report its filename')
  check(missing.snapshot?.loadedAt === goodSnapshot.loadedAt && missing.busy === false, 'missing-file refresh should retain the good snapshot and finish idle')
  writeFileSync(phoneFile, 'Nume;Functie;Image\r\nAna Ionescu;Prezentatoare;images/ana.png\r\n', 'utf8')

  mkdirSync(changedFolder, { recursive: true })
  const saveResult = await page.evaluate(async ({ id, folderPath }) => {
    const current = await window.settingsApi.getMosProjects()
    const value = { ...current, projects: current.projects.map(project => project.id === id ? { ...project, onAirCsv: { format: 'pa-csv', folderPath } } : project) }
    return window.settingsApi.trySaveMosProjects(value)
  }, { id: projectId, folderPath: changedFolder })
  check(saveResult.ok === true, 'saving a new OnAir source folder should succeed')
  const changed = await page.evaluate(id => window.onAirApi.getSnapshot(id), projectId)
  check(changed.folderPath === changedFolder && changed.snapshot === null && changed.error?.code === 'SOURCE_CHANGED', 'changing the saved folder should invalidate the prior snapshot')
  check((await page.evaluate(() => window.liveBoardApi.getSnapshot())).activeProject.id === 'builtin-telejurnal', 'source folder change must leave the console active project unchanged')

  await application.evaluate(async ({ app }) => app.exit(0))
  await application.close()
  application = null

  receiverPort = await freePort()
  application = await launchIsolated(userData, receiverPort, csvFolder)
  page = await firstPage(application)
  const restarted = await page.evaluate(async id => ({
    state: await window.onAirApi.getSnapshot(id),
    projects: await window.onAirApi.listProjects(),
  }), projectId)
  check(restarted.state.snapshot === null && restarted.state.busy === false, 'app restart should not restore the in-memory CSV snapshot')
  check(restarted.projects.find(project => project.id === projectId)?.folderPath === changedFolder, 'app restart should preserve the saved project folder path')
  check(await application.evaluate(() => globalThis.__qaCsvReadCount) === 0, 'app startup after restart must not read CSV files automatically')
  check(!/Error occurred in handler for ['"]?settings:set/i.test(appStderr), 'OnAir settings operations should not escape through Electron handler errors')

  console.log(`QA PASS: ${checks} isolated OnAir Electron checks; real main/preload API, fictional PA CSV fixtures, snapshot retention/invalidation, renderer remount, and restart persistence. No credentials printed; operator userData and LiveBoard hardware were not used.`)
}

const task = process.argv.includes('--capture-only') ? captureExistingSettingsPreview() : run()
task.catch(error => {
  console.error(`QA FAIL: ${error instanceof Error ? error.message : String(error)}`)
  if (error instanceof Error && error.stack) console.error(error.stack)
  process.exitCode = 1
}).finally(async () => {
  if (application) {
    await application.evaluate(({ app }) => app.exit(0)).catch(() => undefined)
    await application.close().catch(() => undefined)
  }
  const resolvedTemp = path.resolve(tempDir)
  if (path.dirname(resolvedTemp) !== path.resolve(os.tmpdir()) || !path.basename(resolvedTemp).startsWith('lbportal-onair-qa-')) {
    throw new Error('Refusing cleanup because the resolved QA temporary directory is outside the expected temp root.')
  }
  rmSync(resolvedTemp, { recursive: true, force: true })
})
