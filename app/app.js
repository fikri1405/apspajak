'use strict';
const $ = id => document.getElementById(id);
const number = new Intl.NumberFormat('id-ID');
const rupiah = value => 'Rp' + number.format(value);
const normalize = value => value.toLocaleLowerCase('id-ID').replace(/[^a-z0-9]/g, '');
const dusunLabel = value => value === 'unknown' ? 'Belum ditentukan' : 'Dusun ' + value;
const date = value => new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
let dataset, registration, offlineReady = false, installPrompt, shown = 30, selectedId, listScroll = 0, previousFocusId;

function notice(message = '') { $('notice').textContent = message; $('notice').hidden = !message; }
function storageGet(key) { try { return localStorage.getItem(key); } catch { return null; } }
function storageSet(key, value) { try { localStorage.setItem(key, value); } catch { /* Browsing still works. */ } }
function connectionState() {
  $('connection').textContent = navigator.onLine ? 'Online' : 'Tanpa internet';
  $('offline-state').textContent = offlineReady ? '✓ Data siap digunakan offline' : 'Data offline belum siap';
}
function workerMessage(type, extra = {}) {
  return new Promise((resolve, reject) => {
    if (!registration?.active) return reject(new Error('Penyimpanan offline belum tersedia.'));
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('Penyimpanan belum merespons.')); }, 12000);
    channel.port1.onmessage = event => {
      clearTimeout(timer); channel.port1.close();
      if (event.data.ok) resolve(event.data); else reject(new Error(event.data.error));
    };
    registration.active.postMessage({ type, ...extra }, [channel.port2]);
  });
}
async function networkData() {
  const response = await fetch('./data/pajak.json?refresh=' + Date.now(), { cache: 'no-store', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error('Server belum menyediakan daftar terbaru.');
  return PajakData.validate(await response.json());
}
function element(tag, className, text) {
  const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el;
}
function card(row) {
  const button = element('button', 'record'); button.type = 'button'; button.dataset.id = row.id;
  button.setAttribute('aria-label', row.name + ', ' + dusunLabel(row.dusun) + ', NOP ' + row.nop + ', lihat detail');
  const top = element('span', 'record-top'); top.append(element('span', 'record-name', row.name), element('span', 'tag', dusunLabel(row.dusun)));
  const bottom = element('span', 'record-bottom'); bottom.append(element('span', 'money', rupiah(row.amount)), element('span', 'record-open', 'Lihat detail →'));
  button.append(top, element('span', 'record-address', row.address), element('div', 'record-nop', 'NOP ' + row.nop + ' · ' + row.year), bottom);
  button.addEventListener('click', () => { listScroll = window.scrollY; previousFocusId = row.id; location.hash = 'objek=' + encodeURIComponent(row.id); });
  return button;
}
function renderList() {
  if (!dataset) return;
  const term = normalize($('search').value), selected = $('dusun').value;
  const matches = dataset.records.filter(row => term ? [row.name, row.nop, row.address].some(value => normalize(value).includes(term)) : selected === 'all' || row.dusun === selected);
  if (term && selected !== 'all') matches.sort((a, b) => Number(b.dusun === selected) - Number(a.dusun === selected));
  $('clear-search').hidden = !$('search').value;
  $('results-title').textContent = term ? 'Hasil semua dusun' : selected === 'all' ? 'Semua objek pajak' : selected === 'unknown' ? 'Dusun belum ditentukan' : 'Objek di ' + dusunLabel(selected);
  $('result-count').textContent = number.format(matches.length) + ' objek';
  const list = $('results'); list.replaceChildren(); let previousGroup;
  matches.slice(0, shown).forEach(row => {
    if (term && selected !== 'all') {
      const group = row.dusun === selected ? dusunLabel(selected) + ' · pilihan saat ini' : 'Ditemukan di dusun lain';
      if (group !== previousGroup) { list.append(element('h3', 'result-group', group)); previousGroup = group; }
    }
    list.append(card(row));
  });
  $('empty').hidden = matches.length !== 0;
  $('more').hidden = shown >= matches.length;
  $('more').textContent = 'Tampilkan berikutnya (' + Math.min(shown, matches.length) + '/' + matches.length + ')';
}
function renderMetadata() {
  $('data-summary').textContent = number.format(dataset.count) + ' objek · tahun ' + [...new Set(dataset.records.map(row => row.year))].join(', ');
  $('data-date').textContent = 'Diimpor: ' + date(dataset.importedAt) + '. ' + (dataset.sourceDate ? 'Status sumber per ' + date(dataset.sourceDate) + '.' : 'Tanggal status resmi belum dicantumkan pada sumber.');
  $('source-scope').textContent = 'Cakupan: ' + dataset.sourceLabel + '. Daftar ini tidak mencakup seluruh objek pajak desa.';
}
function showRoute() {
  if (!dataset) return;
  let key;
  try { key = location.hash.startsWith('#objek=') ? decodeURIComponent(location.hash.slice(7)) : null; } catch { key = null; }
  const row = dataset.records.find(item => item.id === key);
  if (!row) {
    const wasDetail = !$('detail-view').hidden;
    $('detail-view').hidden = true; $('list-view').hidden = false; selectedId = null;
    if (key) notice('Objek tersebut tidak ada dalam daftar yang tersimpan.');
    if (wasDetail) {
      const target = [...document.querySelectorAll('.record')].find(button => button.dataset.id === previousFocusId);
      target?.focus({ preventScroll: true }); window.scrollTo(0, listScroll);
    }
    document.title = 'Pajak Desa · Pematang Ganjang'; return;
  }
  selectedId = key; $('list-view').hidden = true; $('detail-view').hidden = false;
  $('detail-dusun').textContent = dusunLabel(row.dusun); $('detail-name').textContent = row.name;
  $('detail-nop').textContent = 'NOP ' + row.nop; $('detail-year').textContent = 'Pokok PBB · ' + row.year;
  $('detail-amount').textContent = rupiah(row.amount); $('detail-status').textContent = row.status + ' · data sumber';
  $('detail-source-date').textContent = dataset.sourceDate ? 'Status sumber per ' + date(dataset.sourceDate) : 'Tanggal status resmi belum tersedia';
  const fields = $('detail-fields'); fields.replaceChildren();
  [['Alamat objek asli', row.address], ['Dusun objek', dusunLabel(row.dusun)], ['Desa', dataset.village], ['Luas tanah', number.format(row.land) + ' m²'], ['Luas bangunan', number.format(row.building) + ' m²'], ['Tahun pajak', row.year]].forEach(([label, value]) => {
    const item = element('div'); item.append(element('dt', '', label), element('dd', '', String(value))); fields.append(item);
  });
  window.scrollTo(0, 0); $('back').focus({ preventScroll: true }); document.title = 'Detail objek · Pajak Desa';
}
async function start() {
  $('loading').hidden = false; $('error').hidden = true; notice();
  try {
    if ('serviceWorker' in navigator && window.isSecureContext) {
      try {
        await navigator.serviceWorker.register('./sw.js');
        registration = await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error('Persiapan offline terlalu lama.')), 15000))]);
        const stored = await workerMessage('READ_DATA');
        dataset = PajakData.validate(stored.dataset); offlineReady = stored.ready;
      } catch { notice('Daftar dapat dibaca, tetapi penyimpanan offline belum selesai. Buka ulang saat internet tersedia.'); }
    } else notice('Mode offline memerlukan alamat HTTPS atau localhost.');
    if (!dataset) dataset = await networkData();
    const saved = storageGet('pg-dusun');
    if ([...$('dusun').options].some(option => option.value === saved)) $('dusun').value = saved;
    renderMetadata(); renderList(); showRoute();
  } catch (error) {
    $('error').hidden = false;
    $('error-message').textContent = 'Hubungkan internet untuk mengunduh daftar pertama kali, lalu tekan Coba lagi. ' + error.message;
  } finally { $('loading').hidden = true; connectionState(); }
}
async function refresh() {
  const button = $('refresh'); button.disabled = true; button.textContent = 'Memeriksa…'; notice();
  try {
    const fresh = await networkData();
    if (!registration?.active) throw new Error('Penyimpanan offline belum siap. Buka ulang aplikasi ketika internet tersedia.');
    await workerMessage('SAVE_DATA', { dataset: fresh });
    const stored = await workerMessage('READ_DATA');
    const unchanged = dataset.version === stored.dataset.version;
    dataset = stored.dataset; offlineReady = stored.ready;
    renderMetadata(); renderList(); showRoute(); connectionState();
    notice(unchanged ? 'Daftar yang tersimpan sudah merupakan versi terbaru.' : 'Daftar terbaru berhasil disimpan di HP ini.');
  } catch { notice('Pembaruan gagal. Daftar sebelumnya tetap tersimpan dan bisa digunakan. Coba lagi ketika internet tersedia.'); }
  finally { button.disabled = false; button.textContent = 'Perbarui daftar'; }
}
$('search').addEventListener('input', () => { shown = 30; renderList(); });
$('dusun').addEventListener('change', () => { storageSet('pg-dusun', $('dusun').value); shown = 30; renderList(); });
$('clear-search').addEventListener('click', () => { $('search').value = ''; shown = 30; renderList(); $('search').focus(); });
$('show-all').addEventListener('click', () => { $('search').value = ''; $('dusun').value = 'all'; storageSet('pg-dusun', 'all'); shown = 30; renderList(); $('search').focus(); });
$('more').addEventListener('click', () => { shown += 30; renderList(); });
$('back').addEventListener('click', () => { history.replaceState(null, '', location.pathname + location.search); showRoute(); });
$('refresh').addEventListener('click', refresh); $('retry').addEventListener('click', start);
window.addEventListener('hashchange', showRoute);
window.addEventListener('online', connectionState); window.addEventListener('offline', connectionState);
window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; $('install').hidden = false; });
$('install').addEventListener('click', async () => { if (!installPrompt) return; await installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('install').hidden = true; });
window.addEventListener('appinstalled', () => { $('install').hidden = true; });
start();
