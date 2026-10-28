const fs=require('node:fs'),path=require('node:path');const run=__dirname;
const dir=path.join(run,'replay-ocr-repair-input');fs.mkdirSync(dir,{recursive:true});
fs.copyFileSync(path.join(run,'replay-input/R100.json'),path.join(dir,'R100.json'));
for(const id of ['R106','R109'])fs.copyFileSync(path.join(run,'replay-final-input',id+'.json'),path.join(dir,id+'.json'));
console.log(JSON.stringify({cases:['R100','R106','R109'],purpose:'重建已删除的本批财报前置，复验OCR页面就绪定位并清理本轮前置'}));
