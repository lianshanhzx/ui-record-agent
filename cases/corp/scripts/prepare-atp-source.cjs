const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const run=__dirname,root=path.resolve(run,'../..'),out=path.join(run,'atp-project13-system110-20261013');
fs.mkdirSync(path.join(out,'input'),{recursive:true});
const results=JSON.parse(fs.readFileSync(path.join(run,'replay-summary.json'))).latestResults;
const chosen=results.filter(x=>x.status==='pass').sort((a,b)=>Number(a.file.slice(1))-Number(b.file.slice(1)));
const queue=[],sources=[],errors=[],optionProvenance=[],pool=[];let selectCount=0;
for(const result of chosen){const record=JSON.parse(fs.readFileSync(path.join(run,result.file+'-recording.json')));for(const s of record.steps.filter(x=>x.eventTypeValue==='select:click')){const n=record.evidence.find(x=>x.name===s.propertiesName+'选项'&&Array.isArray(x.value)&&x.value.includes(s.objectValue));if(n)pool.push({id:result.file,step:s.propertiesID,xpath:s.elementType,label:s.realLabel,values:n.value});}}
for(const result of chosen){
 const id=result.file,file=path.join(root,'partner-wire/corp',id+'.json'),content=fs.readFileSync(file),wire=JSON.parse(content);
 const record=JSON.parse(fs.readFileSync(path.join(run,id+'-recording.json')));
 const notes=record.evidence.filter(x=>x.name.endsWith('选项')&&Array.isArray(x.value));
 const txn=wire.transcationEventTypeList[0];
 for(const step of txn.transcationProperties){
  if(step.type==='popup')queue.push({key:txn.transcationName+'#'+step.propertiesID,id,step:step.propertiesID,name:step.propertiesName,shot:step.screenCapture,openerRect:txn.transcationProperties.find(x=>x.propertiesID===step.propertiesPID)?.rect});
  if(step.eventTypeValue==='select:click'){
   const index=notes.findIndex(x=>x.name===step.propertiesName+'选项'&&x.value.includes(step.objectValue));
   const sameAddressDistrict=step.realLabel==='区/县'&&txn.transcationProperties.find(x=>x.propertiesID===step.propertiesPID)?.propertiesName.startsWith('客户地址选择器');
   const fallback=pool.find(x=>x.xpath===step.elementType&&x.label===step.realLabel&&x.values.includes(step.objectValue))||(sameAddressDistrict?pool.find(x=>x.label==='区/县'&&x.values.includes(step.objectValue)):null);
   if(index<0&&!fallback){errors.push(id+' #'+step.propertiesID+' 未找到真实下拉选项');continue;}
   const note=index>=0?notes.splice(index,1)[0]:{value:fallback.values};
   const values=[...new Set(note.value.map(x=>String(x).trim()).filter(Boolean))];
   optionProvenance.push({id,step:step.propertiesID,source:index>=0?id:fallback.id,sourceStep:index>=0?step.propertiesID:fallback.step,exactLocatorReuse:index<0});
   if(!values.includes(step.objectValue))errors.push(id+' #'+step.propertiesID+' 回填值不在实际选项中');
   step.options=JSON.stringify(values);selectCount++;
  }
 }
 const copy='R'+id.slice(1).padStart(3,'0')+'.json';fs.writeFileSync(path.join(out,'input',copy),JSON.stringify(wire,null,2));
 sources.push({id,file,sha256:crypto.createHash('sha256').update(content).digest('hex'),copy,latestReplayStatus:result.status,report:result.report});
}
fs.writeFileSync(path.join(out,'popup-queue.json'),JSON.stringify(queue,null,2));
fs.writeFileSync(path.join(out,'source-selection.json'),JSON.stringify({projectId:'13',systemId:'110',sources,excluded:results.filter(x=>x.status!=='pass').map(x=>({id:x.file,status:x.status})),selectCount,optionProvenance,errors},null,2));
console.log(JSON.stringify({transactions:chosen.length,popups:queue.length,selectCount,errors}));if(errors.length)process.exitCode=1;
