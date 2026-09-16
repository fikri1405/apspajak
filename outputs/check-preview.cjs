const {chromium}=require('C:/Users/Digitalisasi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try {
const page=await browser.newPage({viewport:{width:390,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('file:///C:/Users/Digitalisasi/Downloads/apspajak/outputs/preview-check.html');const f=page.frameLocator('iframe');
await f.locator('.pg-entry').first().waitFor();
const count=async n=>{if(await f.locator('.pg-entry').count()!==n)throw Error('Wrong result count '+n)};
await count(3);await f.locator('#pg-search-input').fill('budi');await count(2);
await f.locator('.pg-entry').nth(1).click();if(await f.locator('.pg-detail-dusun').textContent()!=='Dusun V')throw Error('Wrong detail');
await page.screenshot({path:'outputs/detail-check.png',fullPage:true});await f.locator('.pg-back').click();
if(await f.locator('#pg-search-input').inputValue()!=='budi')throw Error('Lost search');
await f.locator('#pg-search-input').fill('CONTOH0050004');await count(1);
await f.locator('#pg-search-input').fill('doesnotexist');await f.locator('.pg-all').click();await count(11);
await f.locator('#pg-dusun-select').selectOption('unknown');await count(1);
await f.locator('#pg-dusun-select').selectOption('III');await page.screenshot({path:'outputs/list-check.png',fullPage:true});
for(const width of [320,390,736]){await page.setViewportSize({width,height:950});const b=await f.locator('#pg-pajak-preview').evaluate(el=>({s:el.scrollWidth,w:el.clientWidth}));if(b.s>b.w)throw Error('Overflow '+width);}
if(errors.length)throw Error(errors.join(';'));console.log('Verified search across dusun, NOP punctuation, filters, detail, return state, empty state, and responsive widths.');
} finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
