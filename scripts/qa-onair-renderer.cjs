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
    }],
    persons: [{
      id: `${project.id}-person`,
      source: { file: 'Persons.csv', record: 2, line: 3 },
      name: 'Nume invitat cu text lung pentru verificarea împachetării',
      role: 'Analist invitat',
      template: '05_Titlu_Ultima_Ora',
    }],
    locations: [{ id: `${project.id}-location`, source: { file: 'Locations.csv', record: 2, line: 3 }, location: 'Chișinău\nRepublica Moldova' }],
    phones: [{ id: `${project.id}-phone`, source: { file: 'Phones.csv', record: 2, line: 3 }, name: 'Intervenție telefonică', role: 'Reporter', imagePath: 'C:\\assets\\phone\\reporter image.png' }],
  }],
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
  await page.addInitScript(({ first, second, firstSnapshot, secondSnapshot }) => {
    const config = {
      environment: 'development', appName: 'LB-Portal',
      features: { i18n: true, autoUpdate: false, appProtection: false, licensing: false, database: false, logging: true },
      i18n: { enabled: true, defaultLanguage: 'en', supportedLanguages: ['en', 'ro', 'ru'], namespaces: ['common', 'settings', 'updater', 'errors', 'onair'] },
    }
    window.appApi = { getConfig: () => config }
    window.i18nApi = { getCurrentLanguage: async () => ({ language: 'en' }) }
    window.lbPortalApi = {
      getInfo: async () => ({ status: 'online', urls: [], accessKey: 'qa-key' }),
      getRequests: async () => [],
      onRequestReceived: () => () => {},
      onRequestUpdated: () => () => {},
      clearRequests: async () => undefined,
    }
    window.liveBoardApi = {
      onSnapshot: () => () => {},
      getSnapshot: async () => ({
        activeProject: { id: first.id, name: first.name, kind: first.kind },
        projects: [first, second], connection: { mode: 'simulation', status: 'simulated' },
        sections: [], operations: [],
      }),
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
          ? { projectId: id, folderPath: second.folderPath, snapshot: null, error: { code: 'SOURCE_CHANGED' }, busy: false }
          : { projectId: id, folderPath: second.folderPath, snapshot: null, error: { code: 'INVALID_CSV', file: 'Titles.csv', record: 3, detail: 'Quoted header is missing' }, busy: false }
      },
    }
    window.__firstSnapshot = firstSnapshot
    window.__secondSnapshot = secondSnapshot
    window.liveBoardApi.setActiveProject = async () => { window.__onAirCalls.activeProjectChanges++; throw new Error('OnAir must not activate a LiveBoard project') }
  }, {
    first: projectOne,
    second: projectTwo,
    firstSnapshot: snapshot(projectOne, 'Telejurnal only data', '2026-10-21T11:00:00.000Z'),
    secondSnapshot: snapshot(projectTwo, 'Invitați și subiecte de actualitate', '2026-10-21T12:00:00.000Z'),
  })
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'OnAir', exact: true }).click()
  const selector = page.getByRole('combobox', { name: 'Project' })
  await selector.waitFor({ state: 'visible' })
  await selector.selectOption(projectTwo.id)
  await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).waitFor()
  await page.evaluate(() => window.__releaseFirstSnapshot?.())
  await page.waitForTimeout(150)
  assert.equal(await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).count(), 1)
  assert.equal(await page.getByText('Telejurnal only data', { exact: true }).count(), 0)
  await page.getByText('2 titles', { exact: true }).waitFor()
  const counts = await page.evaluate(() => ({ ...window.__onAirCalls }))
  assert.ok(counts.listProjects >= 1, 'OnAir should request the saved project list when it opens')
  assert.equal(counts.refresh, 0, 'opening OnAir must not refresh the CSV export')
  assert.ok(counts.snapshots.includes(projectOne.id) && counts.snapshots.includes(projectTwo.id), 'switching projects should load each memory snapshot')
  assert.equal(counts.activeProjectChanges, 0, 'OnAir selection must not activate a LiveBoard project')

  for (const width of [640, 1280, 1920]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({ path: path.join(outputDir, `onair-${width}.png`), fullPage: true })
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
    assert.ok(dimensions.document <= dimensions.viewport, `horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`)
  }
  await page.evaluate(() => { window.__busyResponsesRemaining = 3 })
  await page.getByRole('button', { name: 'Console', exact: true }).click()
  await page.getByRole('button', { name: 'OnAir', exact: true }).click()
  await page.locator('.onair-group-heading h3').getByText('Invitați și subiecte de actualitate', { exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('.onair-refresh')?.disabled)
  assert.ok((await page.evaluate(() => window.__onAirCalls.snapshots.filter(id => id === 'qa-two').length)) >= 5, 'busy snapshots must be polled until the read becomes idle')
  assert.equal((await page.evaluate(() => window.__onAirCalls.refresh)), 0, 'polling a busy snapshot must not trigger a CSV refresh')
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
