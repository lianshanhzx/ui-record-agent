import {begin,end,btn,item,assert,API,selectCustomerQuery,expand,dateRange,chooseApply,riskNext,drawer,create,notify,back,openOwned,OUT,fs,CUSTOMER} from './common.mjs';
const baseline={bsnNo:'PJ20260907016009',cstNo:'26090119045027429',cstNm:'贯通验证企业190416有限公司'};
export async function list(page){const r=await begin(page,'M01-01','评级业务列表展示',['M01-01']);const q=await r.action('查询当前经办评级',btn('查询'),'click','',API+'pageBsnInf');r.success(q);assert.ok(q.result.data.total>0);assert.ok(q.result.data.list.every(x=>x.bsnTp==='1'&&x.delInd==='0'&&x.aplyUsrNo==='701994'));await r.inventory();await end(r);}
export async function customerQuery(page){const r=await begin(page,'M01-02','查询客户引入',['M01-02']);await selectCustomerQuery(r,baseline);assert.ok(await r.loc(item('客户编号')+'//input').isDisabled());await end(r);}
export async function more(page){const r=await begin(page,'M01-03','更多查询条件展开',['M01-03']);await expand(r);for(const n of ['审批状态','评级发生类型','申请日期','评级到期日期'])assert.ok(await r.loc(item(n)).isVisible());await r.inventory();await end(r);}
export async function allQuery(page){
 const r=await begin(page,'M01-04','评级业务全部条件查询',['M01-04']);const row=await r.query(baseline.bsnNo);await selectCustomerQuery(r,baseline);await expand(r);
 const status={'1':'待发起','2':'审批中','3':'已撤销','4':'退回','5':'通过','6':'否决','7':'作废'}[row.bsnSt];
 const char={'1':'新增','4':'重新评级','5':'自动评级'}[row.aplyChar];
 await r.action('审批状态',item('审批状态')+"//div[contains(@class,'el-select')]",'select:click',status);
 await r.action('评级发生类型',item('评级发生类型')+"//div[contains(@class,'el-select')]",'select:click',char);
 const day=row.aplyDt.slice(0,10),ex=row.rtgVldExdt.slice(0,10);await dateRange(r,'申请日期',day);await dateRange(r,'评级到期日期',ex);
 const q=await r.action('全部条件查询',btn('查询'),'click','',API+'pageBsnInf');r.success(q);
 for(const[k,v]of Object.entries({bsnNo:row.bsnNo,cstNo:row.cstNo,cstNm:row.cstNm,bsnSt:row.bsnSt,aplyChar:row.aplyChar,aplyDt:[day,day],exdt:[ex,ex]}))assert.deepEqual(q.request[k],v);
 assert.equal(q.result.data.total,1);await end(r);
}
export async function reset(page){const r=await begin(page,'M01-05','评级查询条件重置',['M01-05']);await expand(r);await r.action('业务编号',item('业务编号')+'//input','input',baseline.bsnNo);await selectCustomerQuery(r,baseline);await r.action('重置全部条件',btn('重置'));const q=await r.action('重置后查询',btn('查询'),'click','',API+'pageBsnInf');for(const[k,v]of Object.entries({bsnNo:'',cstNo:'',cstNm:'',bsnSt:'',aplyChar:'',aplyDt:[],exdt:[]}))assert.deepEqual(q.request[k],v);await end(r);}
export async function wizard(page){
 const r=await begin(page,'M02-01','新增评级向导导航及必填校验',['M02-01']);
 let a=await r.action('评级申请',btn('评级申请'));r.parent=a.id;await r.loc(item('客户名称',drawer)+'//input').waitFor();await r.structure('对公客户评级申请','popup',drawer);
 await r.action('空表下一步',btn('下一步',drawer));await notify(r,/客户名称|模型名称/);await r.action('取消空表向导',btn('取消',drawer));await r.loc(drawer).waitFor({state:'hidden'});r.parent='1';
 await chooseApply(r);await riskNext(r);await r.action('上一步返回基本信息',btn('上一步',drawer));await r.loc(item('客户名称',drawer)+'//input').waitFor();
 const actual=await r.loc(item('客户名称',drawer)+'//input').inputValue();if(actual!=='')r.documentFindings.push({requirement:'上一步清除已选客户',observed:actual});
 await r.action('取消评级向导',btn('取消',drawer));await end(r);
}
export async function customerApply(page){const r=await begin(page,'M02-02','评级客户选择',['M02-02']);await chooseApply(r);await r.action('取消评级客户选择',btn('取消',drawer));await end(r);}
export async function model(page){const r=await begin(page,'M02-03','评级模型自动匹配',['M02-03']);const m=await chooseApply(r);r.checks.push({transaction:r.id,name:'规则引擎匹配参数',request:m.request,result:m.result});await r.action('取消模型匹配向导',btn('取消',drawer));await end(r);}
export async function admission(page){
 const r=await begin(page,'M02-04','在途评级准入拦截',['M02-04']);
 await chooseApply(r,{cstNo:'26092309281808493',cstNm:'AT_潜客_20260923012641'});await riskNext(r);
 await r.action('确定已在途客户评级',btn('确定',drawer));await notify(r,/已发起评级流程|等待流程完成/);
 if(await r.loc(btn('取消',drawer)).isVisible().catch(()=>false))await r.action('取消在途客户申请',btn('取消',drawer));else r.checks.push({transaction:r.id,name:'在途拦截后向导自动关闭',value:true});await end(r);
}
export async function apply(page){const r=await begin(page,'M02-05','创建评级业务与启动流程',['M02-05','M02-04']);await create(r);await end(r);}
export async function modify(page){const r=await begin(page,'M01-06','修改待发起评级申请',['M01-06']);const row=await openOwned(r);assert.equal(row.bsnSt,'1');await r.inventory();await back(r);await end(r);}
export async function detail(page){const r=await begin(page,'M01-08','查看评级详情只读控制',['M01-08']);await openOwned(r,'main','查看详情');const inv=await r.inventory();assert.ok(inv.fields.length>10);const editable=inv.fields.filter(f=>f.controls.some(c=>!c.disabled&&!c.readOnly));r.checks.push({transaction:r.id,name:'详情只读盘点',editable});if(editable.length)r.documentFindings.push({requirement:'详情全部数据项只读',observed:editable});await back(r);await end(r);}
