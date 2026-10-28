const r=await state.startScene('R104','财报模板选择与下载','担保','修改','财务信息');
const row="//div[contains(@class,'el-tab-pane')]//tbody/tr[.//td[normalize-space(.)='2025-12-31']]";
await r.loc(row).waitFor({timeout:30000});
const c=await r.click('打开财报模板下载选择窗口',r.btn('模板下载',row));
const D=state.dialog+"[.//label[translate(normalize-space(.),' *：:','')='模板名称']]";
await r.loc(D).waitFor();await r.structure('popup','财报模板下载选择弹窗',c);r.note('templateDownloadInventory',await r.inventory('.el-dialog'));
await r.click('模板名称选择',r.sel('模板名称',D));
await r.click('担保公司财报模板',"//div[contains(@class,'el-select-dropdown')]//tbody/tr[.//td[normalize-space(.)='担保公司财报模板']]");
await r.action('确认财报模板下载',r.btn('保存',D),'download');r.parent=state.sceneParent;await state.returnList();const out=[r.finish()];
await state.startScene('R109','删除本轮财务报表','担保','修改','财务信息');await r.loc(row).waitFor({timeout:30000});
const q=page.waitForResponse(x=>x.url().includes('/tansun-tcp-ifr/')&&/delete|remove/i.test(x.url())&&x.request().method()==='POST',{timeout:25000}).catch(()=>null);
const d=await r.click('删除本轮财报',r.btn('删除',row));await page.locator('.el-message-box:visible').waitFor();await r.structure('popup','删除确认',d);
await r.click('确认删除本轮财报',"//div[contains(@class,'el-message-box')]//button[contains(@class,'el-button--primary')]");
const response=await q;const body=response?await response.json():null;r.note('financeDeleteResult',{url:response?.url(),body});
if(!body||body.status!==200){out.push(r.finish('blocked','财报删除未返回成功'));return out;}
await r.loc(row).waitFor({state:'hidden',timeout:25000});r.note('financeAfterDelete',await page.locator('.el-tab-pane:visible').innerText());r.parent=state.sceneParent;await state.returnList();out.push(r.finish());return out;
