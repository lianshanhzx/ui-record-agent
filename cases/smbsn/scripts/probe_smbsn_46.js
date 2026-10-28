// probe46: 验证修法——股东客户编号+证件号码 指向主客户(有注册资本), 编辑保存能否过
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const PARENT = '260924144929974126';
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const LIST_ROUTE = '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg';
const DIR = __dirname;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  let saveResp = null;
  page.on('response', async (resp) => {
    if (resp.url().includes('custCorporatRelatedParty/save') && resp.status() === 200) {
      try { saveResp = await resp.json(); } catch {}
    }
  });
  await page.goto(BASE + LIST_ROUTE, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2000);
  await page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: '客户编号' }) }).first().locator('input').first().fill(PARENT);
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  await page.waitForTimeout(4000);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await page.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await sleep(4000);

  // 读主客户 USCC(营业执照)
  const parentUscc = await page.evaluate(() => {
    const it = Array.from(document.querySelectorAll('.el-form-item')).find((x) => {
      const l = x.querySelector('label');
      return l && (l.innerText || '').trim().replace(/[*\s]/g, '') === '营业执照' && x.offsetParent !== null;
    });
    if (!it) return '';
    const inp = it.querySelector('input');
    return inp ? inp.value : '';
  });
  console.log('PARENT_USCC=', parentUscc);

  // 股东信息 tab → 选首行 → 修改弹窗
  await page.locator('.el-tabs__item').filter({ hasText: '股东信息' }).first().click();
  await sleep(3000);
  const pane = page.locator('.el-tab-pane:visible').last();
  await pane.locator('.el-table__body tbody tr').first().locator('input[type="radio"]').first().evaluate((el) => el.click());
  await sleep(800);
  await pane.getByRole('button').filter({ hasText: /修\s*改/ }).first().click();
  await sleep(2500);

  // 改 股东客户编号 + 证件号码 指向主客户
  const dlg = page.locator('.el-dialog:visible').last();
  const setByLabel = async (label, val) => {
    const it = dlg.locator('.el-form-item').filter({ has: dlg.locator('label', { hasText: label }) }).first();
    await it.locator('input').first().click();
    await it.locator('input').first().fill(val);
    await sleep(300);
  };
  await setByLabel('股东客户编号', PARENT);
  await setByLabel('证件号码', parentUscc);
  await sleep(500);

  // 确定
  await page.getByRole('button').filter({ hasText: /确\s*定/ }).last().click();
  await sleep(4500);
  const dlgOpen = await page.evaluate(() => Array.from(document.querySelectorAll('.el-dialog')).filter((d) => d.offsetParent !== null).length);
  console.log('DLG_OPEN=', dlgOpen, 'SAVE_CODE=', saveResp ? saveResp.code : 'none', 'DESC=', saveResp ? String(saveResp.description || '').slice(0, 150) : '');
  console.log('DONE');
  await ctx.close();
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
