const fs=require('node:fs'),path=require('node:path');
const run=__dirname,root=path.resolve(run,'../..');
const customers=JSON.parse(fs.readFileSync(path.join(run,'test-customers.json')));
const previous=process.argv.includes('--reuse')?JSON.parse(fs.readFileSync(path.join(run,'replay-input/data-refresh.json'))):null;
const stamp=previous?.stamp||Date.now();const chars='0123456789ABCDEFGHJKLMNPQRTUWXY';
const pairs=[],data={};for(const [kind,c] of Object.entries(customers)){if(c.readOnly||!c.uscc)continue;const next=previous?.data[kind]||{name:`RP_20261012_${kind}_${stamp}`,uscc:'91350'+Array.from({length:13},()=>chars[Math.floor(Math.random()*chars.length)]).join('')};data[kind]=next;pairs.push([c.name,next.name],[c.uscc,next.uscc]);}
const dir=path.join(run,process.argv.includes('--delivery')?'delivery-input':process.argv.includes('--smoke')?'replay-smoke-input':process.argv.includes('--extra')?'replay-extra-input':'replay-input');fs.mkdirSync(dir,{recursive:true});
for(const file of fs.readdirSync(dir).filter(x=>/^R\d+\.json$/.test(x)))fs.unlinkSync(path.join(dir,file));
const manifest=JSON.parse(fs.readFileSync(path.join(run,'recording-manifest.json')));
const mainIds=process.argv.includes('--extra')?new Set(fs.readdirSync(path.join(run,'replay-input')).filter(x=>/^R\d+\.json$/.test(x)).map(x=>x.replace('.json',''))):null;
const changes=[];
for(const item of manifest.filter(x=>x.status==='recorded')){
 if(process.argv.includes('--smoke')&&Number(item.id.slice(1))>11)continue;
 if(mainIds?.has(item.id)&&!['R74','R76','R77'].includes(item.id))continue;
 const source=JSON.parse(fs.readFileSync(path.join(root,'partner-wire/corp',item.id+'.json')));
 source.transcationEventTypeList[0].transcationProperties=JSON.parse(fs.readFileSync(path.join(run,item.id+'-recording.json'))).steps;
 for(const t of source.transcationEventTypeList)for(const s of t.transcationProperties){
  for(const c of Object.values(customers)){
   if(s.eventTypeValue==='input'&&s.objectValue===c.cstNo&&s.elementType.includes("='客户编号'")){s.elementType=s.elementType.replace("='客户编号'","='客户名称'");s.objectValue=c.name;s.realLabel='客户名称';changes.push({id:item.id,step:s.propertiesID,change:'服务端生成编号查询改为同一客户唯一名称查询'});}
   if(s.elementType.includes(c.cstNo))s.elementType=s.elementType.replaceAll(c.cstNo,c.name);
  }
  for(const key of ['objectValue','elementType'])for(const [before,after] of pairs)if(typeof s[key]==='string')s[key]=s[key].replaceAll(before,after);
  if(s.eventTypeValue==='input'&&s.realLabel==='资质证书编号'){s.objectValue='RP'+String(stamp).slice(-13);changes.push({id:item.id,step:s.propertiesID,change:'特殊证件号码为全局唯一；刷新已消费编号，避免软删除记录导致重复'});}
  if(s.eventTypeValue==='input'&&s.realLabel==='股票代码'){s.objectValue=String(stamp).slice(-6);changes.push({id:item.id,step:s.propertiesID,change:'刷新股票代码一次性测试值'});}
 }
 fs.writeFileSync(path.join(dir,item.id+'.json'),JSON.stringify(source,null,2));
}
fs.writeFileSync(path.join(dir,'data-refresh.json'),JSON.stringify({stamp,data,changes,note:'仅参数化本轮实录；每次执行生成新名称和统一社会信用代码。原始录制值及截图保留在 recording.json。'},null,2));
console.log(JSON.stringify({dir,files:fs.readdirSync(dir).filter(x=>/^R\d+\.json$/.test(x)).length,changes:changes.length}));
