// probe_smbsn_9.js - 列表反查 AT_DBG/AT_RAD 调试残留客户 + 探查行操作按钮; 传参 DEL=1 时执行删除
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const DEL = process.env.DEL === '1';

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { console.log('NATIVE_DIALOG=', d.type(), d.message().slice(0, 100)); await d.accept(); });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2500);

  // 按客户名称模糊查 AT_
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  await formItem('客户名称').locator('input').first().fill('AT_');
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const q = await qP;
  const j = JSON.parse(await q.text());
  console.log('QUERY_AT_ total=', j.data && j.data.total);
  const rows = j.data ? j.data.list : [];
  for (const r of rows) console.log('ROW cstNm=' + r.cstNm + ' cstNo=' + r.cstNo + ' cstSt=' + r.cstSt + ' crdtNo=' + r.crdtNo);
  await page.waitForTimeout(2000);

  // 行操作按钮探查
  const btns = await page.evaluate(() => {
    const trs = Array.from(document.querySelectorAll('.el-table__body-wrapper .el-table__body tbody tr')).slice(0, 3);
    return trs.map((tr) => Array.from(tr.querySelectorAll('td button, td a, .cell [role=button]')).map((b) => (b.innerText || b.title || '').trim()).filter(Boolean));
  });
  console.log('ROW_BTNS=', JSON.stringify(btns));
  const topBtns = await page.evaluate(() => Array.from(document.querySelectorAll('button')).filter((b) => b.offsetParent !== null).map((b) => (b.innerText || '').trim()).filter(Boolean).slice(0, 25));
  console.log('PAGE_BTNS=', JSON.stringify(topBtns));
  const cbCount = await page.locator('.el-table__body-wrapper .el-table__body tbody tr input[type="checkbox"]').count();
  console.log('ROW_CHECKBOXES=', cbCount);
  await page.screenshot({ path: path.join(DIR, 's9_01_list_at.png') });

  if (DEL && rows.length) {
    const targets = rows.filter((r) => /AT_(DBG|RAD|SMB)_/.test(r.cstNm || ''));
    console.log('DEL_TARGETS=', targets.length, JSON.stringify(targets.map((t) => t.cstNm)));
    // 逐行: 勾选 checkbox -> 点 删除 按钮(如有) -> 确认
    const cbCol = page.locator('.el-table__body-wrapper .el-table__body tbody tr td').first();
    for (const t of targets) {
      const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').filter({ hasText: t.cstNm });
      const cb = row.locator('input[type="checkbox"]').first();
      if (await cb.count().catch(() => 0)) {
        await cb.click({ timeout: 5000 }).catch(() => {});
      } else {
        await row.locator('td').first().click({ timeout: 5000 }).catch(() => {});
      }
      await page.waitForTimeout(600);
      const delBtn = page.getByRole('button').filter({ hasText: /删\s*除/ }).first();
      if (await delBtn.count().catch(() => 0)) {
        const delP = page.waitForResponse((r) => /delete|delCust|remove/i.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
        await delBtn.click({ timeout: 5000 }).catch((e) => console.log('DEL_CLICK_ERR', e.message.slice(0, 60)));
        await page.waitForTimeout(1500);
        // 确认弹窗
        const conf = page.locator('.el-message-box:visible button, .el-dialog:visible button').filter({ hasText: /确\s*定|确\s*认/ }).first();
        if (await conf.count().catch(() => 0)) {
          await conf.click({ timeout: 5000 }).catch(() => {});
        }
        const resp = await delP;
        console.log('DEL_API=', resp ? resp.url().replace(BASE, '') : 'NONE', t.cstNm);
        await page.waitForTimeout(1500);
      } else {
        console.log('NO_DEL_BTN for', t.cstNm);
        break;
      }
    }
    // 复核
    await formItem('客户名称').locator('input').first().fill('AT_');
    const qP2 = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
    await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
    const q2 = await qP2;
    const j2 = JSON.parse(await q2.text());
    console.log('RECHECK total=', j2.data && j2.data.total);
    for (const r of (j2.data ? j2.data.list : [])) console.log('REMAIN cstNm=' + r.cstNm + ' cstSt=' + r.cstSt);
  }
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
