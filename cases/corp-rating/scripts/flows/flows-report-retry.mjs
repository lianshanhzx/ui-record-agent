import {begin,end,openOwned,back,btn,item,component,fixture,OUT,fs,assert,lit} from './common.mjs';
const C=component('征信信息');
export async function retry(page){
 const r=await begin(page,'M04-08','征信报告重新获取及复用条件核对',['M04-08','M04-09']);
 const p=page.waitForResponse(x=>x.url().endsWith('/findCreditObj'));await openOwned(r);const data=(await(await p).json()).data.list;
 const row=data.find(x=>x.cstNo===fixture().cstNo);assert.equal(row.uploadInd,'1');
 await r.action('选择已授权测试客户',C+`//tbody/tr[.//td[normalize-space(.)=${lit(row.cstNo)}]]//label[contains(@class,'el-radio')]`);
 const a=await r.action('再次获取最新征信报告',btn('获取最新征信报告',C),'click','','/ICstCreditInvApi/updateLtstCrRpt');r.success(a);
 r.checks.push({transaction:r.id,name:'报告复用前提及再次查询响应',before:row,response:a.result});await r.shot('报告再次获取反馈');
 if(!row.crRptDt||!row.crRptPdfFileAdr)r.documentFindings.push({requirement:'30天内报告复用与异步报告完成',observed:{reportDate:row.crRptDt||null,reportFile:row.crRptPdfFileAdr||null,apiResult:a.result,limitation:'已授权并重复发起真实请求，但当前未生成报告文件，无法执行报告复用及PDF成功预览'}});
 const box="//div[contains(concat(' ',normalize-space(@class),' '),' el-message-box ')]";
 if(await r.loc(box).isVisible().catch(()=>false)){r.parent=String(r.nodes.length);await r.structure('征信报告查询确认','popup',box);await r.action('确认征信再次查询',box+"//button[contains(@class,'el-button--primary')]");}
 await back(r);await end(r);
}
