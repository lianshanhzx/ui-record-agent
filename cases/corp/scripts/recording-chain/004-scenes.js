const r=state.rec;const D="//div[contains(concat(' ',normalize-space(@class),' '),' el-drawer ')]";const L="//div[contains(concat(' ',normalize-space(@class),' '),' el-dialog ')]";
await r.click('未上传营业执照确认',r.btn('确认',L));r.note('emptyImageErrors',await page.locator('.el-notification:visible,.el-message:visible').allTextContents());await r.click('OCR取消',r.btn('取消',L));r.parent='3';await r.click('新增取消',r.btn('取消',D));r.finish();
state.customers={};
state.create=async(kind,id,type,status)=>{
 const r=state.rec;
 await state.list();await r.start(id,'新增'+kind+'客户');let click=await r.click('新增',r.btn('新增'));await page.locator('.el-drawer:visible').waitFor();await r.structure('popup','新增客户校验',click);
 const data=state.newData(kind);await r.select('对公客户类型',r.sel('对公客户类型',D),type);if(status)await r.select('客户状态',r.sel('客户状态',D),status);await r.select('证件类型',r.sel('证件类型',D),'营业执照');await r.input('客户名称',r.inp('客户名称',D),data.name);await r.input('证件号码',r.inp('证件号码',D),data.uscc);
 const q=state.waitApi('checkCustCorporat');click=await r.click('保存新增客户',r.btn('保存',D));const response=await q;const body=await response.json();r.note('createResponse',body);if(body.status!==200||!body.data?.cstNo)throw Error('Create failed: '+JSON.stringify(body));data.cstNo=body.data.cstNo;
 await page.waitForURL(/crtCpctInf/,{timeout:30000});await page.locator('input').filter({visible:true}).first().waitFor();await r.structure('page','维护对公客户概况',click);await page.locator('.el-loading-mask:visible').waitFor({state:'hidden',timeout:30000}).catch(()=>{});state.customers[kind]=data;fs.writeFileSync(RUN+'/test-customers.json',JSON.stringify(state.customers,null,2));
 const inventory=await r.inventory();fs.writeFileSync(RUN+'/'+kind+'-inventory.json',JSON.stringify(inventory,null,2));return {customer:data,url:page.url(),inventory};
};
return await state.create('潜客','R09','企业类');
