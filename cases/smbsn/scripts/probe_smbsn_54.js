// probe54: 逐个候选对公客户→查看详情→读注册资本（找 S4 股东指向对象：真实法人客户且有注册资本）
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST = BASE + '/#/cstMgt/csinfMnt/cpctMgt/cpctMgtPg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', '..', 'auth.json'), 'utf8'));
  const cands = JSON.parse(fs.readFileSync(path.join(__dirname, 'corp-candidates.json'), 'utf8'));
  // 优先 营业执照(20111) + cstSt=6
  const pick = cands.filter((c) => c.crdtTp === '20111' && c.cstSt === '6').slice(0, 6);
  console.log('P54_CANDIDATES=' + JSON.stringify(pick.map((c) => c.cstNo + ':' + c.cstNm)));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const out = [];
  for (const c of pick) {
    const page = await ctx.newPage();
    const details = [];
    page.on('response', async (r) => {
      const u = r.url();
      if (!/tansun-tcp-cst/.test(u)) return;
      if (/findCustCorporatList|login|dict|menu|user|org/i.test(u)) return;
      try {
        const j = await r.json();
        const s = JSON.stringify(j);
        if (/rgstCaptlfundAmt/.test(s)) details.push({ last: u.split('/').filter(Boolean).slice(-2).join('/'), j });
      } catch {}
    });
    try {
      const listReady = page.waitForResponse((r) => r.url().includes('findCustCorporatList') && r.request().method() === 'POST', { timeout: 120000 });
      await page.goto(LIST, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await listReady;
      await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(c.cstNo);
      const q = page.waitForResponse((r) => r.url().includes('findCustCorporatList') && r.request().method() === 'POST', { timeout: 30000 });
      await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
      await q;
      await page.waitForTimeout(1500);
      const rows = page.locator('.el-table__body-wrapper .el-table__body tbody tr');
      if ((await rows.count()) < 1) { console.log('P54 ' + c.cstNo + ' NO_ROW'); continue; }
      await rows.first().locator('input[type="radio"]').first().evaluate((el) => el.click());
      await sleep(800);
      await page.getByRole('button').filter({ hasText: /查\s*看/ }).first().click();
      await page.waitForFunction(() => !location.hash.includes('cpctMgtPg'), { timeout: 60000 });
      await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
      await sleep(4000);
      const formVals = await page.evaluate(() => {
        const o = {};
        for (const it of document.querySelectorAll('.el-form-item')) {
          const lb = (it.querySelector('label') || {}).innerText || '';
          const key = lb.trim().replace(/[*\s]/g, '');
          if (!/注册资本|营业执照|客户名称|证件/.test(key)) continue;
          const inp = it.querySelector('input, textarea, .el-select');
          if (inp) o[key] = (inp.value !== undefined ? inp.value : (inp.innerText || '')).trim();
        }
        return o;
      });
      let apiCap = null;
      for (const d of details) {
        try {
          const walk = (o) => {
            if (!o || typeof o !== 'object') return null;
            if (o.rgstCaptlfundAmt !== undefined && o.cstNo !== undefined) return o;
            for (const k of Object.keys(o)) { const r = walk(o[k]); if (r) return r; }
            return null;
          };
          const found = walk(d.j);
          if (found && (String(found.rgstCaptlfundAmt || '').trim() !== '')) { apiCap = { api: d.last, cstNo: found.cstNo, cstNm: found.cstNm, crdtNo: found.crdtNo, rgstCaptlfundAmt: found.rgstCaptlfundAmt, rgstCaptlfundCcy: found.rgstCaptlfundCcy }; break; }
        } catch {}
      }
      out.push({ cstNo: c.cstNo, cstNm: c.cstNm, crdtNo: c.crdtNo, formVals, apiCap });
      console.log('P54 ' + c.cstNo + ' ' + c.cstNm + ' form=' + JSON.stringify(formVals) + ' api=' + JSON.stringify(apiCap));
    } catch (e) {
      console.log('P54 ' + c.cstNo + ' ERR ' + e.message);
      out.push({ cstNo: c.cstNo, cstNm: c.cstNm, crdtNo: c.crdtNo, error: e.message });
    }
    await page.close();
  }
  fs.writeFileSync(path.join(__dirname, 's4-corp-pick.json'), JSON.stringify(out, null, 2), 'utf8');
  console.log('P54_SAVED s4-corp-pick.json');
  await browser.close();
})().catch((e) => { console.error('P54_ERROR', e.message); process.exit(1); });
