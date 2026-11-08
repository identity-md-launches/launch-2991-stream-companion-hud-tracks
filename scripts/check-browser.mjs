import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Optional validation tools are installed separately; no production dependency.
// node scripts/check-browser.mjs --playwright /path/to/playwright/index.mjs --axe /path/to/axe.min.js
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const playwright = await import(pathToFileURL(resolve(option('--playwright', 'test/scratch/tools/node_modules/playwright/index.mjs'))));
const axePath = resolve(option('--axe', 'test/scratch/tools/node_modules/axe-core/axe.min.js'));
const out = resolve(option('--out', 'test/scratch/browser-results'));
await mkdir(out, { recursive: true });
const root = resolve('dist');
const prefix = '/preview/squeekside/';
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname;
  if (!path.startsWith(prefix)) return res.writeHead(404).end();
  const file = resolve(root, decodeURIComponent(path.slice(prefix.length)) || 'index.html');
  if (!file.startsWith(root + '/')) return res.writeHead(403).end();
  try { res.setHeader('content-type', mime[extname(file)] ?? 'text/plain'); res.end(await readFile(file)); }
  catch { res.writeHead(404).end(); }
});
const report = { checkedAt: new Date().toISOString(), source: 'Actual dist/ served under a subpath. External network responses are controlled test fixtures, never shipped runtime data.', checks: [], screenshots: [], limitations: [] };
let browser;
try {
  await new Promise((done, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', done); });
  const url = `http://127.0.0.1:${server.address().port}${prefix}`;
  browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const scriptErrors = [], localFailures = [], consoleErrors = [];
  page.on('pageerror', (error) => scriptErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('response', (response) => { if (response.url().startsWith(url) && response.status() >= 400) localFailures.push(response.url().replace(url, './')); });
  page.on('requestfailed', (request) => { if (request.url().startsWith(url)) localFailures.push(request.url().replace(url, './')); });
  let feed = 'fresh';
  const requests = { rpc: 0, api: 0 };
  await page.route('https://**/*', async (route) => {
    const request = route.request();
    if (request.url().includes('squeekchain.com')) {
      requests.api++;
      if (feed === 'failure') return route.fulfill({ status: 503, contentType: 'application/json', body: '{}' });
      const date = new Date(Date.now() - (feed === 'stale' ? 300_000 : 0)).toISOString();
      const data = request.url().endsWith('/v1/core') ? {
        schemaVersion: 1, status: 'available', chain: { chainId: '11155111' }, identities: { core: '0x74665daeca35a2303e767e76a2ff1fb6f93e119f' },
      } : { schemaVersion: 1, generatedAt: date,
        measurement: { freshness: 'online', observedAt: date, receivedAt: date, staleAfterSeconds: 120, cumulativeWorkUnits: '150000', coreStatus: 'ACTIVE', rpmMilli: 65000, speedMmPerSecond: 1127, distanceMm: 3455808 },
        builder: { status: 'available', projected: { blockHeight: '13100', blockProgress: '500000000', cumulativeBlockUnits: '13100500000000' }, queued: { openRoundWorkUnits: '308' } },
      };
      return route.fulfill({ json: data });
    }
    requests.rpc++;
    const rpc = request.postDataJSON();
    if (rpc.method === 'eth_chainId') return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: '0xaa36a7' } });
    if (rpc.method === 'eth_getBlockByNumber') {
      const n = rpc.params[0] === 'latest' ? 5000 : parseInt(rpc.params[0], 16);
      return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, result: {
        number: `0x${n.toString(16)}`, hash: `0x${n.toString(16).padStart(64, '0')}`, parentHash: `0x${(n - 1).toString(16).padStart(64, '0')}`,
        timestamp: `0x${(Math.floor(Date.now() / 1000) - (5000 - n) * 12).toString(16)}`, transactions: [], gasUsed: '0x100', gasLimit: '0x1000',
      } } });
    }
    return route.fulfill({ json: { jsonrpc: '2.0', id: rpc.id, error: { code: -32000, message: 'Controlled contract-unavailable response' } } });
  });
  const check = async (name, action) => {
    try { await action(); }
    catch (error) { throw new Error(`${name}: ${error.message}`); }
    report.checks.push({ name, passed: true }); console.log(`PASS ${name}`);
  };
  async function shot(name) {
    await page.screenshot({ path: resolve(out, name), fullPage: false, scale: 'css' });
    report.screenshots.push(name);
  }
  async function audit(name) {
    await page.addScriptTag({ path: axePath });
    const result = await page.evaluate(async () => {
      const scan = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] } });
      return scan.violations.map(({ id, impact, nodes }) => ({ id, impact, elements: nodes.map(n => n.target) }));
    });
    report.checks.push({ name: `axe: ${name}`, passed: result.length === 0, violations: result });
    assert.deepEqual(result, [], `Accessibility violations in ${name}`);
  }
  async function noOverflow() {
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, dialogs: [...document.querySelectorAll('dialog[open]')].map(d => ({ client: d.clientWidth, scroll: d.scrollWidth })), offenders: [...document.querySelectorAll('body *')].filter(e => e.checkVisibility() && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(-10).map(e => ({ tag: e.tagName, class: e.className, text: e.textContent.slice(0, 70), right: e.getBoundingClientRect().right })) }));
    assert.ok(dimensions.scroll <= dimensions.viewport + 1, JSON.stringify(dimensions));
    for (const d of dimensions.dialogs) assert.ok(d.scroll <= d.client + 1, JSON.stringify(d));
  }
  await page.goto(url);
  await page.getByText('Wheel is turning', { exact: true }).waitFor();
  await check('390 first screen contains the product, stream action, and prediction action', async () => {
    report.firstScreen390 = [];
    for (const locator of [page.getByRole('heading', { level: 1 }), page.getByRole('link', { name: 'Open stream view' }), page.getByRole('button', { name: 'Viewer predictions' }), page.locator('.wheel-art')]) {
      const r = await locator.boundingBox(); assert.ok(r && r.y >= 0 && r.y + r.height <= 844, JSON.stringify(r));
      report.firstScreen390.push({ label: (await locator.textContent()).trim() || 'Wheel illustration', box: r });
    }
    await shot('mobile-390.png'); await noOverflow();
  });
  await audit('monitor dark');
  await check('pause, one-shot refresh while paused, resume and activity switching', async () => {
    await page.getByRole('button', { name: 'Pause live updates' }).click();
    assert.equal(await page.getByRole('button', { name: 'Resume live updates' }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.wheel-art.is-spinning').count(), 0);
    const count = requests.api;
    await page.getByRole('button', { name: 'Refresh data sources' }).click();
    await page.waitForFunction(() => !document.querySelector('.refresh-control').disabled);
    assert.ok(requests.api > count);
    await page.getByRole('button', { name: 'Resume live updates' }).click();
    await page.getByText('Wheel is turning', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Settled rounds', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Settled rounds', exact: true }).getAttribute('aria-pressed'), 'true');
    await page.getByRole('button', { name: 'Sepolia blocks', exact: true }).click();
    assert.equal(await page.locator('.activity-table tbody tr').count(), 6);
  });
  await check('native guide modal: all topics, focus trap, Escape and focus return', async () => {
    const trigger = page.getByRole('button', { name: 'HUD guide', exact: true });
    await trigger.focus(); await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'HUD guide', exact: true });
    await dialog.waitFor();
    for (const name of ['Stream setup', 'Predictions', 'Monitor']) await dialog.getByRole('button', { name, exact: true }).click();
    for (let i = 0; i < 8; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('dialog[open]') !== null)); }
    await shot('keyboard-guide.png');
    await audit('guide'); await page.keyboard.press('Escape');
    assert.equal(await trigger.evaluate(e => e === document.activeElement), true);
  });
  await check('all six theme palettes, persistent selections, system mode and reduced motion', async () => {
    await page.getByRole('button', { name: 'Customize appearance' }).click();
    const dialog = page.getByRole('dialog', { name: 'Customize the HUD' });
    for (const mode of ['Dark', 'Light']) {
      await dialog.getByRole('button', { name: mode, exact: true }).click();
      for (const accent of ['Mint', 'Violet', 'Amber']) {
        await dialog.getByRole('button', { name: accent, exact: true }).click();
        assert.equal(await page.locator('html').getAttribute('data-accent'), accent.toLowerCase());
        await audit(`${mode} ${accent} appearance`);
        await dialog.getByRole('button', { name: 'Done', exact: true }).click();
        await audit(`${mode} ${accent} monitor`);
        await page.getByRole('button', { name: 'Customize appearance' }).click();
      }
    }
    await dialog.getByRole('button', { name: 'Violet', exact: true }).click();
    await shot('appearance-light.png');
    await dialog.getByLabel('Reduce motion').check();
    await dialog.getByRole('button', { name: 'Done', exact: true }).click();
    assert.equal(await page.locator('.wheel-spokes').evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    assert.equal(await page.locator('html').getAttribute('data-accent'), 'violet');
    await page.getByRole('button', { name: 'Customize appearance' }).click();
    await page.getByRole('button', { name: 'System', exact: true }).click();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
    await page.getByRole('button', { name: 'Restore appearance' }).click();
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.wheel-spokes').evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
  });
  await check('poll validation, editable vote, reload, manual close, outcome and JSON download', async () => {
    await page.getByRole('button', { name: 'Viewer predictions' }).click();
    await page.getByRole('button', { name: 'Open poll', exact: true }).click();
    assert.equal(await page.locator('#poll-question').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#poll-question').evaluate(e => e === document.activeElement), true);
    await page.getByLabel('Question', { exact: true }).fill('Will the wheel finish a block this round?');
    await page.getByLabel('Second choice', { exact: true }).fill('YES');
    await page.getByRole('button', { name: 'Open poll', exact: true }).click();
    assert.equal(await page.locator('#poll-second').getAttribute('aria-invalid'), 'true');
    await page.getByLabel('Second choice', { exact: true }).fill('Not yet');
    await page.getByRole('button', { name: 'Open poll', exact: true }).click();
    await page.getByRole('button', { name: 'Save prediction', exact: true }).click();
    await page.getByText('Choose an answer before saving your prediction.').waitFor();
    await page.getByRole('radio', { name: 'Yes', exact: true }).check();
    await page.getByRole('button', { name: 'Save prediction', exact: true }).click();
    await page.getByRole('radio', { name: 'Not yet', exact: true }).check();
    await page.getByRole('button', { name: 'Update prediction', exact: true }).click();
    await audit('poll voting'); await shot('poll-vote.png');
    await page.reload(); await page.getByRole('button', { name: 'Viewer predictions' }).click();
    assert.equal(await page.getByRole('radio', { name: 'Not yet Saved', exact: true }).isChecked(), true);
    await page.getByRole('button', { name: 'Close voting', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: 'Update prediction', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Confirm outcome', exact: true }).click();
    await page.getByText('Choose the outcome before confirming it.').waitFor();
    await page.getByRole('radio', { name: 'Not yet', exact: true }).check();
    await page.getByRole('button', { name: 'Confirm outcome', exact: true }).click();
    await page.getByText('Your prediction matched the outcome.').waitFor();
    await audit('poll result'); await shot('poll-result.png');
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download record' }).click();
    const downloaded = await downloading;
    const content = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
    assert.equal(content.poll.vote, 1); assert.equal(content.poll.outcome, 1); assert.equal(content.poll.status, 'resolved');
    assert.ok(content.scope.includes('This browser only'));
    await page.getByRole('button', { name: 'Start another poll' }).click();
    await page.getByRole('button', { name: 'Keep this poll' }).click();
    await page.getByText('Your prediction matched the outcome.').waitFor();
    await page.getByRole('button', { name: 'Start another poll' }).click();
    await page.getByRole('button', { name: 'Replace poll', exact: true }).click();
    await page.getByLabel('Question', { exact: true }).fill('Will the next round settle on time?');
    await page.getByLabel('Voting window').selectOption('1');
    await page.getByRole('button', { name: 'Open poll', exact: true }).click();
    await page.clock.install(); await page.clock.fastForward(61_000);
    await page.getByText('Voting closed', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Save prediction', exact: true }).count(), 0);
    await page.clock.resume();
    await page.keyboard.press('Escape');
  });
  await check('stream route, real clipboard, fullscreen and transparent root canvas', async () => {
    await page.getByRole('link', { name: 'Open stream view' }).click();
    await page.getByRole('button', { name: 'Copy stream URL' }).waitFor();
    assert.equal(await page.locator('.activity-section').count(), 0);
    await page.getByRole('link', { name: 'Skip to monitor' }).focus();
    await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash, '#stream');
    assert.equal(await page.locator('#main').evaluate(e => e === document.activeElement), true);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.getByRole('button', { name: 'Copy stream URL' }).click();
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), url + '#stream');
    await page.getByRole('button', { name: 'Toggle fullscreen' }).click();
    await page.waitForFunction(() => Boolean(document.fullscreenElement));
    await page.getByRole('button', { name: 'Toggle fullscreen' }).click();
    await page.waitForFunction(() => !document.fullscreenElement);
    await page.getByLabel('Transparent page background', { exact: true }).check();
    assert.equal(await page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
    await page.reload();
    assert.equal(await page.getByLabel('Transparent page background', { exact: true }).isChecked(), true);
    await page.getByRole('link', { name: 'Exit stream view' }).click();
    assert.notEqual(await page.locator('html').evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)');
  });
  await check('data settings validation, saved interval and defaults', async () => {
    await page.getByRole('button', { name: 'Open data settings' }).click();
    await page.getByLabel('Sepolia RPC URL').fill('http://invalid.example');
    await page.getByRole('button', { name: 'Save settings' }).click();
    assert.equal(await page.locator('#rpc').getAttribute('aria-invalid'), 'true');
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByLabel('Refresh interval').selectOption('30');
    await page.getByRole('button', { name: 'Save settings' }).click();
    await page.reload(); await page.getByRole('button', { name: 'Open data settings' }).click();
    assert.equal(await page.getByLabel('Refresh interval').inputValue(), '30');
    await audit('data settings');
    await page.getByRole('button', { name: 'Restore defaults' }).click();
    await page.getByRole('button', { name: 'Save settings' }).click();
  });
  await check('stale telemetry, source failure and retry recover without fabricated values', async () => {
    feed = 'stale'; await page.reload(); await page.getByText('Wheel feed stale', { exact: true }).waitFor();
    assert.equal(await page.locator('.wheel-art.is-spinning').count(), 0);
    feed = 'failure'; await page.reload(); await page.getByText('Wheel feed unavailable', { exact: true }).waitFor();
    feed = 'fresh'; await page.getByRole('button', { name: 'Refresh data sources' }).click();
    await page.getByText('Wheel is turning', { exact: true }).waitFor();
  });
  await check('320, 390, 768, 1000, 1440 layouts and modal reflow', async () => {
    for (const width of [320, 390, 768, 1000, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await noOverflow();
      await page.getByRole('button', { name: 'Customize appearance' }).click(); await noOverflow(); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'HUD guide', exact: true }).click(); await noOverflow(); await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Viewer predictions' }).click(); await noOverflow(); await page.keyboard.press('Escape');
    }
    await page.evaluate(() => window.scrollTo(0, 0)); await shot('desktop-1440.png');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => document.documentElement.style.fontSize = '32px');
    await noOverflow();
    await page.getByRole('button', { name: 'Viewer predictions' }).click(); await noOverflow(); await page.keyboard.press('Escape');
    await page.evaluate(() => document.documentElement.style.fontSize = '');
  });
  await check('blocked storage still permits themes and polls with truthful warning', async () => {
    const deniedContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const denied = await deniedContext.newPage();
    await denied.route('https://**/*', route => route.abort());
    await denied.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('Storage blocked', 'SecurityError'); }; });
    await denied.goto(url);
    await denied.getByRole('button', { name: 'Customize appearance' }).click();
    await denied.getByRole('button', { name: 'Light', exact: true }).click();
    await denied.getByText('Storage unavailable. Appearance applies for this visit only.').waitFor();
    await denied.keyboard.press('Escape');
    await denied.getByRole('button', { name: 'Viewer predictions' }).click();
    await denied.getByLabel('Question', { exact: true }).fill('Will the next block settle this round?');
    await denied.getByRole('button', { name: 'Open poll', exact: true }).click();
    await denied.getByRole('radio', { name: 'Yes', exact: true }).check();
    await denied.getByRole('button', { name: 'Save prediction', exact: true }).click();
    assert.equal(await denied.getByRole('radio', { name: 'Yes Saved', exact: true }).isChecked(), true);
    await denied.getByText('Storage unavailable. Download the record before leaving; this poll only lasts for this visit.').waitFor();
    await deniedContext.close();
  });
  await check('local fonts loaded; no application script errors or failed local resources', async () => {
    assert.deepEqual(scriptErrors, []); assert.deepEqual(localFailures, []);
    assert.deepEqual(consoleErrors.filter(message => !message.includes('Failed to load resource')), []);
    report.expectedSourceConsoleErrors = consoleErrors.length;
    report.fonts = await page.evaluate(() => [...document.fonts].map(f => ({ family: f.family, status: f.status })));
    assert.ok(report.fonts.every(f => f.status === 'loaded'));
  });
  await context.close();
  try {
    const safari = await playwright.webkit.launch({ headless: true });
    const tab = await safari.newPage({ viewport: { width: 390, height: 844 } });
    await tab.route('https://**/*', route => route.abort());
    await tab.goto(url);
    await tab.getByRole('link', { name: 'Open stream view' }).click();
    await tab.getByRole('button', { name: 'Copy stream URL' }).waitFor();
    report.checks.push({ name: 'WebKit stream navigation', passed: true });
    await safari.close();
  } catch (error) {
    report.limitations.push('WebKit could not launch: required system libraries are unavailable. No Safari or physical-device claim.');
    console.log('LIMITATION WebKit could not launch.');
  }
  report.passed = report.checks.every(c => c.passed);
} catch (error) {
  report.passed = false; report.failure = error.message;
  const failedPage = browser?.contexts()[0]?.pages()[0];
  if (failedPage) {
    await failedPage.screenshot({ path: resolve(out, 'failure.png') }).catch(() => {});
    await writeFile(resolve(out, 'failure.txt'), await failedPage.locator('body').innerText().catch(() => 'Page closed'));
  }
  process.exitCode = 1; console.error(error.message);
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
  await writeFile(resolve(out, 'results.json'), JSON.stringify(report, null, 2) + '\n');
}
