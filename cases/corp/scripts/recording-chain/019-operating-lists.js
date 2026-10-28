const done=[];const L=state.dialog;
const inputDefault=state.inputValue;state.inputValue=label=>/名称|说明|描述|情况|备注|机构|机关/.test(label)?'RR1012_'+label.slice(0,10):/资金|费用|成本|收入|利润|收益|本金|投资总额|金额|价值|股价|股本|利息/.test(label)?'1000000':/手机号|联系电话/.test(label)?'13900001012':/传真/.test(label)?'01088881012':inputDefault(label);
for(const [base,name,header] of [[51,'客户资质信息','证书编号'],[55,'参与项目情况','项目名称'],[59,'企业债券发行情况','债券名称']]){
 try{await state.openPanel('R'+base,name+'新增','客户基本信息',header);const r=state.rec;await state.fillSimple('.el-dialog',L);const extra=(await r.inventory('.el-dialog')).at(-1).forms.filter(f=>f.buttons.length);r.note('auxiliaryFields',extra);const result=await state.submitDialog();if(!result.ok){await state.closeDialog();done.push(r.finish('blocked',result.reason));continue;}r.parent=state.sceneParent;await state.returnList();done.push(r.finish());done.push(...await state.editView(base+1,name,'客户基本信息',header));done.push(await state.deletePanel('R'+(base+3),name,'客户基本信息',header));}
 catch(e){state.rec.note('exception',e.message);done.push(state.rec.finish('blocked',e.message));}
}
return done;
