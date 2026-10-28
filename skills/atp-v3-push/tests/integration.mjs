import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {run,compare} from '../scripts/atp-v3.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),tmp=fs.mkdtempSync(path.join(root,'.test-'));
let server;
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v)),read=p=>JSON.parse(fs.readFileSync(p));
const source=path.join(tmp,'wire.json'),out=path.join(tmp,'out'),config=path.join(tmp,'config.json');
const image=path.join(tmp,'screen.png');fs.writeFileSync(image,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cjXkAAAAASUVORK5CYII=','base64'));
const rect='{"x1":0.1,"y1":0.1,"x2":0.5,"y2":0.5}';
function wire(name){return{transcId:'TBD',transcationName:name,pageId:'PAGE',transcationProperties:[{propertiesID:'1',propertiesPID:'0',type:'page',propertiesName:'页面',eventTypeValue:'click',screenCapture:image},{propertiesID:'2',propertiesPID:'1',type:'ele',propertiesName:'查询',eventTypeValue:'click',elementType:'//button',mothed:'By.XPATH',realLabel:'查询',rect},{propertiesID:'3',propertiesPID:'2',type:'popup',propertiesName:'弹窗',eventTypeValue:'click',screenCapture:image},{propertiesID:'4',propertiesPID:'3',type:'ele',propertiesName:'状态',realLabel:'状态',eventTypeValue:'select:click',elementType:'//select',mothed:'By.XPATH',options:'["通过","待发起"]',objectValue:'通过',rect},{propertiesID:'5',propertiesPID:'1',type:'ele',propertiesName:'查询',eventTypeValue:'click',elementType:'//button',mothed:'By.XPATH',realLabel:'查询',rect}]};}
save(source,{transcationEventTypeList:[wire('查询A'),wire('查询B')]});save(config,{popupRects:{'查询A#3':JSON.parse(rect),'查询B#3':JSON.parse(rect)}});
let imported=[],posts=0,partial=false;
function remote(e,id){const nodes=e.transcationProperties.map((p,i)=>({...p,id:String(id*100+i),transcationId:String(id),sort:i+1,operationType:p.eventTypeValue,options:p.options?'':null,transcationEventType:{eventTypeValue:p.eventTypeValue,transcationType:'playwright'}}));for(const p of nodes)p.propertiesPID=p.propertiesPID==='0'?'0':nodes.find(n=>n.propertiesID===p.propertiesPID).id;const page=nodes[0];page.children=nodes.filter(n=>n.propertiesPID===page.id);for(const n of page.children)n.children=nodes.filter(c=>c.propertiesPID===n.id);return{...e,id:String(id),transcationProperties:[page]};}
try{
 server=http.createServer(async(req,res)=>{if(req.url.startsWith('/image')||req.url.startsWith('/api/profile/download/')){res.setHeader('Content-Type','image/png');res.end(fs.readFileSync(image));return;}let text='';for await(const c of req)text+=c;assert.equal(req.headers.access_token,'TEST_TOKEN');let result;
  if(req.url==='/api/common/upload')result={code:200,url:origin+'/api/profile/download/image.png'};
  else if(req.url==='/api/system/systemproject/list')result={code:200,rows:[{id:'123'}]};
  else if(req.url.startsWith('/api/system/system/lazySystemTree'))result={code:200,data:[{id:'123',children:[{id:'456'}]}]};
  else if(req.url.startsWith('/api/demand/demandtranscation/list'))result={code:200,total:imported.length,rows:imported.map(d=>({id:d.id,transcationName:d.transcationName}))};
  else if(req.url.startsWith('/api/demand/demandtranscation/getInfo/'))result={code:200,data:imported.find(d=>d.id===req.url.split('/').at(-1))};
  else if(req.url==='/api/demand/demandtranscation/importDemand'){posts++;const entries=JSON.parse(text).transcationEventTypeList;for(const e of entries){assert.equal(e.projectId,'123');assert.equal(e.systemId,'456');assert.ok(e.transcationProperties.every(n=>!('eventTypeName'in n)&&!('transcationType'in n)&&!('screenshot'in n)));}imported.push(...(partial?entries.slice(0,1):entries).map((e,i)=>remote(e,900+i)));result=partial?{code:500,msg:'部分写入'}:{code:200,msg:'同步成功'};}
  else throw Error('未期望路由 '+req.url);res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 await assert.rejects(run(['prepare','--input',source,'--out',path.join(tmp,'missing')]),/project-id/);
 const prepare=['prepare','--input',source,'--out',out,'--project-id','123','--system-id','456','--platform',origin,'--config',config];await run(prepare);assert.equal(read(path.join(out,'preflight.json')).ready,false);
 const firstIds=read(path.join(out,'manifest.json')).importIds;await run(prepare);assert.deepEqual(read(path.join(out,'manifest.json')).importIds,firstIds);
 const tokenFile=path.join(tmp,'token');fs.writeFileSync(tokenFile,'TEST_TOKEN');const auth=['--out',out,'--token-file',tokenFile];
 await run(['upload',...auth]);assert.equal(read(path.join(out,'preflight.json')).ready,true);const payload=read(path.join(out,'payload.json'));assert.equal(payload.transcationEventTypeList[0].transcationProperties[2].propertiesPID,'1');assert.equal(new Set(payload.transcationEventTypeList[0].transcationProperties.map(n=>n.propertiesName)).size,5);
 await run(['push',...auth]);let report=read(path.join(out,'verification.json'));assert.equal(report.structureAndActionsPassed,true);assert.equal(report.allFieldsPassed,false);assert.equal(report.optionDifferences.length,2);assert.equal(posts,1);process.exitCode=0;
 await assert.rejects(run(['push',...auth]),/已有同名交易/);assert.equal(posts,1);
 imported=[];await assert.rejects(run(['push',...auth]),/已尝试提交/);assert.equal(posts,1);
 const out2=path.join(tmp,'partial');partial=true;await run(prepare.map(a=>a===out?out2:a));const auth2=['--out',out2,'--token-file',tokenFile];await run(['upload',...auth2]);await assert.rejects(run(['push',...auth2]),/部分写入/);assert.equal(posts,2);report=read(path.join(out2,'verification.json'));assert.equal(report.structureAndActionsPassed,false);assert.equal(report.transactions.length,1);
 const intact=remote(payload.transcationEventTypeList[0],999);intact.transcationProperties[0].children.find(n=>n.type==='popup').children[0].options='["通过", "待发起"]';assert.equal(compare([payload.transcationEventTypeList[0]],[intact]).allFieldsPassed,true);
 for(const f of ['manifest.json','receipts.json','verification.json'])assert.ok(!fs.readFileSync(path.join(out,f),'utf8').includes('TEST_TOKEN'));
 console.log('PASS: 自定义项目/系统、稳定标识、重复动作、弹窗父子关系、截图上传、选项丢失、部分写入与禁止重试。');
}finally{if(server)await new Promise(r=>server.close(r));if(tmp.startsWith(root+path.sep+'.test-'))fs.rmSync(tmp,{recursive:true,force:true});}
