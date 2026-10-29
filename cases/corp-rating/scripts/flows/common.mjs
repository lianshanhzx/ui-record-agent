import fs from 'node:fs';
import assert from 'node:assert/strict';
import {PlatformLogin} from '../../../../replay-skill/src/browser/PlatformLogin.js';
import {Recorder,OUT,HOME,btn,item,component,lit,CUSTOMER} from './engine.mjs';
export {Recorder,OUT,HOME,btn,item,component,lit,CUSTOMER,assert,fs};
export const profile=JSON.parse(fs.readFileSync(OUT+'/profile.json','utf8'));
export const API='/IRtgAplyBsnInfApi/';
const fixtureKind=kind=>kind==='main'?(process.env.RATING_FIXTURE_KIND||kind):kind;
export const fixture=(kind='main')=>JSON.parse(fs.readFileSync(OUT+'/fixture-'+fixtureKind(kind)+'.json','utf8'));
export const putFixture=(d,kind='main')=>fs.writeFileSync(OUT+'/fixture-'+fixtureKind(kind)+'.json',JSON.stringify(d,null,2));
export async function ready(page){
 page.setDefaultTimeout(20000);
 await page.goto(HOME,{waitUntil:'domcontentloaded',timeout:45000});
 await page.waitForFunction(()=>location.hash.includes('login')||[...document.querySelectorAll('button')].some(e=>e.textContent.replace(/\s/g,'')==='查询'),{},{timeout:45000});
 if(page.url().includes(profile.login.loggedInUrlShouldNotContain)){
  await PlatformLogin.login(page,profile,OUT+'/auth.json');await page.goto(HOME,{waitUntil:'domcontentloaded'});
 }
 await page.locator('xpath='+btn('查询')).filter({visible:true}).waitFor();
 await page.context().storageState({path:OUT+'/auth.json'});
}
export async function begin(page,id,name,points){
 id=(process.env.RATING_RECORD_PREFIX||'')+id;
 await ready(page);const r=new Recorder(page);r.points=points;r.documentFindings=[];
 await r.start(id,name);return r;
}
export async function end(r){
 const result=await r.finish();
 fs.writeFileSync(OUT+'/result-'+r.id+'.json',JSON.stringify({...result,points:r.points,documentFindings:r.documentFindings,at:new Date().toISOString()},null,2));
 const coverage=JSON.parse(fs.readFileSync(OUT+'/coverage.json','utf8'));
 for(const p of coverage.filter(p=>r.points.includes(p.id))){p.status=r.documentFindings.length?'已新录制 有差异或待补分支':'已新录制 待回放';if(!p.recordings.includes(r.id))p.recordings.push(r.id);p.evidence=[OUT+'/result-'+r.id+'.json',OUT+'/checks-'+r.id+'.json',OUT+'/network-'+r.id+'.json'];}
 fs.writeFileSync(OUT+'/coverage.json',JSON.stringify(coverage,null,2));
 return result;
}
export async function back(r){const gate=/M04-(07|08)$/.test(r.id)?"[not(//div[contains(concat(' ',normalize-space(@class),' '),' el-loading-mask ')][not(contains(@style,'display: none'))])]":"";const a=await r.action('返回评级列表',btn('返回')+gate);await r.page.waitForURL(/cpctRtgAplyMgtPg/);r.parent=a.id;await r.structure('对公客户评级');}
export async function openOwned(r,kind='main',button='修改'){
 const f=fixture(kind);assert.ok(f.owned&&!f.deleted);const row=await r.open(f.bsnNo,button);assert.equal(row.cstNo,f.cstNo);return row;
}
export async function notify(r,pattern){
 await r.page.waitForFunction(source=>[...document.querySelectorAll('.el-message,.el-notification,.el-form-item__error,.el-message-box')].some(e=>e.getBoundingClientRect().height>0&&new RegExp(source).test(e.textContent)),pattern.source,{timeout:12000});
 const texts=await r.page.locator('.el-message,.el-notification,.el-form-item__error,.el-message-box').filter({visible:true}).allTextContents();
 assert.ok(texts.some(t=>pattern.test(t)));r.checks.push({transaction:r.id,name:'页面提示校验',pattern:pattern.source,texts});r.saveEvidence();await r.shot('校验提示');
 const box="//div[contains(concat(' ',normalize-space(@class),' '),' el-message-box ')]";
 if(await r.loc(box).isVisible().catch(()=>false)){
  const parent=r.parent;r.parent=String(r.nodes.length);await r.structure('业务校验提示','popup',box);
  await r.action('确认业务校验提示',box+"//button[contains(@class,'el-button--primary')]");await r.loc(box).waitFor({state:'hidden'});r.parent=parent;
 }
 const notice="//div[contains(concat(' ',normalize-space(@class),' '),' form-error-notice ')]";
 if(await r.loc(notice).isVisible().catch(()=>false)){
  const parent=r.parent;r.parent=String(r.nodes.length);await r.structure('表单必填校验提示','popup',notice);
  await r.action('关闭表单校验提示',notice+"//*[contains(@class,'el-notification__closeBtn')]");await r.loc(notice).waitFor({state:'hidden'});r.parent=parent;
 }
 return texts;
}
export const drawer="//div[@role='dialog' and @aria-label='对公客户评级申请']";
export async function chooseApply(r,customer=CUSTOMER){
 const a=await r.action('评级申请',btn('评级申请'));r.parent=a.id;
 await r.loc(item('客户名称',drawer)+'//input').waitFor();
 const dp=await r.structure('对公客户评级申请','popup',drawer);
 const c=await r.action('打开评级客户选择',item('客户名称',drawer)+'//input');r.parent=c.id;
 const drop="//div[contains(@class,'el-select-dropdown')][.//div[contains(@class,'select-table')]]";
 await r.loc(drop).waitFor();await r.structure('申请客户下拉选择','popup',drop);
 const q=await r.action('查询评级客户',drop+"//div[contains(@class,'search')]//input",'input',customer.cstNm,API+'queryCorporat');r.success(q);
 assert.equal(q.result.data.total,1);assert.equal(q.result.data.list[0].cstNo,customer.cstNo);
 const m=await r.action('选择评级客户',drop+`//tbody/tr[.//td[normalize-space(.)=${lit(customer.cstNm)}]]`,'click','',API+'matchingRatingModel');r.success(m);
 assert.equal(m.request.cstNo,customer.cstNo);assert.ok(m.result.data.tplNo&&m.result.data.tplNm);r.parent=dp;
 assert.equal(await r.loc(item('模型名称',drawer)+'//input').inputValue(),m.result.data.tplNm);
 r.checks.push({transaction:r.id,name:'客户及模型回显',customer,model:m.result.data});r.saveEvidence();return m;
}
export async function riskNext(r,D=drawer){
 await r.action('下一步风险阻断',btn('下一步',D));
 await r.page.waitForFunction(D=>[...document.querySelectorAll('[role="dialog"]')].filter(e=>e.getAttribute('aria-label')===D).some(e=>[...e.querySelectorAll('.el-form-item')].some(f=>f.querySelector('label')?.textContent.trim()==='总校验结果'&&f.querySelector('input')?.value==='通过')),D===drawer?'对公客户评级申请':'评级重评',{timeout:80000});
}
export async function selectCustomerQuery(r,customer){
 const a=await r.action('引入查询客户',btn('选择客户'));r.parent=a.id;
 const D="//div[@role='dialog' and @aria-label='客户选择']";await r.loc(D).waitFor();await r.structure('客户选择','popup',D);
 await r.action('客户编号',item('客户编号',D)+'//input','input',customer.cstNo);
 const q=await r.action('查询引入客户',btn('查询',D),'click','','/custCorporat/queryCustMagnifierList');r.success(q);assert.equal(q.result.data.total,1);
 await r.action('选择查询客户记录',D+`//tbody/tr[.//td[normalize-space(.)=${lit(customer.cstNo)}]]//label[contains(@class,'el-radio')]`);
 await r.action('确认查询客户',btn('确认',D));await r.loc(D).waitFor({state:'hidden'});r.parent='1';
 assert.equal(await r.loc(item('客户编号')+'//input').inputValue(),customer.cstNo);
 assert.equal(await r.loc(item('客户名称')+'//input').inputValue(),q.result.data.list[0].cstNm);return q.result.data.list[0];
}
export async function expand(r){if(!await r.loc(item('审批状态')).isVisible().catch(()=>false))await r.action('展开更多查询条件',"//button[.//i[contains(@class,'el-icon-caret-bottom')]]");}
export async function dateRange(r,name,day){await r.action(name+'开始',item(name)+'//input[1]','input',day);await r.action(name+'结束',item(name)+'//input[2]','input',day);await r.action('关闭'+name+'日期面板',item(name)+'//label');}
export async function create(r,kind='main'){
 await chooseApply(r);await riskNext(r);const started=r.page.waitForResponse(x=>x.url().includes('/workflow/startProcess'));
 const c=await r.action('确定创建评级申请',btn('确定',drawer),'click','',API+'createRating');r.success(c);
 const f={...c.result.data,owned:true,createdAt:new Date().toISOString(),kind};assert.ok(f.bsnNo&&f.id);putFixture(f,kind);
 assert.equal((await(await started).json()).status,200);await r.page.waitForURL(/FS00005854Host/);
 r.parent=c.id;await r.structure('新增对公客户评级');await r.inventory();await back(r);
 const row=await r.query(f.bsnNo);assert.equal(row.bsnSt,'1');assert.equal(row.cstNo,CUSTOMER.cstNo);return f;
}
