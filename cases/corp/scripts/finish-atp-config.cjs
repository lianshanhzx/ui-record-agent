const fs=require('node:fs'),path=require('node:path');const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'atp-project13-system110-20261013');
const measurements=JSON.parse(fs.readFileSync(path.join(out,'popup-measurements.json')));
const manual={'R18#56':[647,284,969,523],'R55#50':[912,293,1234,541],'R165#11':[360,118,1080,621],'R167#12':[0,135,1440,765]};
const popupRects={},audit=[];
for(const row of measurements){let box=row.selected?.box,method='Screenshot frame-edge measurement; reviewed on full-screenshot contact sheet';
 if(!box){if(manual[row.id+'#'+row.step]){box=manual[row.id+'#'+row.step];method='Individually inspected full screenshot and measured visible frame';}else if(['财报指标编辑弹窗','对公客户联网核查弹窗','影像资料弹窗'].includes(row.name)){box=[0,0,1440,900];method='Individually inspected screenshot: fullscreen container occupies full viewport';}}
 if(!box)throw Error('未确认坐标 '+row.key);
 popupRects[row.key]={x1:box[0]/1440,y1:box[1]/900,x2:box[2]/1440,y2:box[3]/900};
 audit.push({key:row.key,shot:row.shot,box,rect:popupRects[row.key],method});
}
fs.writeFileSync(path.join(out,'config.json'),JSON.stringify({sourceRoot:root,popupRects},null,2));
fs.writeFileSync(path.join(out,'popup-rect-audit.json'),JSON.stringify(audit,null,2));
console.log(JSON.stringify({popupRects:audit.length}));
