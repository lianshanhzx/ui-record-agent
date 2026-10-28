const r=state.rec,D=state.dialog;
const inventory=[];
for(const tab of ['资产负债表','利润表','现金流量表','指标分析表']){
 const T=D+`//div[contains(@class,'el-tabs__item') and normalize-space(.)='${tab}']`;
 if(await r.loc(T).count())await r.click('财报指标-'+tab,T);
 const rows=await page.locator('.el-dialog:visible .el-tab-pane:visible tbody tr').evaluateAll(es=>es.filter(e=>e.offsetParent!==null).map(e=>({label:e.querySelector('td')?.innerText.trim(),inputs:Array.from(e.querySelectorAll('input')).filter(i=>i.offsetParent!==null).map(i=>({disabled:i.disabled,readonly:i.readOnly,value:i.value}))})).filter(x=>x.inputs.length));
 inventory.push({tab,rows});r.note('financeCellInventory-'+tab,rows);
 for(const row of rows){if(row.inputs.every(i=>i.disabled||i.readonly))continue;const xp=D+`//div[contains(@class,'el-tab-pane')]//tbody/tr[./td[1][normalize-space(.)='${row.label}']]//input[not(@disabled) and not(@readonly)]`;const value=tab==='资产负债表'&&['货币资金','实收资本'].includes(row.label)?'1000000':'0';await r.input(tab+'-'+row.label,xp,value);}
}
fs.writeFileSync(RUN+'/finance-cell-inventory.json',JSON.stringify(inventory,null,2));
const q=page.waitForResponse(x=>x.url().includes('/tansun-tcp-ifr/')&&/save|update/i.test(x.url())&&x.request().method()==='POST',{timeout:20000}).catch(()=>null);await r.click('保存财报指标',r.btn('保存',D));const response=await q;if(!response){r.note('financeEditErrors',await page.locator('.el-message:visible,.el-notification:visible,.el-form-item__error:visible').allTextContents());return r.finish('blocked','财报指标保存未收到接口响应');}const body=await response.json();r.note('financeEditSave',{url:response.url(),request:response.request().postDataJSON(),body});if(body.status!==200)return r.finish('blocked',body.description||JSON.stringify(body));await page.locator('.el-dialog:visible').waitFor({state:'hidden',timeout:30000});await state.returnList();return r.finish();
