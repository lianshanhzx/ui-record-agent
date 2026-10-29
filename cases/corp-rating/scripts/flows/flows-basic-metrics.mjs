import {begin,end,openOwned,back,btn,item,component,fixture,OUT,fs,assert,API,lit,notify} from './common.mjs';
async function template(r){const p=r.page.waitForResponse(x=>x.url().endsWith('/getRtgTemplate'));await openOwned(r);const d=await(await p).json();assert.equal(d.status,200);return JSON.parse(d.data.indata).list;}
async function fillMetrics(r,fields){
 const C=component('评级等级测算'),values=[];
 for(const f of fields){
  const row=C+`//tbody/tr[.//td[normalize-space(.)=${lit(f.idxNm)}]]`;
  if(f.paramType==='select'){
   const opts=f.options;assert.ok(opts.length,'必填指标选项为空：'+f.idxNm);const chosen=[...opts].sort((a,b)=>Number(a.trvalId)-Number(b.trvalId))[0];
   await r.action(f.idxNm,row+"//div[contains(concat(' ',normalize-space(@class),' '),' el-select ')]",'select:click',chosen.lbl,undefined,JSON.stringify(opts.map(x=>x.lbl)));values.push({idxNo:f.idxNo,trval:String(chosen.trvalId),label:chosen.lbl});
  }else{await r.action(f.idxNm,row+'//input','input','25');values.push({idxNo:f.idxNo,trval:'25'});}
 }
 await r.action('指标输入失焦',C+'//tbody/tr[last()]/td[1]');
 fs.writeFileSync(OUT+'/values-'+r.id+'.json',JSON.stringify(values,null,2));return values;
}
export async function basic(page){const r=await begin(page,'M03-01','评级基本信息只读展示',['M03-01']);await openOwned(r);const inv=await r.inventory();const base=await r.loc(component('评级基本情况')).evaluate(e=>[...e.querySelectorAll('input')].map(i=>({value:i.value,disabled:i.disabled,readOnly:i.readOnly})));assert.ok(base.length>=10&&base.every(x=>x.disabled||x.readOnly));await back(r);await end(r);}
export async function customer360(page){
 const r=await begin(page,'M03-02','查看客户360视图',['M03-02']);await openOwned(r);const old=r.page.url();await r.action('客户详情',btn('客户详情',component('评级基本情况')));
 await r.page.waitForFunction(u=>location.href!==u,old,{timeout:20000});r.parent=String(r.nodes.length);await r.structure('对公客户360视图');
 const text=await r.page.locator('body').innerText();assert.ok(r.page.url().includes(fixture().cstNo)||text.includes(fixture().cstNm));await r.inventory();await end(r);
}
export async function navigation(page){
 const r=await begin(page,'M03-03','客户经理任务步骤导航',['M03-03']);await openOwned(r);const inv=await r.inventory();assert.equal(inv.components.length,6);
 for(const name of ['影像资料','风险阻断','签署信息']){await r.action('下一步'+name,btn('下一步'));r.parent=String(r.nodes.length);await r.structure('评级详情-'+name);}
 const prev=r.loc(btn('上一页'));if(await prev.count())await r.action('上一页',btn('上一页'));else await r.action('上一步',btn('上一步'));
 await back(r);await end(r);
}
export async function metricLoad(page){const r=await begin(page,'M05-01','动态加载评级指标',['M05-01']);const fields=await template(r);assert.ok(fields.length);fs.writeFileSync(OUT+'/metric-template.json',JSON.stringify(fields,null,2));r.checks.push({transaction:r.id,name:'全部模板指标盘点',count:fields.length,fields});await r.inventory();await back(r);await end(r);}
export async function metricEntry(page){const r=await begin(page,'M05-02','全字段评级指标值维护',['M05-02']);await fillMetrics(r,await template(r));await back(r);await end(r);}
export async function modelVersion(page){const r=await begin(page,'M05-03','修改页面模型检查',['M05-03']);await template(r);await r.inventory();r.documentFindings.push({requirement:'模型变更后清空指标及测算结果',observed:'当前环境模型未变更，只能录制正常检查入口；变更分支需规则引擎测试版本'});await back(r);await end(r);}
export async function metricValidation(page){
 const r=await begin(page,'M05-05','测算前指标必填校验',['M05-05']);const fields=await template(r);const C=component('评级等级测算'),numeric=fields.find(f=>f.paramType!=='select');
 await r.action('清空必填指标'+numeric.idxNm,C+`//tbody/tr[.//td[normalize-space(.)=${lit(numeric.idxNm)}]]//input`,'input','');
 await r.action('缺少指标直接测算',btn('测算',C));await notify(r,/指标信息未填写完全|指标.*必填|请.*指标/);await back(r);await end(r);
}
export async function metricTemp(page){
 const r=await begin(page,'M05-04','评级指标暂存与反查',['M05-04']);const values=await fillMetrics(r,await template(r));
 const a=await r.action('暂存评级指标',btn('暂存',component('评级等级测算')),'click','',API+'saveScor');r.success(a);assert.equal(a.request.bsnNo,fixture().bsnNo);await back(r);
 const p=r.page.waitForResponse(x=>x.url().endsWith('/getBsnInf'));await openOwned(r,'main','查看详情');const d=(await(await p).json()).data;const actual=JSON.parse(d.estData);
 for(const v of values)assert.equal(String(actual.find(x=>x.idxNo===v.idxNo)?.trval),v.trval);r.checks.push({transaction:r.id,name:'暂存反查',result:d});await back(r);await end(r);
}
export async function metricCalculate(page){
 const r=await begin(page,'M05-06','评级评分测算及持久化',['M05-06']);const old=await openOwned(r);const C=component('评级等级测算');
 const a=await r.action('测算评级评分',btn('测算',C),'click','',API+'saveScor');r.success(a);await back(r);
 const p=r.page.waitForResponse(x=>x.url().endsWith('/getBsnInf'));await openOwned(r,'main','查看详情');const d=(await(await p).json()).data;
 assert.ok(d.stmrtgGrd&&Number.isFinite(Number(d.stmrtgScor)));assert.equal(Number(d.estCnt),Number(old.estCnt||0)+1);r.checks.push({transaction:r.id,name:'测算结果反查',result:d});await back(r);await end(r);
}
