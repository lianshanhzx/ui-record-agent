import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const DEFAULT_PLATFORM='http://test.atp.tansun.com.cn/';

export const hash=x=>crypto.createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2));
const flat=ns=>(ns||[]).flatMap(n=>[n,...flat(n.children)]);
const idOK=x=>/^\d+$/.test(String(x))&&BigInt(x)>0n&&BigInt(x)<=9223372036854775807n;
function rectOK(v){try{const r=typeof v==='string'?JSON.parse(v):v;return ['x1','y1','x2','y2'].every(k=>Number.isFinite(r?.[k])&&r[k]>=0&&r[k]<=1)&&r.x1<r.x2&&r.y1<r.y2;}catch{return false;}}
function apiBase(v){const u=new URL(v);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw Error('平台地址须为无凭据的 HTTP(S) 根地址或 /api 地址');const pathname=u.pathname.replace(/\/$/,'');if(!['','/api'].includes(pathname))throw Error('平台地址路径只支持根路径或 /api');return u.origin+'/api';}
const isURL=v=>/^https?:\/\//i.test(v);
function sourceFiles(input){const p=path.resolve(input);const files=fs.statSync(p).isDirectory()?fs.readdirSync(p).filter(f=>f.endsWith('.json')).sort().map(f=>path.join(p,f)):[p];return files.map(file=>({file,data:read(file)})).filter(x=>Array.isArray(x.data.transcationEventTypeList));}

export function build(state){
 const blockers=[],shots=[],entries=[],seenNames=new Set();
 const inventory=state.config.inventoryFile?read(state.config.inventoryFile):{};
 for(const src of state.sources){for(const t of src.data.transcationEventTypeList){
  const name=String(t.transcationName||'').replace(/[\\/:*?"<>|']/g,'_');if(!name||seenNames.has(name))throw Error('交易名称为空或重复：'+name);seenNames.add(name);
  const nodes=flat(t.transcationProperties);const byID=new Map(nodes.map(n=>[String(n.propertiesID),n]));
  if(!nodes.length||byID.size!==nodes.length||nodes.some(n=>!n.propertiesID))throw Error('节点 ID 缺失、重复或交易无节点：'+name);
  const owner=n=>{const seen=new Set();let q=n;while(q&&q.type!=='page'&&q.type!=='popup'){const id=String(q.propertiesID);if(seen.has(id))throw Error('父节点循环：'+name);seen.add(id);q=byID.get(String(q.propertiesPID));}return q;};
  for(const p of nodes)if(!owner(p))throw Error('节点缺页面或弹窗容器：'+name+' #'+p.propertiesID);
  const properties=nodes.map(p=>{
   const n=Object.fromEntries(['propertiesName','eventTypeValue','elementType','mothed','options','objectValue','type','propertiesID','propertiesPID','realLabel','rect'].map(k=>[k,p[k]??'']));
   for(const k of ['propertiesID','propertiesPID','objectValue'])n[k]=String(n[k]);
   if(!n.propertiesName||!n.type||!n.eventTypeValue)blockers.push(name+' #'+n.propertiesID+' 缺名称/类型/事件');
   if(n.type==='page'){n.propertiesPID='0';n.rect='';}
   else if(n.type==='popup'){
    let q=byID.get(n.propertiesPID);const seen=new Set();while(q&&q.type!=='page'){if(seen.has(String(q.propertiesID)))throw Error('父节点循环');seen.add(String(q.propertiesID));q=byID.get(String(q.propertiesPID));}if(!q)throw Error('弹窗缺所属页面：'+name);n.propertiesPID=String(q.propertiesID);
    const override=state.config.popupRects?.[t.transcationName+'#'+n.propertiesID];if(override)n.rect=typeof override==='string'?override:JSON.stringify(override);
   }else if(!byID.has(n.propertiesPID))throw Error('控件缺父节点：'+name+' #'+n.propertiesID);
   if(n.type!=='page'&&!rectOK(n.rect))blockers.push(name+' #'+n.propertiesID+' 缺有效完整截图坐标 rect');
   if(n.type==='page'||n.type==='popup'){
    const captures=String(p.screenCapture||'').split(',').map(x=>x.trim()).filter(Boolean);if(!captures.length)blockers.push(name+' #'+n.propertiesID+' 缺截图');
    const urls=captures.map(c=>{const local=isURL(c)?null:path.resolve(state.config.sourceRoot||state.sourceRoot,c);const url=isURL(c)?c:(state.config.screenshotUrls?.[c]||state.config.screenshotUrls?.[local]||state.config.screenshotUrls?.[local?.replaceAll('\\','/')]||'');shots.push({transaction:name,propertiesID:n.propertiesID,local,url});if(!isURL(url))blockers.push(name+' #'+n.propertiesID+' 截图未上传');return url;});n.screenCapture=urls.join(',');
   }else if(/label\[contains\(@class,'el-radio'\)\]/.test(n.elementType))n.eventTypeValue='radio';
   if(n.eventTypeValue==='select:click'&&!n.options){const list=inventory[owner(p)?.type==='popup'?'customer':'main']?.find(f=>f.label===p.realLabel)?.options;if(list)n.options=JSON.stringify([...new Set(list)].filter(v=>v&&v!=='请选择'));}
   if(Array.isArray(n.options))n.options=JSON.stringify(n.options);
   if(n.eventTypeValue==='select:click'){try{if(!Array.isArray(JSON.parse(n.options)))throw Error();}catch{blockers.push(name+' #'+n.propertiesID+' 缺真实下拉 options 数组');}}
   return n;
  });
  const counts=new Map();for(const p of properties)counts.set(p.propertiesName,(counts.get(p.propertiesName)||0)+1);for(const p of properties)if(counts.get(p.propertiesName)>1)p.propertiesName+='（步骤'+p.propertiesID+'）';
  if(new Set(properties.map(p=>p.propertiesName)).size!==properties.length)throw Error('步骤名称仍重复：'+name);
  const key=src.file+'#'+t.transcationName;
  if(!state.importIds[key]){const provided=state.config.trajectoryIds?.[t.transcationName]||t.transcId;state.importIds[key]=idOK(provided)?String(provided):String(BigInt('0x'+crypto.randomBytes(6).toString('hex'))+1n);}
  entries.push({transcId:state.importIds[key],pageId:t.pageId||'',transcationName:name,projectId:state.projectId,systemId:state.systemId,transcationType:'web',testFrame:'playwright',transcationProperties:properties});
 }}
 if(new Set(entries.map(e=>e.transcId)).size!==entries.length)throw Error('重复导入标识');
 return{payload:{transcationEventTypeList:entries},shots,preflight:{ready:!blockers.length,projectId:state.projectId,systemId:state.systemId,transactions:entries.length,nodes:entries.reduce((s,e)=>s+e.transcationProperties.length,0),screenshots:shots.length,blockers}};
}

export function compare(entries,details){
 const failures=[],optionDifferences=[],transactions=[];
 for(const e of entries){const matches=details.filter(d=>d.transcationName===e.transcationName);if(matches.length!==1){failures.push(e.transcationName+' 匹配数量 '+matches.length);continue;}const d=matches[0],nodes=flat(d.transcationProperties);
  if(String(d.projectId)!==e.projectId||String(d.systemId)!==e.systemId||d.testFrame!=='playwright'||nodes.length!==e.transcationProperties.length)failures.push(e.transcationName+' 交易属性/节点数不匹配');
  for(const p of e.transcationProperties){const found=nodes.filter(n=>String(n.propertiesID)===p.propertiesID);if(found.length!==1){failures.push(e.transcationName+' #'+p.propertiesID+' 节点匹配异常');continue;}const n=found[0],parent=p.propertiesPID==='0'?'0':nodes.find(x=>String(x.propertiesID)===p.propertiesPID)?.id;
   if(String(n.propertiesPID)!==String(parent))failures.push(e.transcationName+' #'+p.propertiesID+' 父节点不匹配');
   for(const k of ['propertiesName','type','elementType','mothed','objectValue','realLabel','screenCapture'])if((n[k]??'')!==(p[k]??''))failures.push(e.transcationName+' #'+p.propertiesID+' '+k+' 不匹配');
   const rect=v=>v?JSON.stringify(Object.fromEntries(Object.entries(typeof v==='string'?JSON.parse(v):v).sort())):'';try{if(rect(n.rect)!==rect(p.rect))failures.push(e.transcationName+' #'+p.propertiesID+' rect 不匹配');}catch{failures.push(e.transcationName+' #'+p.propertiesID+' rect 无效');}
   if(n.operationType!==p.eventTypeValue||n.transcationEventType?.eventTypeValue!==p.eventTypeValue||n.transcationEventType?.transcationType!=='playwright')failures.push(e.transcationName+' #'+p.propertiesID+' 事件/框架不匹配');
   const options=v=>{if(!v)return'';try{return JSON.stringify(JSON.parse(v));}catch{return v;}};if(options(n.options)!==options(p.options))optionDifferences.push({transaction:e.transcationName,node:p.propertiesID,expected:p.options,actual:n.options??null});
  }
  if(JSON.stringify([...nodes].sort((a,b)=>a.sort-b.sort).map(n=>String(n.propertiesID)))!==JSON.stringify(e.transcationProperties.map(p=>p.propertiesID)))failures.push(e.transcationName+' 顺序不匹配');
  transactions.push({id:d.id,name:d.transcationName,expectedNodes:e.transcationProperties.length,actualNodes:nodes.length});
 }
 return{time:new Date().toISOString(),structureAndActionsPassed:!failures.length,allFieldsPassed:!failures.length&&!optionDifferences.length,platformExecutionVerified:false,transactions,failures,optionDifferences};
}

export async function run(args){
 const [mode,...argv]=args,opts={};if(mode==='--help'||!mode){console.log('prepare --input FILE|DIR --out DIR --project-id ID --system-id ID [--platform URL] [--config JSON]\nupload|push|verify --out DIR [--token-file FILE] [--only TRANSACTION_NAME]\n默认平台 '+DEFAULT_PLATFORM+'；--platform 可覆盖。\n认证环境变量 ATP_ACCESS_TOKEN；不自动重试、不修改或删除已有交易。');return;}
 if(!['prepare','upload','push','verify'].includes(mode))throw Error('未知命令 '+mode);
 const allowed=new Set(['input','out','project-id','system-id','platform','config','token-file','only']);for(let i=0;i<argv.length;i+=2){const key=argv[i]?.slice(2);if(!argv[i]?.startsWith('--')||!allowed.has(key)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error('无效参数 '+argv[i]);opts[key]=argv[i+1];}
 if(!opts.out)throw Error('必须传入 --out');const out=path.resolve(opts.out);fs.mkdirSync(out,{recursive:true});const stateFile=path.join(out,'manifest.json');
 let state;
 if(mode==='prepare'){
  if(!opts.input||!idOK(opts['project-id'])||!idOK(opts['system-id']))throw Error('prepare 必须传入 input、有效 project-id 和 system-id');
  const config=opts.config?read(opts.config):{};if(['token','access_token','tokenFile'].some(k=>k in config))throw Error('附加配置不得包含凭据');
  for(const k of ['sourceRoot','inventoryFile'])if(config[k])config[k]=path.resolve(config[k]);
  const sources=sourceFiles(opts.input);if(!sources.length)throw Error('没有找到 wire envelope');for(const src of sources)src.sha256=hash(fs.readFileSync(src.file));
  const initial={version:1,projectId:opts['project-id'],systemId:opts['system-id'],base:apiBase(opts.platform||DEFAULT_PLATFORM),sourceRoot:process.cwd(),sources,config,importIds:{}};
  if(fs.existsSync(stateFile)){const old=read(stateFile);if(old.projectId!==initial.projectId||old.systemId!==initial.systemId||(old.base||apiBase(DEFAULT_PLATFORM))!==initial.base||JSON.stringify(old.sources.map(s=>s.sha256))!==JSON.stringify(sources.map(s=>s.sha256)))throw Error('输出目录已属于不同输入或目标，请使用新目录');initial.importIds=old.importIds;initial.config.screenshotUrls={...old.config.screenshotUrls,...config.screenshotUrls};}
  state=initial;
 }else{state=read(stateFile);state.base ||= apiBase(DEFAULT_PLATFORM);for(const[k,field]of [['project-id','projectId'],['system-id','systemId']])if(opts[k]&&opts[k]!==state[field])throw Error('目标与 manifest 不一致，请新建输出目录');if(opts.platform&&apiBase(opts.platform)!==state.base)throw Error('平台与 manifest 不一致');}
 function generate(){const built=build(state);save(stateFile,state);save(path.join(out,'payload.draft.json'),built.payload);save(path.join(out,'preflight.json'),built.preflight);save(path.join(out,'screenshots.json'),built.shots);const p=path.join(out,'payload.json');if(built.preflight.ready)save(p,built.payload);else if(fs.existsSync(p))fs.unlinkSync(p);return built;}
 let built=generate();if(mode==='prepare'){console.log(JSON.stringify(built.preflight,null,2));return;}
 if(!state.base)throw Error('未配置平台地址，请在新目录 prepare --platform');
 const token=opts['token-file']?fs.readFileSync(opts['token-file'],'utf8').trim():process.env.ATP_ACCESS_TOKEN;if(!token)throw Error('缺少 ATP_ACCESS_TOKEN 或 --token-file');
 const receiptFile=path.join(out,'receipts.json'),receipts=fs.existsSync(receiptFile)?read(receiptFile):[];
 const record=x=>{receipts.push({time:new Date().toISOString(),...x});save(receiptFile,receipts);};
 async function request(method,url,body){let r;try{r=await fetch(state.base+url,{method,headers:{access_token:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const text=await r.text();let data;try{data=JSON.parse(text);}catch{throw Error('接口返回非 JSON');}record({method,url,httpStatus:r.status,data});if(!r.ok||data.code!==200){const e=Error('接口未确认成功：'+method+' '+url+' code='+data.code);e.apiData=data;throw e;}return data;}catch(e){if(!r)record({method,url,error:e.name});throw e;}}
 const entries=opts.only?built.payload.transcationEventTypeList.filter(e=>e.transcationName===opts.only):built.payload.transcationEventTypeList;if(!entries.length)throw Error('--only 没有匹配交易');
 async function list(){const rows=[];for(let page=1;page<=1000;page++){const d=await request('POST','/demand/demandtranscation/list?pageNum='+page+'&pageSize=100',{projectId:state.projectId,systemId:state.systemId,path:state.systemId,nodeType:1,systemIdList:[state.systemId],params:{},transcationType:'web',testFrame:'playwright'});if(!Array.isArray(d.rows)||!Number.isFinite(Number(d.total)))throw Error('列表响应缺 rows/total');rows.push(...d.rows);if(rows.length>=Number(d.total))return rows;if(!d.rows.length)throw Error('列表分页提前结束');}throw Error('列表超过分页上限');}
 async function verify(){const rows=await list(),details=[];for(const row of rows.filter(r=>entries.some(e=>e.transcationName===r.transcationName))){const d=await request('GET','/demand/demandtranscation/getInfo/'+encodeURIComponent(row.id));details.push(d.data);}save(path.join(out,'remote-details.json'),details);const result=compare(entries,details);save(path.join(out,'verification.json'),result);console.log(JSON.stringify(result,null,2));return result;}
 if(mode==='verify'){const report=await verify();if(!report.allFieldsPassed)process.exitCode=2;return;}
 if(mode==='upload'){
  for(const shot of built.shots){if(shot.url)continue;if(!shot.local||!fs.existsSync(shot.local))throw Error('本地截图不存在：'+shot.local);const cached=state.config.screenshotUrls?.[shot.local];if(cached)continue;
   const ext=path.extname(shot.local).toLowerCase(),mime={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];if(!mime)throw Error('只支持 PNG/JPEG 截图');const form=new FormData();form.append('file',new Blob([fs.readFileSync(shot.local)],{type:mime}),path.basename(shot.local));
   const r=await fetch(state.base+'/common/upload',{method:'POST',headers:{access_token:token},body:form,signal:AbortSignal.timeout(30000)});const d=await r.json();record({method:'POST',url:'/common/upload',local:shot.local,httpStatus:r.status,data:d});if(!r.ok||d.code!==200)throw Error('截图上传失败');
   let url=d.url||d.data?.url||d.data?.fileUrl||(typeof d.data==='string'?d.data:null);if(!url||!isURL(url))throw Error('上传响应缺截图 URL');if(/[?&](?:X-Amz-|Expires=|expiration=|sig=)/i.test(url))throw Error('截图 URL 可能带临时签名，先确认永久地址');
   let check;try{check=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(10000)});}catch{}
   if(!check?.ok||!String(check.headers.get('content-type')).startsWith('image/')){const u=new URL(url);url=new URL(u.pathname+u.search,new URL(state.base).origin).href;check=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(15000)});}
   if(!check.ok||!String(check.headers.get('content-type')).startsWith('image/'))throw Error('截图 URL 未通过可访问检查');state.config.screenshotUrls??={};state.config.screenshotUrls[shot.local]=url;save(stateFile,state);
  }built=generate();console.log(JSON.stringify(built.preflight,null,2));return;
 }
 if(!built.preflight.ready)throw Error('预检未通过，查看 preflight.json');
 const projects=await request('POST','/system/systemproject/list',{});const walk=v=>Array.isArray(v)?v.flatMap(walk):v&&typeof v==='object'?[v,...Object.values(v).filter(x=>x&&typeof x==='object').flatMap(walk)]:[];
 if(!walk(projects.rows||projects.data).some(p=>String(p.id)===state.projectId))throw Error('项目 ID 不在已授权项目目录');
 const systems=await request('GET','/system/system/lazySystemTree?projectId='+state.projectId+'&menuType=1&from=0&searchName=');if(!walk(systems.data||systems.rows).some(s=>String(s.id)===state.systemId))throw Error('系统 ID 不在目标项目树中');
 const before=await list();save(path.join(out,'before-push.json'),before);if(before.some(r=>entries.some(e=>e.transcationName===r.transcationName)))throw Error('目标已有同名交易，停止推送并先核对');
 for(const shot of built.shots.filter(s=>entries.some(e=>e.transcationName===s.transaction))){const r=await fetch(shot.url,{method:'HEAD',signal:AbortSignal.timeout(15000)});if(!r.ok||!String(r.headers.get('content-type')).startsWith('image/'))throw Error('截图 URL 不可访问');}
 const body={transcationEventTypeList:entries},marker=path.join(out,'attempt-'+hash(body)+'.json');if(fs.existsSync(marker))throw Error('这份报文已尝试提交，须先反查；脚本不自动重试');save(marker,{time:new Date().toISOString(),target:state.base,hash:hash(body),status:'started'});
 let pushError;try{const response=await request('POST','/demand/demandtranscation/importDemand',body);save(marker,{time:new Date().toISOString(),hash:hash(body),status:'acknowledged',response});}catch(e){pushError=e;save(marker,{time:new Date().toISOString(),hash:hash(body),status:'unconfirmed',error:e.message});}
 let result;try{result=await verify();}catch(e){record({phase:'verification',error:e.message});throw Error('提交后反查失败；保留请求标记，不得盲目重试');}
 if(pushError)throw Error(pushError.message+'；已保存反查结果，可能存在部分写入');if(!result.allFieldsPassed)process.exitCode=2;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.argv.slice(2)).catch(e=>{console.error(e.message);process.exitCode=1;});
