const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const official='C:/Users/longpeng/.codex/skills/atp-v3-push/scripts/atp-v3.mjs';
const out=path.join(__dirname,'atp-project13-system110-20261013');
const original=fs.readFileSync(official,'utf8');
const guard="const systems=await request('GET','/system/system/lazySystemTree?projectId='+state.projectId+'&menuType=1&from=0&searchName=');if(!walk(systems.data||systems.rows).some(s=>String(s.id)===state.systemId))throw Error('系统 ID 不在目标项目树中');";
const expanded=`const systems=await request('GET','/system/system/lazySystemTree?projectId='+state.projectId+'&menuType=1&from=0&searchName=');
 const rootIds=new Set(walk(systems.data||systems.rows).map(s=>String(s.id)));
 if(!rootIds.has(state.systemId)){
  const chain=[],visited=new Set();let cursor=state.systemId;
  while(!rootIds.has(cursor)){
   if(visited.has(cursor)||chain.length>=20)throw Error('系统父链无效');visited.add(cursor);
   const info=await request('GET','/system/system/getInfo/'+encodeURIComponent(cursor));
   if(String(info.data?.id)!==cursor||!info.data.parentId)throw Error('系统父链无法确认');
   chain.unshift({id:cursor,parentId:String(info.data.parentId)});cursor=String(info.data.parentId);
  }
  for(const link of chain){
   const children=await request('GET','/system/system/lazySystemTree?projectId='+state.projectId+'&menuType=1&from=0&searchName=&parentId='+encodeURIComponent(link.parentId));
   if(!walk(children.data||children.rows).some(s=>String(s.id)===link.id))throw Error('系统 ID 不在目标项目树中');
  }
 }`;
if(!original.includes(guard))throw Error('官方脚本守卫位置不符，未生成适配器');
let adapted=original.replace(guard,expanded);
const head='let check;try{check=await fetch(url';
const publicHead="const returnedUrl=new URL(url);if(/^(?:10\\.|192\\.168\\.|172\\.(?:1[6-9]|2\\d|3[01])\\.)/.test(returnedUrl.hostname))url=new URL(returnedUrl.pathname+returnedUrl.search,new URL(state.base).origin).href;let check;try{check=await fetch(url";
if(!adapted.includes(head))throw Error('截图链接验证位置不符');
adapted=adapted.replace(head,publicHead);
fs.writeFileSync(path.join(out,'atp-lazy-tree.mjs'),adapted);
fs.writeFileSync(path.join(out,'adapter-provenance.json'),JSON.stringify({official,officialSha256:crypto.createHash('sha256').update(original).digest('hex'),adaptedSha256:crypto.createHash('sha256').update(adapted).digest('hex'),change:'Expand documented lazy system tree with parentId, checking every parent-child membership. For private backend screenshot URLs use the platform origin with the same pathname before validating accessibility, as required by the skill contract. Target IDs, API payload, submit-once markers, no-retry policy and verification remain unchanged.',contract:'api-contract.json: lazySystemTree GET parentId; skill references/contract.md: internal upload URL mapping',confirmedTarget:'target-check.json: project 13 智能化2.0 / system 110 对公客户管理'},null,2));
console.log(JSON.stringify({adapterPrepared:true,officialUnchanged:true}));
