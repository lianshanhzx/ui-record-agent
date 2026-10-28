const r=await state.startScene('R10','潜在客户正式保存','潜客');
const wait=state.waitApi('saveQZCustCorporat').catch(()=>null);await r.click('概况保存',r.btn('保存'));const response=await wait;
if(response){const data=await response.json();r.note('saveResponse',data);if(data.status===200){await state.returnList();await state.validatePersisted('潜客');r.finish();}else {await state.returnList();r.finish('blocked','保存接口返回非成功，见响应证据');}}
else {const errors=await page.locator('.el-form-item__error:visible,.el-message:visible,.el-notification:visible,.el-message-box:visible').allTextContents();r.note('saveValidation',errors);await page.screenshot({path:RUN+'/potential-save-blocked.png'});await state.returnList();r.finish('blocked','保存未发请求，前端校验拦截：'+errors.join('|'));}
return r.registry.at(-1);
