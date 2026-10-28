import fs from 'node:fs';import path from 'node:path';
const out=path.join(import.meta.dirname,'atp-project13-system110-20261013');
const token=fs.readFileSync(process.argv[2],'utf8').trim();
const base='http://test.atp.tansun.com.cn/api';
async function request(method,url,body){const response=await fetch(base+url,{method,headers:{access_token:token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});const data=await response.json();if(!response.ok||data.code!==200)throw Error('目标核验未成功 code='+data.code);return data;}
const projects=await request('POST','/system/systemproject/list',{});
const systems=await request('GET','/system/system/lazySystemTree?projectId=13&menuType=1&from=0&searchName=');
const walk=value=>Array.isArray(value)?value.flatMap(walk):value&&typeof value==='object'?[value,...Object.values(value).filter(x=>x&&typeof x==='object').flatMap(walk)]:[];
const project=walk(projects.rows||projects.data).find(x=>String(x.id)==='13');
let system=walk(systems.data||systems.rows).find(x=>String(x.id)==='110');
const expansion=[];
if(!system){const chain=[];let cursor='110';const roots=new Set(walk(systems.data||systems.rows).map(x=>String(x.id)));
 for(let depth=0;!roots.has(cursor)&&depth<20;depth++){const info=await request('GET','/system/system/getInfo/'+cursor);if(String(info.data?.id)!==cursor||!info.data.parentId)throw Error('系统父链无法确认');chain.unshift({id:cursor,parentId:String(info.data.parentId)});cursor=String(info.data.parentId);}
 if(!roots.has(cursor))throw Error('系统父链未连接至项目授权根目录');
 for(const link of chain){const children=await request('GET','/system/system/lazySystemTree?projectId=13&menuType=1&from=0&searchName=&parentId='+encodeURIComponent(link.parentId));const actual=walk(children.data||children.rows).find(x=>String(x.id)===link.id);if(!actual)throw Error('项目目录未列出父链子节点 '+link.id);expansion.push({parentId:link.parentId,children});if(link.id==='110')system=actual;}}
if(!project||!system){fs.writeFileSync(path.join(out,'target-directory-response.json'),JSON.stringify({projects,systems},null,2));throw Error('目标目录字段待核对');}
const result={checkedAt:new Date().toISOString(),projectId:'13',systemId:'110',project,system,expansion};
fs.writeFileSync(path.join(out,'target-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({projectId:'13',systemId:'110',projectName:project.projectName||project.name||project.label,systemName:system.systemName||system.name||system.label,authorizedDirectoryCheck:true}));
