// probe_smbsn_12.js - S2 编辑模式探路：列表客户编号搜索 → 修改 → 场景页可编辑性盘点
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const DIR = __dirname;
const BASE = 'http://test.creditv5p2.tansun.com.cn';
const CUST_NO = '260924144929974126';

const N = (b) => (b ? { x1: +(b.x / 1440).toFixed(3), y1: +(b.y / 900).toFixed(3), x2: +((b.x + b.width) / 1440).toFixed(3), y2: +((b.y + b.height) / 900).toFixed(3) } : null);
const J = (o) => JSON.stringify(o);

(async () => {
  const auth = JSON.parse(fs.readFileSync(path.resolve(DIR, '..', '..', 'auth.json'), 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: auth, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const out = { listSearch: null, listQueryResp: null, rowRadioRect: null, url: '', sceneBtns: [], sections: [], items: [], importFields: [] };

  let listResp = null;
  page.on('response', async (r) => {
    if (r.url().includes('findCustTradeList') && r.request().method() === 'POST') {
      try { listResp = await r.json(); } catch {}
    }
  });

  await page.goto(BASE + '/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr', { timeout: 90000 });
  await page.waitForTimeout(2500);

  // 1. 列表查询表单盘点
  out.listSearch = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-form-item'))
      .filter((x) => x.offsetParent !== null)
      .map((x) => {
        const l = x.querySelector('label');
        const inp = x.querySelector('input, .el-select');
        return { label: l ? l.innerText.trim().replace(/\s/g, '') : '?', hasInput: !!x.querySelector('input'), hasSelect: !!x.querySelector('.el-select') };
      })
  );
  console.log('LIST_SEARCH=', J(out.listSearch));

  // 2. 客户编号查询
  const formItem = (lb) => page.locator('.el-form-item').filter({ has: page.locator('label', { hasText: lb }) }).first();
  const noIt = formItem('客户编号');
  const noBox = await noIt.locator('input').first().boundingBox().catch(() => null);
  const qBox = await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().boundingBox().catch(() => null);
  out.listNoRect = J(N(noBox));
  out.listQueryRect = J(N(qBox));
  await noIt.locator('input').first().fill(CUST_NO);
  const qP = page.waitForResponse((r) => r.url().includes('findCustTradeList') && r.request().method() === 'POST', { timeout: 30000 });
  await page.getByRole('button').filter({ hasText: /查\s*询/ }).first().click();
  const q = await qP;
  out.listQueryResp = JSON.parse(await q.text());
  console.log('QUERY total=', out.listQueryResp.data.total, 'row=', J(out.listQueryResp.data.list[0] ? { cstNo: out.listQueryResp.data.list[0].cstNo, cstNm: out.listQueryResp.data.list[0].cstNm, cstSt: out.listQueryResp.data.list[0].cstSt } : null));
  await page.waitForTimeout(2000);

  // 3. 行 radio → 修改
  const row = page.locator('.el-table__body-wrapper .el-table__body tbody tr').first();
  const rInp = row.locator('input[type="radio"]').first();
  out.listRadio = (await rInp.count().catch(() => 0)) ? J(N(await rInp.boundingBox())) : 'NO_RADIO_INPUT';
  if (await rInp.count().catch(() => 0)) await rInp.evaluate((el) => el.click());
  else await row.locator('td').first().click({ force: true });
  await page.waitForTimeout(800);
  const modBtn = page.getByRole('button').filter({ hasText: /修\s*改/ }).first();
  out.listModifyEnabled = !(await modBtn.getAttribute('class').catch(() => '')).includes('is-disabled') && !(await modBtn.isDisabled().catch(() => true));
  await modBtn.click();
  await page.waitForURL(/mdfSmbsnCst/, { timeout: 30000 });
  out.url = page.url().slice(0, 400);
  await page.waitForSelector('.el-form-item:visible', { timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log('URL=', out.url);

  // 4. 场景页盘点（编辑模式）
  out.sceneBtns = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((b) => b.offsetParent !== null)
      .map((b) => b.innerText.trim().replace(/\s/g, ''))
      .filter(Boolean)
  );
  out.sections = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[aria-expanded]'))
      .filter((e) => e.offsetParent !== null)
      .map((e) => ({ name: (e.innerText || '').trim().split('\n')[0].slice(0, 20), expanded: e.getAttribute('aria-expanded') }))
  );
  out.tabs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.el-tabs__item'))
      .filter((e) => e.offsetParent !== null)
      .map((e) => e.innerText.trim())
  );

  out.items = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.el-form-item').forEach((item) => {
      const labelEl = item.querySelector('label');
      if (!labelEl || item.offsetParent === null) return;
      const label = labelEl.innerText.trim().replace(/[*\s]/g, '');
      if (!label) return;
      const ctrls = [];
      item.querySelectorAll('input, textarea').forEach((inp) => {
        if (inp.getBoundingClientRect().width === 0) return;
        ctrls.push({ tag: inp.tagName, dis: inp.disabled, ro: inp.readOnly, val: (inp.value || '').slice(0, 50) });
      });
      const btns = Array.from(item.querySelectorAll('button')).map((b) => ({ t: b.innerText.trim(), dis: b.disabled })).filter((x) => x.t);
      out.push({ label, hasSelect: !!item.querySelector('.el-select'), hasDate: !!item.querySelector('.el-date-editor'), hasSwitch: !!item.querySelector('.el-switch'), ctrls, btns });
    });
    return out;
  });
  console.log('SCENE_ITEMS=', out.items.length, 'BTN=', out.sceneBtns.join(','));

  // 5. 引入字段状态
  for (const lb of ['调查机构', '法定代表人/负责人姓名', '登记注册地址']) {
    const st = out.items.find((x) => x.label.includes(lb.slice(0, 4)));
    out.importFields.push({ label: lb, found: !!st, btns: st ? st.btns : null, ctrls: st ? st.ctrls.map((c) => ({ dis: c.dis, ro: c.ro, val: c.val })) : null });
  }
  fs.writeFileSync(path.join(DIR, 'scene_edit_dump.json'), J(out, null, 1));
  console.log('IMPORT_FIELDS=', J(out.importFields));
  await browser.close();
  console.log('PROBE_DONE');
})().catch((e) => { console.error('PROBE_FAIL:', e.message); process.exit(1); });
