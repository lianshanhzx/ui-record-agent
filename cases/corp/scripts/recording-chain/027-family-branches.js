const out=[];
for(const [id,kind] of [['R90','实际控制人家族成员'],['R92','个人股东家族成员']]){
 await state.openPanel(id,'关联人信息新增-'+kind,'客户基本信息','关联方客户编号');const r=state.rec;
 const W=state.dialog+"[.//label[translate(normalize-space(.),' *：:','')='关联方类型']]";
 await r.select('关联方类型',r.sel('关联方类型',W),kind);const c=await r.click('下一步',r.btn('下一步',W));
 const H=state.dialog+"[.//label[translate(normalize-space(.),' *：:','')='关联人家庭成员关系类型']]";await r.loc(H).waitFor();await r.structure('popup',kind+'明细弹窗',c);
 const result=await state.fillFamily();out.push(result);if(result.status!=='recorded')return out;
 out.push(await state.deletePanel('R'+(Number(id.slice(1))+1),kind,'客户基本信息','关联方客户编号'));
}
return out;
