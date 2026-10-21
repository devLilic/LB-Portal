/* Isolated Electron QA for the OnAir CSV IPC and renderer flow.
 * Uses fictional PA CSV fixtures and a disposable userData directory. It never
 * reads or writes operator settings and never connects to LiveBoard hardware.
 */
const { _electron } = require('playwright')
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
  const locations = 'Locatie\r\nStudioul principal\r\n'
  const phones = 'Nume;Functie;Image\r\nAna Ionescu;Prezentatoare;images/ana.png\r\n'
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
  return {
    version: 2,
    activeProjectId: 'builtin-telejurnal',
    projects: [
      { id: 'builtin-telejurnal', name: 'Telejurnal', kind: 'telejurnal', mappings: { version: 1, sections: [] } },
      { id: 'builtin-retrospectiva', name: 'Retrospectiva săptămânii', kind: 'retrospectiva', mappings: { version: 1, sections: [] } },
      { id: 'qa-punctul-pe-azi', name: 'Punctul pe Azi', kind: 'standalone', mappings: { version: 1, sections: [] }, onAirCsv: { format: 'pa-csv', folderPath: csvFolder } },
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
  const sourceInput = page.locator('.mos-onair-csv input')
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
  await page.locator('.mos-onair-csv input').fill('C:\\QA\\discard-to-onair')
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

run().catch(error => {
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
