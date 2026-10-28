// probe_smbsn_4.js - 场景页 3 个【引入】弹窗结构探路
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const SCENE = process.env.SCENE_URL;

function dumpDialog(page, tag) {
  return page.evaluate((tag) => {
    const ds = Array.from(document.querySelectorAll('.el-dialog')).filter(d => d.offsetParent !== null);
    if (!ds.length) return { tag, none: true };
    const d = ds[ds.length - 1];
    const items = [];
    d.querySelectorAll('.el-form-item').forEach(f => {
      const l = f.querySelector('label');
      if (!l) return;
      const inp = f.querySelector('input, textarea');
      items.push({
        label: (l.innerText || '').trim(),
        type: f.querySelector('.el-select') ? 'select' : f.querySelector('.el-date-editor') ? 'date' : inp ? 'input' : 'other',
        ph: inp ? inp.placeholder || '' : '',
      });
    });
    const heads = Array.from(d.querySelectorAll('.el-table__header-wrapper th .cell, .el-table__header th .cell')).map(h => (h.innerText || '').trim());
    const btns = Array.from(d.querySelectorAll('button')).filter(b => b.offsetParent !== null).map(b => (b.innerText || '').trim()).filter(Boolean);
    return { tag, title: ((d.querySelector('.el-dialog__title') || {}).innerText || '').trim(), items, heads, btns };
  }, tag);
}

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  try {
    await page.goto(SCENE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(25000);
    await page.waitForSelector('.el-form-item', { timeout: 60000 });
    await page.waitForTimeout(2000);

    const introBtns = [
      { tag: 'survyInst', label: '调查机构' },
      { tag: 'lglRprs', label: '法定代表人/负责人姓名' },
      { tag: 'rgstAdr', label: '登记注册地址' },
    ];
    for (const b of introBtns) {
      const item = page.locator('.el-form-item:visible').filter({ has: page.locator('label', { hasText: b.label }) }).first();
      const btn = item.locator('button', { hasText: /引\s*入/ }).first();
      await item.scrollIntoViewIfNeeded().catch(() => {});
      const clicked = await btn.click({ timeout: 10000 }).then(() => true).catch(e => { console.log('CLICK_FAIL ' + b.tag + ': ' + e.message.split('\n')[0]); return false; });
      if (!clicked) continue;
      await page.waitForTimeout(2500);
      const d = await dumpDialog(page, b.tag);
      console.log('DIALOG[' + b.tag + ']=', JSON.stringify(d, null, 1));
      await page.screenshot({ path: path.join(DIR, `s4_01_${b.tag}.png`) });
      // 若有查询输入框：填个值点查询看 API
      if (d.items && d.items.length) {
        const qInput = page.locator('.el-dialog:visible input:visible').first();
        if (await qInput.count()) {
          await qInput.fill('测试').catch(() => {});
          const qBtn = page.locator('.el-dialog:visible button', { hasText: /查\s*询/ }).first();
          if (await qBtn.count()) {
            const respPromise = page.waitForResponse(r => r.url().includes('/prod-api/') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
            await qBtn.click();
            const resp = await respPromise;
            if (resp) {
              let j = null; try { j = JSON.parse(await resp.text()); } catch {}
              console.log('QUERY_API[' + b.tag + ']=', resp.url().replace('http://test.creditv5p2.tansun.com.cn', ''), 'code=', j && j.code, 'total=', j && j.data ? (j.data.total ?? (j.data.list ? j.data.list.length : null)) : null, 'body=', JSON.stringify(resp.request().postDataJSON()));
            }
            await page.waitForTimeout(1500);
          }
        }
      }
      // 关闭：取消/关闭按钮
      const closeBtn = page.locator('.el-dialog:visible button', { hasText: /取\s*消|关\s*闭/ }).last();
      if (await closeBtn.count()) await closeBtn.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(1500);
      console.log('---');
    }
  } catch (e) {
    console.error('PROBE_FAIL:', e.message);
  } finally {
    await browser.close();
    console.log('PROBE_DONE');
  }
})();
