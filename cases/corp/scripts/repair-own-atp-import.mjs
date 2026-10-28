import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const out=path.join(import.meta.dirname,'atp-project13-system110-20261013'),dir=path.join(out,'repairs');
const [mode,tokenFile]=process.argv.slice(2),token=fs.readFileSync(tokenFile,'utf8').trim();
const plan=JSON.parse(fs.readFileSync(path.join(dir,'repair-plan.json'),'utf8'));
const receiptsFile=path.join(dir,'receipts.json'),receipts=fs.existsSync(receiptsFile)?JSON.parse(fs.readFileSync(receiptsFile)):[];
const flat=ns=>(ns||[]).flatMap(n=>[n,...flat(n.children)]);
async function request(method,url,body){
 const response=await fetch('http://test.atp.tansun.com.cn/api'+url,{method,headers:{access_token:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const data=await response.json();receipts.push({time:new Date().toISOString(),method,url,body,httpStatus:response.status,data});fs.writeFileSync(receiptsFile,JSON.stringify(receipts,null,2));
 if(!response.ok||data.code!==200)throw Error('接口未确认成功 '+method+' '+url+' code='+data.code);return data;
}
async function mutate(method,url,body){const key=crypto.createHash('sha256').update(JSON.stringify({method,url,body})).digest('hex');const marker=path.join(dir,'attempt-'+key+'.json');if(fs.existsSync(marker))throw Error('此修复请求已经尝试，须先反查而非重试');fs.writeFileSync(marker,JSON.stringify({time:new Date().toISOString(),method,url,status:'started'}));const response=await request(method,url,body);fs.writeFileSync(marker,JSON.stringify({time:new Date().toISOString(),method,url,status:'acknowledged',code:response.code}));return response;}
function assertOwnTrade(actual,expectedId,expectedName){if(String(actual?.id)!==String(expectedId)||actual.transcationName!==expectedName||String(actual.projectId)!=='13'||String(actual.systemId)!=='110')throw Error('交易ID、名称或目标归属不符');}
if(mode==='empty'){
 const t=plan.emptyRebuild;const before=(await request('GET','/demand/demandtranscation/getInfo/'+t.id)).data;assertOwnTrade(before,t.id,t.name);
 if(flat(before.transcationProperties).length!==0)throw Error('空交易已发生变化，停止清理');
 if(before.createTime&&!before.createTime.startsWith('2026-10-13'))throw Error('不是本次导入日期创建的记录');
 fs.writeFileSync(path.join(dir,'R09-immediate-preimage.json'),JSON.stringify(before,null,2));
 await mutate(t.deleteMethod,t.deleteUrl,t.deleteBody);
 const list=await request('POST','/demand/demandtranscation/list?pageNum=1&pageSize=1000',{projectId:'13',systemId:'110',path:'110',nodeType:1,systemIdList:['110'],params:{},transcationType:'web',testFrame:'playwright'});
 if(list.rows.some(x=>x.transcationName===t.name))throw Error('清理后同名记录仍存在，禁止重建');
 console.log(JSON.stringify({removedOwnEmptyTransaction:t.id,remainingSameName:0,preimageArchived:true}));
}else if(mode==='sort'){
 const completed=[];
 for(const t of plan.sortTransactions){const before=(await request('GET','/demand/demandtranscation/getInfo/'+t.id)).data;assertOwnTrade(before,t.id,t.name);const names=flat(before.transcationProperties).map(x=>x.propertiesName);if(names.length!==t.body.propertiesNames.length||t.body.propertiesNames.some(x=>!names.includes(x)))throw Error('排序对象集合已变化');await mutate(t.method,t.url,t.body);const after=(await request('GET','/demand/demandtranscation/getInfo/'+t.id)).data;const got=flat(after.transcationProperties).sort((a,b)=>a.sort-b.sort).map(n=>n.propertiesName);const ok=JSON.stringify(got)===JSON.stringify(t.body.propertiesNames);completed.push({id:t.id,name:t.name,passed:ok});if(!ok){fs.writeFileSync(path.join(dir,'sort-results.json'),JSON.stringify(completed,null,2));throw Error('排序接口未按原顺序持久化，停止后续修改');}}
 fs.writeFileSync(path.join(dir,'sort-results.json'),JSON.stringify(completed,null,2));console.log(JSON.stringify({sorted:completed.length,passed:completed.every(x=>x.passed)}));
}else if(mode==='options-probe'){
 const t=plan.optionUpdates[0];const before=(await request('GET','/demand/demandtranscation/getInfo/'+t.transactionId)).data;assertOwnTrade(before,t.transactionId,t.name);
 const current=flat(before.transcationProperties).find(n=>String(n.id)===t.id);if(!current||current.propertiesID!==t.node||current.transcationEventType?.eventTypeValue!=='select:click')throw Error('下拉节点关联已变化');
 const body={...current,options:t.body.options};delete body.children;await mutate(t.method,t.url,body);
 const after=(await request('GET','/demand/demandtranscation/getInfo/'+t.transactionId)).data;const actual=flat(after.transcationProperties).find(n=>String(n.id)===t.id);
 const result={transactionId:t.transactionId,nodeId:t.id,expected:t.body.options,actual:actual.options,persisted:actual.options===t.body.options,eventAssociationPreserved:JSON.stringify(actual.transcationEventType)===JSON.stringify(current.transcationEventType),otherCoreFieldsPreserved:['propertiesName','operationType','objectValue','elementType','mothed','type','propertiesPID','propertiesID','realLabel','rect','screenCapture','sort'].every(k=>actual[k]===current[k])};
 fs.writeFileSync(path.join(dir,'options-probe-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({persisted:result.persisted,eventAssociationPreserved:result.eventAssociationPreserved,otherCoreFieldsPreserved:result.otherCoreFieldsPreserved}));
}else throw Error('Unknown repair mode');
