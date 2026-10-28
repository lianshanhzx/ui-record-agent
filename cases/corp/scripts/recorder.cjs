const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
class Recorder {
  constructor(page, dir, wires, net) { this.page=page;this.dir=dir;this.wires=wires;this.net=net;this.registry=[];fs.mkdirSync(dir+'/shots',{recursive:true}); }
  async start(id,name) {this.id=id;this.name=name;this.steps=[];this.evidence=[];this.parent='0';this.networkStart=this.net.length;await this.structure('page','对公客户管理列表', '0');}
  async structure(type,name,pid) {const id=String(this.steps.length+1);this.steps.push({propertiesID:id,propertiesPID:pid??this.parent,type,propertiesName:name,eventTypeValue:'click',eventTypeName:'点击',mothed:'',elementType:'',objectValue:'',realLabel:name,rect:'',transcationType:'playwright',options:''});this.parent=id;await this.shot(name);return id;}
  loc(xpath) {return this.page.locator('xpath='+xpath).filter({visible:true});}
  async shot(name) {const file=`${this.id}_${String(this.steps.length).padStart(3,'0')}.png`;await this.page.screenshot({path:this.dir+'/shots/'+file});if(this.steps.length)this.steps.at(-1).screenCapture=this.dir+'/shots/'+file;}
  async action(name,xpath,action='click',value='',options={}) {
    await this.page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
    const l=this.loc(xpath);assert.equal(await l.count(),1,'Target not unique: '+name);await l.scrollIntoViewIfNeeded();await l.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest'}));const b=await l.boundingBox();assert(b,'No bounding box: '+name);
    if(action==='input'){const max=Number(await l.getAttribute('maxlength'));if(max>0&&value.length>max)value=value.slice(0,max);}
    if(action==='input'&&value&&(await l.inputValue()))await this.action(name+'清空',xpath,'input','');
    const realLabel=await l.evaluate(e=>{if(e.matches('input,textarea,.el-select'))return e.closest('.el-form-item')?.querySelector('label')?.innerText?.trim().replace(/^[*\s]+/,'')||'';if(e.matches('.el-radio'))return '单选';return e.innerText?.trim()||e.getAttribute('aria-label')||'';});
    const id=String(this.steps.length+1);const step={propertiesID:id,propertiesPID:this.parent,type:'ele',propertiesName:name,eventTypeValue:action,eventTypeName:action==='input'?'输入':action==='select:click'?'下拉框点击选择':'点击',mothed:'By.XPATH',elementType:xpath,objectValue:value,realLabel:realLabel||name,rect:JSON.stringify({x1:b.x/1440,y1:b.y/900,x2:(b.x+b.width)/1440,y2:(b.y+b.height)/900}),transcationType:'playwright',options:''};
    if(action==='input'){await l.fill(value);assert.equal(await l.inputValue(),value);}
    else if(action==='select:click'){
      await this.page.waitForFunction(()=>!Array.from(document.querySelectorAll('.el-select-dropdown')).some(e=>e.offsetParent!==null),null,{timeout:5000});
      await l.click();
      const selectedElement=await l.elementHandle();await this.page.waitForFunction(e=>!!e?.__vue__?.visible&&!!e.__vue__.popperElm,selectedElement,{timeout:5000});
      const handle=await l.evaluateHandle(e=>e.__vue__.popperElm);const popup=handle.asElement();await popup.waitForElementState('visible');const items=await popup.$$('.el-select-dropdown__item');const values=await Promise.all(items.map(async e=>(await e.innerText()).trim()));this.note(name+'选项',values);if(options.auto&&!values.includes(value))value=values[0];step.objectValue=value;const matches=items.filter((e,i)=>values[i]===value);assert.equal(matches.length,1,'Option not unique: '+value);await matches[0].click();await this.page.waitForFunction(e=>!e?.__vue__?.visible,selectedElement,{timeout:5000});await handle.dispose();await selectedElement.dispose();
    }
    else if(action==='file:choose'){const chooser=this.page.waitForEvent('filechooser',{timeout:15000});await l.click();await (await chooser).setFiles(value);}
    else if(action==='download'){const pending=this.page.waitForEvent('download',{timeout:20000});await l.click();const download=await pending;const target=this.dir+'/downloads/'+download.suggestedFilename();fs.mkdirSync(this.dir+'/downloads',{recursive:true});await download.saveAs(target);this.note('download',{name:download.suggestedFilename(),path:target,size:fs.statSync(target).size});}
    else await l.click();
    if(action==='download'){step.eventTypeValue='click';step.eventTypeName='点击';}
    this.steps.push(step);if(options.wait)await options.wait();
    await this.shot(name);return id;
  }
  async click(name,xpath,options){return this.action(name,xpath,'click','',options);}
  async input(name,xpath,value){return this.action(name,xpath,'input',value);}
  async select(name,xpath,value){return this.action(name,xpath,'select:click',value);}
  async selectAuto(name,xpath,value=''){return this.action(name,xpath,'select:click',value,{auto:true});}
  note(name,value){this.evidence.push({name,value,time:new Date().toISOString()});}
  finish(status='recorded',reason='') {
    const transaction={transcId:'TBD',pageId:'TBD',transcationName:this.id+' 对公客户管理-'+this.name,systemId:'TBD',projectId:'TBD',transcationType:'web',testFrame:'playwright',transcationProperties:this.steps};
    const wire={transcationEventTypeList:[transaction]};
    fs.writeFileSync(this.dir+'/'+this.id+'-recording.json',JSON.stringify({id:this.id,name:this.name,status,reason,recordedAt:new Date().toISOString(),steps:this.steps,evidence:this.evidence,network:this.net.slice(this.networkStart)},null,2));
    if(status==='recorded')fs.writeFileSync(this.wires+'/'+this.id+'.json',JSON.stringify(wire,null,2));
    this.registry=this.registry.filter(x=>x.id!==this.id);this.registry.push({id:this.id,name:this.name,status,reason,steps:this.steps.length});fs.writeFileSync(this.dir+'/recording-manifest.json',JSON.stringify(this.registry,null,2));return this.registry.at(-1);
  }
  field(label,scope=''){const prefix=scope||'';return `${prefix}//div[contains(concat(' ',normalize-space(@class),' '),' el-form-item ')][.//label[translate(normalize-space(.),' *：:','')='${label}']]`;}
  inp(label,scope=''){return this.field(label,scope)+'//input[not(@type="hidden")]';}
  sel(label,scope=''){return this.field(label,scope)+'//div[contains(concat(" ",normalize-space(@class)," ")," el-select ")]';}
  btn(text,scope=''){return (scope||'')+`//button[translate(normalize-space(.),' ','')='${text}']`;}
  async inventory(scope='body') {return this.page.locator(scope).filter({visible:true}).evaluateAll(es=>es.map(el=>({text:el.innerText.slice(0,22000),forms:Array.from(el.querySelectorAll('.el-form-item')).filter(e=>e.offsetParent!==null).map(e=>({label:e.querySelector('label')?.innerText?.trim(),required:e.classList.contains('is-required'),inputs:Array.from(e.querySelectorAll('input,textarea')).map(i=>({type:i.type,tag:i.tagName,value:i.value,disabled:i.disabled,readonly:i.readOnly,placeholder:i.placeholder})),select:!!e.querySelector('.el-select'),date:!!e.querySelector('.el-date-editor'),buttons:Array.from(e.querySelectorAll('button')).map(b=>b.innerText)})),buttons:Array.from(el.querySelectorAll('button')).filter(b=>b.offsetParent!==null).map(b=>({text:b.innerText.trim(),disabled:b.disabled}))})));}
}
module.exports=Recorder;


