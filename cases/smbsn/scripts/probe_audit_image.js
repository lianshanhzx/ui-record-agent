const { chromium } = require('playwright');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: path.join(ROOT,'auth.json'), viewport:{width:1440,height:900} });
  const page = await ctx.newPage();
  await page.goto('http://test.creditv5p2.tansun.com.cn/#/cstMgt/csinfMntSubDmn/smbsnCstMgt/smbsnCstMgtPg',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('.el-table__body-wrapper .el-table__body tbody tr',{timeout:60000});
  await page.waitForTimeout(2000);
  await page.locator(".el-form-item:has(label:has-text('客户编号')) input").first().fill('260924144929974126');
  await page.getByRole('button').filter({hasText:/查\s*询/}).first().click();
  await page.waitForTimeout(2500);
  await page.locator('.el-table__body-wrapper .el-table__body tbody tr').first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button').filter({hasText:/修\s*改/}).first().click();
  await page.waitForTimeout(6000);
  // 切影像资料 tab
  await page.locator(".el-tabs__item:has-text('影像资料'), [role=tab]:has-text('影像资料')").first().click();
  await page.waitForTimeout(3000);
  // 选目录树「客户管理」节点（若有文件才显示行操作；当前 0 文件，看工具栏+空态）
  const node = page.locator("//div[contains(@class,'el-tree-node__content')][normalize-space(.)='客户管理']");
  if (await node.count()) { await node.first().click(); await page.waitForTimeout(2500); }
  const dump = await page.evaluate(() => {
    const txt = el => (el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
    const vis = el => { const r=el.getBoundingClientRect(); return r.width>0&&r.height>0; };
    const cont = document.querySelector('.file-catalog-container');
    const scope = cont || document;
    const toolbar = [...scope.querySelectorAll('button')].filter(vis).map(b=>txt(b)).filter(Boolean);
    // 行内 span 操作（预览/下载/移动/打印/删除）
    const rowActions = [...scope.querySelectorAll('span, a')].filter(vis).map(s=>txt(s)).filter(t=>['预览','下载','移动','打印','删除'].includes(t));
    // 目录树节点上的附加图标（新增/重命名/删除目录）
    const treeIcons = [...scope.querySelectorAll('.el-tree-node__content [class*="icon"], .el-tree-node__content i')].map(i=>i.className).filter(Boolean).slice(0,20);
    // 是否有 右键菜单/更多
    const more = [...scope.querySelectorAll('button, span')].filter(vis).map(s=>txt(s)).filter(t=>/更多|菜单|新建|新增目录|重命名|添加/.test(t));
    return { toolbar, rowActions:[...new Set(rowActions)], treeIcons:[...new Set(treeIcons)], more:[...new Set(more)] };
  });
  console.log('TOOLBAR='+JSON.stringify(dump.toolbar));
  console.log('ROW_ACTIONS='+JSON.stringify(dump.rowActions));
  console.log('TREE_ICONS='+JSON.stringify(dump.treeIcons));
  console.log('MORE='+JSON.stringify(dump.more));
  await browser.close();
})().catch(e=>{console.error('ERR '+(e.message||e).toString().slice(0,300));process.exit(1);});
