import {begin,end,openOwned,back,btn,item,fixture,OUT,fs,assert,notify,profile} from './common.mjs';
import {ensureClientRole} from './role-switch.mjs';
export async function signPage(r){await openOwned(r);for(const n of ['影像资料','风险阻断','签署信息'])await r.action('下一步'+n,btn('下一步'));await r.loc(item('流程操作')+'//input').waitFor();await r.inventory();fs.writeFileSync(OUT+'/sign-dom.html',await r.page.locator('body').innerHTML());}
export async function incompleteSubmission(page){const r=await begin(page,'M10-04','提交前评级资料完整性校验',['M10-04']);await signPage(r);await r.action('流程操作下一步',item('流程操作')+"//div[contains(@class,'el-select')]",'select:click','下一步');await r.action('未填写意见提交流程',btn('流程提交'));await notify(r,/请输入意见详情/);await r.action('意见详情',item('意见详情')+'//textarea','input','AT_提交完整性校验');await r.action('未测算提交流程',btn('流程提交'));await notify(r,/请先.*测算|评级.*测算/);await back(r);await end(r);}
export async function history(page){const r=await begin(page,'M12-01','查看历年评级情况',['M12-01']);await r.open('PJ20260907016009','查看详情');const scope="//div[contains(@class,'el-collapse-item')][.//div[contains(@class,'el-collapse-item__header')]//span[normalize-space(.)='历年评级情况']]";await r.loc(scope).scrollIntoViewIfNeeded();await r.shot('历年评级');await r.inventory();r.checks.push({transaction:r.id,name:'历史评级展示',text:await r.loc(scope).innerText()});await back(r);await end(r);}
export async function track(page){const r=await begin(page,'M12-02','查看流程轨迹与审批意见',['M12-02']);await r.query('PJ20260907016009');await r.select();const a=await r.action('查看流程轨迹',btn('流程轨迹'));r.parent=a.id;const D="//div[@role='dialog' and @aria-label='流程轨迹']";await r.loc(D).waitFor();await r.structure('流程轨迹','popup',D);await r.page.waitForFunction(()=>document.querySelector('[aria-label="流程轨迹"]')?.textContent.includes('信贷调查'));const text=await r.loc(D).innerText();assert.match(text,/信贷调查/);r.checks.push({transaction:r.id,name:'流程节点及意见',text});await r.action('关闭流程轨迹',btn('取消',D));await end(r);}
export async function trackTimes(page){const r=await begin(page,'M12-03','流程跟踪状态及耗时展示',['M12-03']);await r.query('PJ20260907016009');await r.select();const a=await r.action('查看审批耗时',btn('流程轨迹'));r.parent=a.id;const D="//div[@role='dialog' and @aria-label='流程轨迹']";await r.loc(D).waitFor();await r.structure('流程轨迹','popup',D);await r.page.waitForFunction(()=>document.querySelector('[aria-label="流程轨迹"]')?.textContent.includes('已处理'));const text=await r.loc(D).innerText();assert.match(text,/已处理/);r.checks.push({transaction:r.id,name:'状态和耗时展示',text});await r.action('关闭流程跟踪',btn('取消',D));await end(r);}
export async function submissionProbe(page){
 const r=await begin(page,'PROBE-submit','当前账号审批提交探路',[]);await signPage(r);await r.shot('提交流程入口');
 await r.action('选择下一步',item('流程操作')+"//div[contains(@class,'el-select')]",'select:click','下一步');
 await r.action('流程审批意见',item('意见详情')+'//textarea','input','AT_全新评级录制_提交_'+fixture().bsnNo);
 await r.action('提交流程查看后续处理',btn('流程提交'));
 await r.page.waitForTimeout(1000);await r.inventory();await r.shot('提交后处理');fs.writeFileSync(OUT+'/submit-after-dom.html',await r.page.locator('body').innerHTML());
 fs.writeFileSync(OUT+'/submit-after-text.txt',await r.page.locator('body').innerText());
 await end(r);
}
export async function tasksProbe(page){const r=await begin(page,'PROBE-tasks','当前账号待办任务探路',[]);await page.goto(profile.baseUrl+'/#/portal/wfPendTask',{waitUntil:'domcontentloaded'});await r.loc(btn('查询')).waitFor();await r.inventory();await r.shot('当前账号待办任务');fs.writeFileSync(OUT+'/tasks-dom.html',await page.locator('body').innerHTML());fs.writeFileSync(OUT+'/tasks-text.txt',await page.locator('body').innerText());await end(r);}
export async function submit(page){
 const r=await begin(page,'M10-03-submit','提交评级并选择当前账号审查',['M10-03','M10-05']);await signPage(r);
 await r.action('流程操作下一步',item('流程操作')+"//div[contains(@class,'el-select')]",'select:click','下一步');
 await r.action('意见详情',item('意见详情')+'//textarea','input','AT_全新录制提交_'+fixture().bsnNo);
 const a=await r.action('提交流程',btn('流程提交'));r.parent=a.id;
 const D="//div[@role='dialog' and @aria-label='流程选人']";await r.loc(D).waitFor();const dialogId=await r.structure('流程选人','popup',D);const pick=await r.action('打开下一节点审批人',item('下一节点审批人',D)+"//input[@placeholder='请选择']");r.parent=pick.id;await r.structure('流程选人候选人','popup',"//div[contains(@class,'tree-popover')]");
 const self="//div[contains(@class,'tree-popover')]//div[contains(@class,'el-tree-node__content')][.//span[normalize-space(.)='客户经理-黄某某(701994)']]//label[contains(@class,'el-checkbox')]";
 await r.action('选择当前账号作为下一节点审批人',self);const checked=r.page.locator('xpath='+self+'//input');assert.equal(await checked.count(),1);assert.equal(await checked.isChecked(),true);r.parent=dialogId;if(await r.loc("//div[contains(@class,'tree-popover')]").isVisible().catch(()=>false))await r.action('关闭审批人候选树',item('下一节点审批人',D)+'//label');
 await r.action('确定选人并提交',btn('确定',D));await r.loc(D).waitFor({state:'hidden',timeout:25000});
 if(r.page.url().includes('FS00005854'))await back(r);else{r.parent=String(r.nodes.length);await r.structure('对公客户评级');}
 const row=await r.query(fixture().bsnNo);assert.equal(row.bsnSt,'2');r.checks.push({transaction:r.id,name:'提交后审批中状态',row});await end(r);
}
export async function taskStart(page,id,title,points){
 const r=await begin(page,id,title,points);const role=await ensureClientRole(page);r.checks.push({transaction:r.id,name:'同一账号切换其已有客户经理角色',role});await page.context().storageState({path:OUT+'/auth-client.json'});await page.goto(profile.baseUrl+'/#/portal/wfPendTask',{waitUntil:'domcontentloaded'});await r.loc(btn('查询')).waitFor();r.nodes=[];r.parent='0';await r.structure('待办任务');
 await r.action('业务主键',item('业务主键')+'//input','input',fixture().bsnNo);
 const q=await r.action('查询本轮评级审批待办',btn('查询'),'click','',x=>x.url().endsWith('/workflow/list')&&x.request().postDataJSON()?.bsnPk===fixture().bsnNo);r.success(q);assert.equal(q.request.bsnPk,fixture().bsnNo);assert.equal(q.result.data.grid.total,1);assert.equal(q.result.data.grid.list[0].tskNodeId,'wf_rating_003_002','必须是实际二次调查审查节点，不能把初始调查任务当审查任务');
 const card="//div[contains(concat(' ',normalize-space(@class),' '),' todo-item ')][.//span[normalize-space(.)='"+fixture().bsnNo+"']]";
 const a=await r.action('处理本轮对公评级审批任务',card+"//div[contains(@class,'todo-item-action') and normalize-space(.)='处理']");await page.waitForURL(/FS00005854/);await r.loc(btn('审批')).waitFor({timeout:30000});await page.waitForFunction(bsn=>[...document.querySelectorAll('.el-form-item')].some(e=>e.querySelector('label')?.textContent.trim()==='业务编号'&&e.querySelector('input')?.value===bsn),fixture().bsnNo,{timeout:20000});r.parent=a.id;await r.structure('对公评级审批任务');await r.inventory();return r;
}
export async function reviewTask(page){const r=await taskStart(page,'M10-01','当前账号审查岗任务页面',['M10-01']);await r.shot('审查岗基本信息');fs.writeFileSync(OUT+'/review-dom.html',await page.locator('body').innerHTML());assert.equal(await r.loc(item('业务编号')+'//input').inputValue(),fixture().bsnNo);await end(r);}
export async function reviewMaterials(page){const r=await taskStart(page,'M10-02','审查评级基本信息及影像',['M10-02']);const inv=await r.inventory();r.checks.push({transaction:r.id,name:'审查材料字段盘点',fields:inv.fields,components:inv.components});const tabs=(await page.locator('[role=tab]').filter({visible:true}).allTextContents()).map(s=>s.trim());fs.writeFileSync(OUT+'/review-tabs.json',JSON.stringify(tabs,null,2));const name=tabs.find(s=>/影像/.test(s));assert.ok(name,'审查页应提供影像标签');const image="//*[@role='tab' and normalize-space(.)='"+name+"']";await r.action('审查影像资料',image);await r.inventory();await r.shot('审查影像');await end(r);}
export async function approvalProbe(page){const r=await taskStart(page,'PROBE-approval','当前账号审批操作探路',[]);await r.action('打开审批操作',btn('审批'));await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog][aria-label="审批意见"] label')].some(e=>e.textContent.trim()==='流程操作'),{},{timeout:25000}).catch(()=>{});await r.inventory();await r.shot('审批操作');fs.writeFileSync(OUT+'/approval-dom.html',await page.locator('body').innerHTML());fs.writeFileSync(OUT+'/approval-text.txt',await page.locator('body').innerText());await end(r);}
export async function approve(page){
 const r=await taskStart(page,'M10-03-approve','当前账号最终同意对公评级',['M10-03','M10-05']);
 const ops=page.waitForResponse(x=>x.url().endsWith('/queryOperat'));
 const a=await r.action('打开评级审批意见',btn('审批'));r.parent=a.id;
 const D="//div[@role='dialog' and @aria-label='审批意见']";await r.loc(D).waitFor();await r.structure('评级审批意见','popup',D);
 const data=await(await ops).json();assert.equal(data.status,200);const options=data.data.map(x=>x.pcsMnpltAls||x.pcsMnpltNm);
 await r.action('选择审批同意',item('流程操作',D)+"//div[contains(concat(' ',normalize-space(@class),' '),' el-select ')]",'select:click','同意',undefined,JSON.stringify(options));
 await r.action('填写审批意见',item('意见详情',D)+'//textarea','input','AT_全新录制审批通过_'+fixture().bsnNo);
 const finish=await r.action('提交最终审批同意',btn('流程提交',D));const confirm="//div[contains(concat(' ',normalize-space(@class),' '),' el-message-box ')]";await r.loc(confirm).waitFor();assert.match(await r.loc(confirm).innerText(),/流程到此结束/);r.parent=finish.id;await r.structure('最终审批结束确认','popup',confirm);await r.action('确认结束并通过评级流程',confirm+"//button[contains(@class,'el-button--primary')]");await r.loc(confirm).waitFor({state:'hidden'});await r.loc(D).waitFor({state:'hidden',timeout:30000});
 r.parent='1';const tab=await r.action('返回对公评级主列表页签',"//li[contains(concat(' ',normalize-space(@class),' '),' tag-item ')][./span[normalize-space(.)='对公客户评级']]");
 await r.loc(item('业务编号')+'//input').waitFor();r.parent=tab.id;await r.structure('对公客户评级');
 const row=await r.query(fixture().bsnNo);assert.equal(row.bsnSt,'5');r.checks.push({transaction:r.id,name:'最终审批通过反查',row});fs.writeFileSync(OUT+'/approval-result.json',JSON.stringify({bsnNo:row.bsnNo,state:row.bsnSt,at:new Date().toISOString()},null,2));
 await end(r);
}
