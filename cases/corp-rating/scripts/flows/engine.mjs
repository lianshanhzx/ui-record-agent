import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
// OUT/WIRES 指向录制批次产物目录（不入库），可用 RATING_OUT / RATING_WIRES 覆盖，
// 便于迁移到统一的 runs/ 目录；默认值保持历史批次路径以兼容既有脚本。
export const OUT=process.env.RATING_OUT||'work/corp-rating-full-20261019';
export const WIRES=process.env.RATING_WIRES||'partner-wire/corp-rating-full-20261019';
export const HOME='http://test.creditv5p2.tansun.com.cn/#/rtgMgt/cpctRtg/cpctRtgAplyMgtPg';
export const CUSTOMER={cstNo:'261016124912721295',cstNm:'AT_1015_A3V6'};
export const lit=s=>String(s).includes("'")?'"'+String(s)+'"':"'"+String(s)+"'";
export const btn=(name,prefix='')=>prefix+`//button[translate(normalize-space(.),' ','')=${lit(name.replaceAll(' ',''))}]`;
export const item=(name,prefix='')=>prefix+`//div[contains(@class,'el-form-item')][.//label[normalize-space(.)=${lit(name)}]]`;
export const component=name=>`//div[contains(concat(' ',normalize-space(@class),' '),' el-collapse-item ')][.//div[contains(@class,'el-collapse-item__header')]//span[normalize-space(.)=${lit(name)}]]`;
const requestData=r=>{try{return r.postDataJSON();}catch{return {multipart:true};}};
export class Recorder{
 constructor(page){this.page=page;this.nodes=[];this.network=[];this.checks=[];this.parent='0';this.tasks=[];fs.mkdirSync(OUT+'/shots',{recursive:true});fs.mkdirSync(WIRES,{recursive:true});page.on('response',r=>{if(r.request().method()==='POST'&&r.url().includes('/prod-api/')&&!/token|login|auth/i.test(r.url()))this.tasks.push((async()=>{let result;try{result=await r.json();}catch{};this.network.push({transaction:this.id,url:r.url(),status:r.status(),request:requestData(r.request()),result});this.saveEvidence();})());});}
 loc(x){return this.page.locator('xpath='+x).filter({visible:true}).first();}
 push(p){const id=String(this.nodes.length+1);this.nodes.push({propertiesID:id,propertiesPID:this.parent,type:'ele',propertiesName:'',eventTypeName:'点击',eventTypeValue:'click',elementType:'',mothed:'By.XPATH',options:'',objectValue:'',realLabel:'',transcationType:'playwright',rect:'',...p});return id;}
 async shot(name){const file=path.resolve(OUT+'/shots/'+this.id+'-'+String(this.nodes.length+1).padStart(3,'0')+'-'+name+'.png');await this.page.screenshot({path:file});return file.replaceAll('\\','/');}
 async structure(name,type='page',selector){let rect='';if(type==='popup'){const box=await this.loc(selector).boundingBox();assert.ok(box);rect=JSON.stringify({x1:Math.max(0,box.x/1440),y1:Math.max(0,box.y/900),x2:Math.min(1,(box.x+box.width)/1440),y2:Math.min(1,(box.y+box.height)/900)});}const id=this.push({propertiesName:name,type,mothed:'',screenCapture:await this.shot(name),rect});this.parent=id;return id;}
 async start(id,title){this.id=id;this.title=title;this.nodes=[];this.parent='0';await this.loc(btn('查询')).waitFor({timeout:30000});await this.loc(btn('重置')).click();const initial=this.page.waitForResponse(x=>x.request().method()==='POST'&&x.url().endsWith('/IRtgAplyBsnInfApi/pageBsnInf'),{timeout:25000});await this.loc(btn('查询')).click();const response=await initial;await response.json();await this.structure('对公客户评级');}
 async action(name,x,kind='click',value='',api,options=''){
  const l=this.loc(x);await l.waitFor({timeout:15000});await l.scrollIntoViewIfNeeded();const b=await l.boundingBox();assert.ok(b?.width&&b?.height);assert.ok(b.x>=-1&&b.y>=-1&&b.x+b.width<=1441&&b.y+b.height<=901,'控件坐标超出截图范围：'+name);
  const pending=api?this.page.waitForResponse(r=>r.request().method()==='POST'&&(typeof api==='function'?api(r):r.url().includes(api)),{timeout:25000}):null;
  if(kind==='input'){await l.fill(String(value));assert.equal(await l.inputValue(),String(value));}
  else if(kind==='select:click'){
   await l.click();const d=this.page.locator('.el-select-dropdown').filter({visible:true}).last();await d.waitFor();
   const ambiguous=options&&JSON.parse(options).some(s=>s!==String(value)&&s.includes(String(value)));
   if(ambiguous){
    const parent=this.parent;const open=this.push({propertiesName:'打开下拉-'+name,realLabel:name,elementType:x,eventTypeValue:'click',options,rect:JSON.stringify({x1:b.x/1440,y1:b.y/900,x2:(b.x+b.width)/1440,y2:(b.y+b.height)/900})});this.parent=open;
    await this.structure('精确下拉选择-'+name,'popup',"//div[contains(@class,'el-select-dropdown')]");
    const optionX="//div[contains(@class,'el-select-dropdown')]//li[contains(@class,'el-select-dropdown__item') and normalize-space(.)="+lit(value)+"]";
    const option=await this.action('精确选择-'+name,optionX,'click',value);assert.equal(await l.locator('input').first().inputValue(),String(value));this.parent=parent;return option;
   }
   await d.locator('.el-select-dropdown__item').filter({hasText:new RegExp('^'+String(value).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).filter({visible:true}).click();if(await d.isVisible().catch(()=>false))await this.page.keyboard.press('Escape');assert.equal(await l.locator('input').first().inputValue(),String(value));
  }
  else if(kind==='file:choose'){const chooser=this.page.waitForEvent('filechooser');await l.click();await(await chooser).setFiles(value);}
  else await l.click();
  const id=this.push({propertiesName:name,realLabel:name,elementType:x,eventTypeValue:kind,eventTypeName:kind==='input'?'文本框输入':kind==='select:click'?'下拉框点击选择':'点击',objectValue:String(value),options,rect:JSON.stringify({x1:Math.max(0,b.x/1440),y1:Math.max(0,b.y/900),x2:Math.min(1,(b.x+b.width)/1440),y2:Math.min(1,(b.y+b.height)/900)})});
  if(pending){const response=await pending;const result=await response.json();const request=requestData(response.request());assert.equal(response.status(),200);this.checks.push({transaction:this.id,step:id,name,url:response.url(),request,result});this.saveEvidence();return{id,response,request,result};}return{id};
 }
 success(a){assert.ok(a.result?.status===200||a.result?.code===0||a.result?.code===200,JSON.stringify(a.result));}
 async query(bsnNo,expectedTotal=1){await this.action('业务编号',item('业务编号')+'//input','input',bsnNo);const a=await this.action('精确查询评级记录',btn('查询'),'click','','/IRtgAplyBsnInfApi/pageBsnInf');this.success(a);assert.equal(a.request.bsnNo,bsnNo);assert.equal(a.result.data.total,expectedTotal);await this.page.waitForFunction(({bsnNo,total})=>{const rows=[...document.querySelectorAll('.el-table__body-wrapper tbody tr')].filter(e=>e.getBoundingClientRect().height>0);return total===0?rows.length===0:rows.some(e=>e.innerText.includes(bsnNo));},{bsnNo,total:expectedTotal});return a.result.data.list[0];}
 async select(){const x="//div[contains(@class,'el-table__fixed-body-wrapper')]//tbody/tr[1]//label[contains(@class,'el-radio')]";await this.action('选择评级记录',x);assert.equal(await this.loc(x+'//input').isChecked(),true);}
 async open(bsnNo,button='修改'){
  const row=await this.query(bsnNo);await this.select();const a=await this.action(button,btn(button),'click','','/IRtgAplyBsnInfApi/getBsnInf');this.success(a);assert.equal(a.request.bsnNo,bsnNo);assert.equal(a.result.data.bsnNo,bsnNo);await this.loc(item('业务编号')+'//input').waitFor();await this.page.waitForURL(/FS00005854Host/);this.parent=a.id;await this.structure('新增对公客户评级');await this.inventory();return row;
 }
 async inventory(){const d=await this.page.evaluate(()=>({url:location.href,fields:[...document.querySelectorAll('.el-form-item')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({label:e.querySelector('label')?.innerText.trim(),controls:[...e.querySelectorAll('input,textarea')].map(i=>({type:i.tagName,disabled:i.disabled,readOnly:i.readOnly,value:i.value})),options:[...e.querySelectorAll('.el-select-dropdown__item')].map(o=>o.textContent.trim())})),components:[...document.querySelectorAll('.el-collapse-item__header')].map(e=>e.innerText.trim()),buttons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().height>0).map(e=>({label:e.innerText.trim(),disabled:e.disabled})),notifications:[...document.querySelectorAll('.el-notification,.el-message')].map(e=>e.innerText)}));fs.writeFileSync(OUT+'/'+this.id+'-inventory.json',JSON.stringify(d,null,2));return d;}
 saveEvidence(){if(!this.id)return;fs.writeFileSync(OUT+'/recording-network.json',JSON.stringify(this.network,null,2));fs.writeFileSync(OUT+'/assertions.json',JSON.stringify(this.checks,null,2));}
 async finish(){await Promise.allSettled(this.tasks);fs.writeFileSync(OUT+'/network-'+this.id+'.json',JSON.stringify(this.network.filter(x=>x.transaction===this.id),null,2));const ids=new Set();for(const n of this.nodes){assert.ok(!ids.has(n.propertiesID));assert.ok(n.propertiesPID==='0'||ids.has(n.propertiesPID));ids.add(n.propertiesID);if(n.type==='ele')assert.ok(n.rect&&n.elementType);}fs.writeFileSync(WIRES+'/'+this.id+'.json',JSON.stringify({transcationEventTypeList:[{transcId:'TBD',pageId:'ZJJK00070599',transcationName:this.title,systemId:'TBD',projectId:'TBD',transcationType:'web',testFrame:'playwright',transcationProperties:this.nodes}]},null,2));await Promise.allSettled(this.tasks);fs.writeFileSync(OUT+'/filllog-'+this.id+'.json',JSON.stringify(this.nodes,null,2));fs.writeFileSync(OUT+'/checks-'+this.id+'.json',JSON.stringify(this.checks.filter(a=>a.transaction===this.id),null,2));console.log('RECORDED',this.id,'steps='+this.nodes.length);return{file:this.id,title:this.title,steps:this.nodes.length};}
}
