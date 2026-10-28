const out=[];
for(const [index,tab] of ['客户综合信息','财务信息','业务信息','影像资料','其他信息'].entries()){
 const r=await state.startScene('R'+String(20+index).padStart(2,'0'),tab+'页面检查','担保','修改',tab);
 await page.locator('.el-loading-mask:visible').waitFor({state:'hidden'}).catch(()=>{});
 const inventory=await r.inventory('.el-tab-pane:visible');fs.writeFileSync(RUN+'/tab-'+tab+'.json',JSON.stringify(inventory,null,2));r.note('tabInventory',inventory);
 const tables=await page.locator('.el-tab-pane:visible .el-table').evaluateAll(es=>es.map(e=>({headers:Array.from(e.querySelectorAll('thead th')).map(x=>x.innerText.trim()),parents:(()=>{let a=[],n=e;for(let k=0;n&&k<6;k++,n=n.parentElement)a.push({tag:n.tagName,cls:n.className,attrs:Array.from(n.attributes).filter(x=>/cmpt|data-v-name/.test(x.name)).map(x=>[x.name,x.value]),text:n.innerText.slice(0,200)});return a;})()})));
 fs.writeFileSync(RUN+'/tables-'+tab+'.json',JSON.stringify(tables,null,2));r.note('tables',tables);r.finish();out.push({tab,forms:inventory.flatMap(x=>x.forms).map(x=>x.label),buttons:inventory.flatMap(x=>x.buttons).map(x=>x.text),tables:tables.length});
}
return out;
