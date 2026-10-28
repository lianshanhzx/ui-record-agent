const fs=require('node:fs'),path=require('node:path');const out=path.join(__dirname,'atp-project13-system110-20261013'),push=path.join(out,'push-all'),dir=path.join(out,'repairs');fs.mkdirSync(dir,{recursive:true});
const payload=JSON.parse(fs.readFileSync(path.join(push,'payload.json'))).transcationEventTypeList;
const details=JSON.parse(fs.readFileSync(path.join(push,'remote-details.json')));
const verification=JSON.parse(fs.readFileSync(path.join(push,'verification.json')));
const flat=nodes=>(nodes||[]).flatMap(n=>[n,...flat(n.children)]);
const sorts=[],options=[];
for(const expected of payload){const actual=details.find(x=>x.transcationName===expected.transcationName);if(!actual)throw Error('缺少交易反查');const nodes=flat(actual.transcationProperties);if(!nodes.length)continue;
 if(nodes.length!==expected.transcationProperties.length)throw Error('非空交易节点数量不符');
 if(JSON.stringify([...nodes].sort((a,b)=>a.sort-b.sort).map(n=>n.propertiesID))!==JSON.stringify(expected.transcationProperties.map(n=>n.propertiesID)))sorts.push({id:actual.id,name:actual.transcationName,method:'POST',url:'/transaction/transcationproperties/sort',body:{transcationId:actual.id,propertiesNames:expected.transcationProperties.map(n=>n.propertiesName)}});
 for(const p of expected.transcationProperties){const n=nodes.find(x=>x.propertiesID===p.propertiesID);if(p.eventTypeValue==='select:click'&&(n.options||'')!==p.options){if(n.transcationEventType?.eventTypeValue!=='select:click'||n.transcationEventType.transcationType!=='playwright')throw Error('下拉事件关联不完整');const body={...n,options:p.options};delete body.children;options.push({transactionId:actual.id,name:actual.transcationName,node:p.propertiesID,id:n.id,method:'PUT',url:'/transaction/transcationproperties/edit',body});}}
}
const empty=details.find(x=>x.transcationName.startsWith('R09 '));if(!empty||String(empty.id)!=='1228'||flat(empty.transcationProperties).length)throw Error('待重建R09不是已确认空交易');
const originalR09=payload.find(x=>x.transcationName===empty.transcationName);
fs.writeFileSync(path.join(dir,'R09-empty-preimage.json'),JSON.stringify(empty,null,2));
fs.writeFileSync(path.join(dir,'R09-rebuild-payload.json'),JSON.stringify({transcationEventTypeList:[originalR09]},null,2));
fs.mkdirSync(path.join(out,'input-R09-rebuild'),{recursive:true});fs.copyFileSync(path.join(out,'input-all-safe/R009.json'),path.join(out,'input-R09-rebuild/R009.json'));
const plan={preparedAt:new Date().toISOString(),projectId:'13',systemId:'110',authorization:'User requested syncing these verified transactions and explicitly authorized screenshots and transaction sync. Recovery is limited to completing this task\u2019s newly created records; prior existing records are excluded.',emptyRebuild:{id:'1228',name:empty.transcationName,confirmedNodes:0,deleteMethod:'POST',deleteUrl:'/demand/demandtranscation/remove',deleteBody:{idList:['1228']},rebuildNodes:45},sortTransactions:sorts,optionUpdates:options,fileChooserDependency:{transactions:['R162','R176'],reason:'ATP Playwright event dictionary has no file:choose action. Do not silently replace it with click.'},scope:'Only records created by this sync; no other transactions, no execution plan, no global event dictionary changes.'};
fs.writeFileSync(path.join(dir,'repair-plan.json'),JSON.stringify(plan,null,2));
fs.writeFileSync(path.join(dir,'README.md'),`# 本次导入修复待授权方案\n\n项目13 / 对公客户管理目录110。\n\n1. 再次确认本次新建 R09（ID1228）仍为0节点后，仅删除此空记录；保留反查快照，按已准备且名称合规的45节点报文重建。\n2. 按原录制顺序校正 ${sorts.length} 笔本次新建交易；只调用官方排序接口，保留父子关系、定位和填充值。\n3. 尝试补写 ${options.length} 个本次节点的下拉选项，并保留原事件对象；逐项复查，接口200不替代保存验证。R09重建后另查其6个下拉选项。\n\n2个影像上传节点的 file:choose 动作不在平台 Playwright 字典中，不降级成普通点击。需要平台提供对应动作支持，当前修复不修改全局字典。\n\n完整请求、实际ID及值见 repair-plan.json。尚未修改这些已写入记录。\n`);
console.log(JSON.stringify({emptyTransaction:'1228',rebuildNodes:45,sortTransactions:sorts.length,optionUpdates:options.length,unsupportedUploadActions:2}));
