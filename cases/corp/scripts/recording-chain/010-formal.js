const r=state.rec;state.overview=state.section('对公客户概况');state.overviewCSS='.el-collapse-item:has(.header-title:text-is("对公客户概况"))';state.currentCustomer=state.customers['正式'];state.currentCustomer.kind='正式';state.sceneParent=r.steps.filter(s=>s.type==='page').at(-1).propertiesID;
const filled=r.steps.filter(s=>['input','select:click'].includes(s.eventTypeValue)).map(s=>s.propertiesName);await state.fillSimple(state.overviewCSS,state.overview,['行业代码','联网核查状态',...filled]);
const forms=(await r.inventory(state.overviewCSS))[0].forms;
for(const f of forms){const label=f.label.replace(/[\s*：:]/g,'');const button=f.buttons.map(x=>x.replace(/\s/g,'')).find(x=>['获取地址','获取行政区划','选择'].includes(x));if(button)await state.address(label,button,state.overview);}
for(const label of ['财务部联系人手机号码（短信通知）','联系号码/手机号码（短信通知）'])if(await r.loc(r.inp(label,state.overview)).count())await r.input(label,r.inp(label,state.overview),'13900001012');
await r.selectAuto('基本存款账户是否在法人行',r.sel('基本存款账户是否在法人行',state.overview),'否');
await r.input('登记注册号',r.inp('登记注册号',state.overview),state.currentCustomer.uscc);
await state.industry(state.overview);await state.importPerson('法定代表人/负责人证件号码',state.overview);
await r.selectAuto('企业规模',r.sel('企业规模',state.overview),'中型企业');await r.click('企业规模测算',r.field('企业规模',state.overview)+"//button[normalize-space(.)='测算']");r.note('scaleCalculation',await r.loc(r.inp('企业规模',state.overview)).inputValue());
const q=state.waitApi('saveCustCorporat');await r.click('概况暂存',r.btn('暂存',state.overview));const response=await q;const data=await response.json();r.note('temporarySave',data);if(data.status!==200)throw Error('Formal temporary save failed');
await state.returnList();await state.validatePersisted('正式');r.finish();return r.registry.at(-1);
