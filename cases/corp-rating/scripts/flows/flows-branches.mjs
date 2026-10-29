import {begin,end,fixture,btn,item,assert,OUT,fs} from './common.mjs';
import {taskStart,signPage} from './flows-workflow.mjs';
const box="//div[contains(concat(' ',normalize-space(@class),' '),' el-message-box ')]";
const approval="//div[@role='dialog' and @aria-label='审批意见']";
async function confirmIfPresent(r){
 if(await r.loc(box).isVisible().catch(()=>false)){
  r.parent=String(r.nodes.length);await r.structure('流程操作确认','popup',box);
  r.checks.push({transaction:r.id,name:'操作确认原文',text:await r.loc(box).innerText()});
  await r.action('确认流程操作',box+"//button[contains(@class,'el-button--primary')]");await r.loc(box).waitFor({state:'hidden'});
 }
}
async function state(r,expected){
 await r.page.waitForFunction(()=>![...document.querySelectorAll('.page-main-container-loading')].some(e=>e.getBoundingClientRect().height>0),{},{timeout:90000});
 const settled=r.id.endsWith('-revoke')?"[not(//div[contains(concat(' ',normalize-space(@class),' '),' page-main-container-loading ')][not(contains(@style,'display: none'))])]":"";
 const a=await r.action('返回评级主列表页签',"//li[contains(concat(' ',normalize-space(@class),' '),' tag-item ')][./span[normalize-space(.)='对公客户评级']]"+settled);
 await r.loc(item('业务编号')+'//input').waitFor();r.parent=a.id;await r.structure('对公客户评级');
 const row=await r.query(fixture().bsnNo);assert.equal(row.bsnSt,expected);r.checks.push({transaction:r.id,name:'流程状态反查',expected,row});
}
async function outcome(page,op,expected,id){
 const r=await taskStart(page,id,op+'评级申请',['M10-03','M10-05']);
 const p=page.waitForResponse(x=>x.url().endsWith('/queryOperat'));const a=await r.action('打开审批意见',btn('审批'));r.parent=a.id;await r.loc(approval).waitFor();await r.structure('评级审批意见','popup',approval);
 const d=await(await p).json();assert.equal(d.status,200);const options=d.data.map(x=>x.pcsMnpltAls||x.pcsMnpltNm);assert.ok(options.includes(op));
 await r.action('选择'+op,item('流程操作',approval)+"//div[contains(concat(' ',normalize-space(@class),' '),' el-select ')]",'select:click',op,undefined,JSON.stringify(options));
 await r.action('审批意见',item('意见详情',approval)+'//textarea','input','AT_全新录制_'+op+'_'+fixture().bsnNo);
 await r.action('提交'+op,btn('流程提交',approval));
 try{
  await page.waitForFunction(()=>[...document.querySelectorAll('.el-message-box')].some(e=>e.getBoundingClientRect().height>0)||![...document.querySelectorAll('[role="dialog"][aria-label="审批意见"]')].some(e=>e.getBoundingClientRect().height>0),{},{timeout:20000});
  await confirmIfPresent(r);await r.loc(approval).waitFor({state:'hidden',timeout:30000});await state(r,expected);await end(r);
 }catch(e){await r.inventory();await r.shot('分支探路现场');fs.writeFileSync(OUT+'/'+r.id+'-branch-dom.html',await page.locator('body').innerHTML());throw e;}
}
export const returned=page=>outcome(page,'退回第一步','4','M10-03-return');
export const denied=page=>outcome(page,'不同意','6','M10-03-deny');
export async function revoked(page){
 const r=await begin(page,'M10-05-revoke','撤销本轮测试评级流程',['M10-05']);await signPage(r);await r.action('撤销评级流程',btn('流程撤销'));
 await r.loc(box).waitFor();const p=page.waitForResponse(x=>x.url().endsWith('/terminateProcess'));await confirmIfPresent(r);const response=await p;const d=await response.json();assert.equal(d.status,200);r.checks.push({transaction:r.id,name:'撤销接口响应',url:response.url(),result:d});await state(r,'3');await end(r);
}
