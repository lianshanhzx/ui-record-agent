import assert from 'node:assert/strict';
export async function ensureClientRole(page){
 const header=page.locator('.header__user').filter({visible:true});await header.waitFor({timeout:30000});
 await header.click();
 const roleItem="//div[contains(@class,'userinfo-item')][.//span[normalize-space(.)='角色：']]";
 const current=page.locator('xpath='+roleItem+"//span[contains(@class,'userinfo-item__value')]");
 await current.waitFor({state:'visible'});
 if((await current.innerText()).trim()==='客户经理'){await header.click();return {role:'客户经理',roleCode:'X0018',changed:false};}
 await page.locator('xpath='+roleItem).click();
 const choice=page.locator('.role-popper li.role-item[data-role-ecd="X0018"][data-inst-no="9881"]').filter({visible:true});
 await choice.waitFor();assert.equal(await choice.count(),1);await choice.click();
 const prompt=page.locator('.el-message-box').filter({visible:true});
 if(await prompt.count()){const text=await prompt.innerText();assert.match(text,/切换|角色/);await prompt.locator('button.el-button--primary').click();}
 await page.waitForFunction(()=>[...document.querySelectorAll('.userinfo-item')].some(e=>e.querySelector('.userinfo-item__label')?.textContent.trim()==='角色：'&&e.querySelector('.userinfo-item__value')?.textContent.trim()==='客户经理'),{},{timeout:30000});
 return {role:'客户经理',roleCode:'X0018',changed:true};
}
