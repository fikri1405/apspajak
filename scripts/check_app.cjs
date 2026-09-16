// End-to-end checks use a disposable browser profile and an isolated loopback server.
const { chromium } = require('C:/Users/Digitalisasi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../app');
const original = JSON.parse(fs.readFileSync(path.join(root, 'data/pajak.json'), 'utf8'));
let served = original;
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/data/pajak.json') {
    response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    response.end(JSON.stringify(served)); return;
  }
  const filename = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
  if (!filename.startsWith(root + path.sep)) { response.writeHead(403); response.end(); return; }
  try {
    const body = fs.readFileSync(filename);
    const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }[path.extname(filename)] || 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' }); response.end(body);
  } catch { response.writeHead(404); response.end(); }
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByText('✓ Data siap digunakan offline', { exact: true }).waitFor({ timeout: 30000 });
    assert.equal(await page.locator('#result-count').textContent(), '428 objek');
    assert.equal(await page.locator('.record').count(), 30);
    await page.locator('#more').click(); assert.equal(await page.locator('.record').count(), 60);
    await page.locator('#dusun').selectOption('I'); assert.equal(await page.locator('#result-count').textContent(), '40 objek');
    const row = original.records.find(item => item.dusun === 'V');
    await page.locator('#search').fill(row.nop.replace(/\D/g, ''));
    assert.equal(await page.locator('.record').count(), 1);
    assert.equal(await page.locator('.result-group').textContent(), 'Ditemukan di dusun lain');
    await page.locator('.record').click(); await page.locator('#detail-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#detail-name').textContent(), row.name);
    assert.equal(await page.locator('#detail-dusun').textContent(), 'Dusun V');
    await page.screenshot({ path: 'outputs/app-detail.png', fullPage: true });
    await page.locator('#back').click();
    assert.equal(await page.locator('#search').inputValue(), row.nop.replace(/\D/g, ''));
    await page.locator('#clear-search').click(); await page.locator('#dusun').selectOption('unknown');
    assert.equal(await page.locator('#result-count').textContent(), '3 objek');
    await page.reload(); await page.locator('#list-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#dusun').inputValue(), 'unknown');
    await page.locator('#search').fill('zzzzzzzzz'); assert.equal(await page.locator('#empty').isVisible(), true);
    await page.locator('#show-all').click(); assert.equal(await page.locator('#result-count').textContent(), '428 objek');
    await context.setOffline(true); await page.reload();
    await page.locator('#list-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#result-count').textContent(), '428 objek');
    await page.locator('#search').fill(row.nop); await page.locator('.record').click(); await page.locator('#detail-view').waitFor({ state: 'visible' });
    await page.reload(); await page.locator('#detail-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#detail-name').textContent(), row.name);
    await page.locator('#back').click(); await page.locator('#refresh').click();
    await page.getByText('Pembaruan gagal.', { exact: false }).waitFor();
    await context.setOffline(false);
    served = { ...original, records: [] };
    await page.locator('#refresh').click(); await page.getByText('Pembaruan gagal.', { exact: false }).waitFor();
    assert.equal(await page.locator('#result-count').textContent(), '428 objek');
    served = JSON.parse(JSON.stringify(original)); served.version += '-test'; served.records.find(item => item.id === row.id).amount += 1;
    await page.locator('#refresh').click(); await page.getByText('Daftar terbaru berhasil disimpan', { exact: false }).waitFor();
    await context.setOffline(true); await page.reload(); await page.locator('#list-view').waitFor({ state: 'visible' });
    await page.locator('#search').fill(row.nop); await page.locator('.record').click(); await page.locator('#detail-view').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#detail-amount').textContent(), 'Rp' + (row.amount + 1).toLocaleString('id-ID'));
    await page.locator('#back').click(); await page.locator('#clear-search').click(); await page.locator('#dusun').selectOption('III');
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, 'Horizontal overflow at ' + width);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'outputs/app-list.png' });
    assert.deepEqual(errors, []);
    console.log('PASS: 428 records, pagination, cross-dusun NOP search, source details, filter persistence, unknown dusun, empty state, true offline reload and deep link, failed/invalid update preservation, successful update survives offline reload, responsive widths, no JS errors.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
