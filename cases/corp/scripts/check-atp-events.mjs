import fs from 'node:fs';import path from 'node:path';const out=path.join(import.meta.dirname,'atp-project13-system110-20261013');
const token=fs.readFileSync(process.argv[2],'utf8').trim();
const response=await fetch('http://test.atp.tansun.com.cn/api/transaction/transcationproperties/getEventType?testFrame=playwright',{headers:{access_token:token},signal:AbortSignal.timeout(30000)});
const data=await response.json();if(!response.ok||data.code!==200)throw Error('事件字典读取未成功');fs.writeFileSync(path.join(out,'event-types.json'),JSON.stringify(data,null,2));
const flat=ns=>(ns||[]).flatMap(n=>[n,...flat(n.children)]);console.log(JSON.stringify(flat(data.data||data.rows).map(x=>({id:x.id,name:x.eventTypeName,value:x.eventTypeValue,frame:x.transcationType})),null,2));
