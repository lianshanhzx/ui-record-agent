const r=state.rec;
await page.locator(r.btn('重置')).click();let setupWait=state.waitApi('findCustCorporatList');await page.locator(r.btn('查询')).click();await setupWait;await page.locator('.el-loading-mask:visible').waitFor({state:'hidden'}).catch(()=>{});
const collapse="//button[.//i[contains(@class,'el-icon-caret-top')]]";if(await r.loc(collapse).count())await r.loc(collapse).click();
const headers=await page.locator('.el-table__header-wrapper thead tr').first().locator('th').allTextContents();
const row=await page.locator('.el-table__body-wrapper tbody tr').first().locator('td').allTextContents();
state.baseline={};headers.forEach((h,i)=>state.baseline[h.trim()]=row[i]?.trim());
const b=state.baseline;
const more="//button[.//i[contains(@class,'el-icon-caret-bottom')]]";
const fields=[['客户编号',b['客户编号'],'input'],['客户分类','发展巩固类','select'],['客户名称',b['客户名称'],'input'],['证件类型',b['证件类型'],'select'],['证件号码',b['证件号码'],'input'],['对公客户类型',b['对公客户类型'],'select'],['客户状态',b['客户状态'],'select'],['管户客户经理',b['管户客户经理'],'input']];
await r.start('R01','列表八条件查询');
await r.click('展开更多查询条件',more);
for(const [label,value,type] of fields){if(type==='select')await r.select(label,r.sel(label),value);else await r.input(label,r.inp(label),value);}
let wait=state.waitApi('findCustCorporatList');await r.click('查询',r.btn('查询'));let response=await wait;let data=await response.json();
r.note('request',response.request().postDataJSON());r.note('total',data.data?.total);if(data.data?.total!==1)throw Error('Query did not return one record');state.listQuery=data;r.finish();
await r.start('R02','列表无结果查询');await r.click('重置',r.btn('重置'));await r.input('客户名称',r.inp('客户名称'),'RR_NO_MATCH_20261012_'+Date.now());wait=state.waitApi('findCustCorporatList');await r.click('查询',r.btn('查询'));response=await wait;data=await response.json();r.note('total',data.data?.total);if(data.data?.total!==0)throw Error('Expected zero results');r.finish();
if(await r.loc(collapse).count())await r.loc(collapse).click();await r.start('R03','列表八条件重置');await r.click('展开更多查询条件',more);
for(const [label,value,type] of fields){if(type==='select')await r.select(label,r.sel(label),value);else await r.input(label,r.inp(label),value);}
await r.click('重置',r.btn('重置'));
const vals={};for(const [label] of fields)vals[label]=await r.loc(r.inp(label)).inputValue();r.note('valuesAfterReset',vals);if(Object.values(vals).some(Boolean))throw Error('Reset retained values');wait=state.waitApi('findCustCorporatList');await r.click('查询',r.btn('查询'));await wait;r.finish();
await r.start('R04','列表分页');wait=state.waitApi('findCustCorporatList');await r.click('下一页',"//div[contains(@class,'el-pagination')]//button[contains(@class,'btn-next')]");response=await wait;r.note('nextPageRequest',response.request().postDataJSON());wait=state.waitApi('findCustCorporatList');await r.click('第一页',"//ul[contains(@class,'el-pager')]//li[normalize-space(.)='1']");await wait;await r.select('每页条数',"//div[contains(@class,'el-pagination')]//div[contains(@class,'el-select')]",'20条/页');await page.waitForFunction(()=>document.body.innerText.includes('当前显示 20 条'));r.note('pageSize',20);r.finish();
fs.writeFileSync(RUN+'/baseline.json',JSON.stringify(b,null,2));return r.registry;
